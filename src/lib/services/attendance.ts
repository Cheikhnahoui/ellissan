import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashQrToken } from "@/lib/qr-token";
import type { Result } from "./invitations";

type Fail = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Fail => ({ ok: false, code, message });

export const ATTENDANCE_ERRORS = {
  INVALID_TOKEN: "رمز QR غير صالح",
  WRONG_ACTIVITY: "هذه الدعوة تخص نشاطًا آخر",
  REVOKED: "تم إلغاء هذه الدعوة",
  NOT_PREPARED: "هذه الدعوة لم يتم تجهيزها بعد",
  DUPLICATE: "تم تسجيل حضور هذا المدعو مسبقًا",
  ACTIVITY_CLOSED: "تم إغلاق النشاط ولا يمكن تسجيل حضور جديد",
  NOT_OPEN_YET: "تسجيل الحضور لم يبدأ بعد",
  WINDOW_ENDED: "انتهت فترة تسجيل الحضور",
  CAPACITY_REACHED: "اكتملت سعة النشاط",
} as const;

/** Window rule used everywhere: registration is open only if the activity is OPEN and now is within [opensAt, closesAt]. */
export function registrationState(
  a: { status: "OPEN" | "CLOSED"; attendanceOpensAt: Date; attendanceClosesAt: Date },
  now: Date,
): "OPEN" | "CLOSED" | "NOT_OPEN_YET" | "WINDOW_ENDED" {
  if (a.status === "CLOSED") return "CLOSED";
  if (now < a.attendanceOpensAt) return "NOT_OPEN_YET";
  if (now > a.attendanceClosesAt) return "WINDOW_ENDED";
  return "OPEN";
}

export async function recordAttendanceByToken(opts: {
  token: string;
  adminId: string;
  expectedActivityId?: string;
  now?: Date;
}): Promise<Result<{ attendanceId: string; participantName: string; activityTitle: string; recordedAt: Date }>> {
  const now = opts.now ?? new Date();
  const tokenHash = hashQrToken(opts.token);
  try {
    return await prisma.$transaction(async (tx) => {
      const found = await tx.invitation.findUnique({
        where: { qrTokenHash: tokenHash },
        select: { id: true, activityId: true },
      });
      if (!found) return fail("INVALID_TOKEN", ATTENDANCE_ERRORS.INVALID_TOKEN);
      if (opts.expectedActivityId && found.activityId !== opts.expectedActivityId)
        return fail("WRONG_ACTIVITY", ATTENDANCE_ERRORS.WRONG_ACTIVITY);

      // Serialise all scans for the same activity (also protects capacity checks).
      await tx.$queryRaw`SELECT id FROM "Activity" WHERE id = ${found.activityId} FOR UPDATE`;

      const inv = await tx.invitation.findUniqueOrThrow({
        where: { id: found.id },
        include: { activity: true, participant: { select: { fullName: true } }, attendance: true },
      });
      if (inv.status === "CANCELLED") return fail("REVOKED", ATTENDANCE_ERRORS.REVOKED);
      if (inv.status === "DRAFT") return fail("NOT_PREPARED", ATTENDANCE_ERRORS.NOT_PREPARED);
      if (inv.status === "ATTENDED") return fail("DUPLICATE", ATTENDANCE_ERRORS.DUPLICATE);

      const state = registrationState(inv.activity, now);
      if (state === "CLOSED") return fail("ACTIVITY_CLOSED", ATTENDANCE_ERRORS.ACTIVITY_CLOSED);
      if (state === "NOT_OPEN_YET") return fail("NOT_OPEN_YET", ATTENDANCE_ERRORS.NOT_OPEN_YET);
      if (state === "WINDOW_ENDED") return fail("WINDOW_ENDED", ATTENDANCE_ERRORS.WINDOW_ENDED);

      if (inv.activity.capacity != null) {
        const n = await tx.attendance.count({ where: { activityId: inv.activityId, status: "VALID" } });
        if (n >= inv.activity.capacity) return fail("CAPACITY_REACHED", ATTENDANCE_ERRORS.CAPACITY_REACHED);
      }

      // Conditional transition is the atomic guard; the unique constraints are the backstop.
      const moved = await tx.invitation.updateMany({
        where: { id: inv.id, status: { in: ["PREPARED", "SENT_CONFIRMED"] } },
        data: { status: "ATTENDED" },
      });
      if (moved.count !== 1) return fail("DUPLICATE", ATTENDANCE_ERRORS.DUPLICATE);

      let attendance;
      if (inv.attendance) {
        // Previously voided by a correction: restore the same row (history kept), audited.
        attendance = await tx.attendance.update({
          where: { id: inv.attendance.id },
          data: { status: "VALID", method: "QR_SCAN", recordedAt: now, recordedById: opts.adminId },
        });
        await tx.attendanceCorrection.create({
          data: {
            attendanceId: attendance.id,
            action: "RESTORE",
            previousStatus: "VOIDED",
            newStatus: "VALID",
            reason: "إعادة تسجيل عبر مسح رمز QR",
            adminId: opts.adminId,
          },
        });
      } else {
        attendance = await tx.attendance.create({
          data: {
            invitationId: inv.id,
            activityId: inv.activityId,
            participantId: inv.participantId,
            method: "QR_SCAN",
            recordedAt: now,
            recordedById: opts.adminId,
          },
        });
      }
      await audit(tx, opts.adminId, "attendance.record", "Attendance", attendance.id, { method: "QR_SCAN" });
      return {
        ok: true as const,
        attendanceId: attendance.id,
        participantName: inv.participant.fullName,
        activityTitle: inv.activity.title,
        recordedAt: attendance.recordedAt,
      };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return fail("DUPLICATE", ATTENDANCE_ERRORS.DUPLICATE);
    throw e;
  }
}

/** Explicit, audited correction: void an erroneous attendance. The row and its history are kept. */
export async function voidAttendance(attendanceId: string, adminId: string, reason: string) {
  if (reason.trim().length < 3) throw new Error("REASON_REQUIRED");
  return prisma.$transaction(async (tx) => {
    const att = await tx.attendance.findUniqueOrThrow({ where: { id: attendanceId }, include: { invitation: true } });
    if (att.status === "VOIDED") throw new Error("ALREADY_VOIDED");
    await tx.attendance.update({ where: { id: attendanceId }, data: { status: "VOIDED" } });
    await tx.invitation.update({
      where: { id: att.invitationId },
      data: { status: att.invitation.sentConfirmedAt ? "SENT_CONFIRMED" : "PREPARED" },
    });
    const c = await tx.attendanceCorrection.create({
      data: {
        attendanceId,
        action: "VOID",
        previousStatus: "VALID",
        newStatus: "VOIDED",
        reason: reason.trim(),
        adminId,
      },
    });
    await audit(tx, adminId, "attendance.correct", "Attendance", attendanceId, {
      action: "VOID",
      from: "VALID",
      to: "VOIDED",
    });
    return c;
  });
}

/** Manual attendance for a participant whose QR could not be scanned. Requires a reason; recorded as MANUAL. */
export async function addManualAttendance(invitationId: string, adminId: string, reason: string, now = new Date()) {
  if (reason.trim().length < 3) throw new Error("REASON_REQUIRED");
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId }, include: { attendance: true } });
    if (inv.status === "CANCELLED") throw new Error("REVOKED");
    if (inv.status === "ATTENDED") throw new Error("DUPLICATE");
    const att = inv.attendance
      ? await tx.attendance.update({
          where: { id: inv.attendance.id },
          data: { status: "VALID", method: "MANUAL", recordedAt: now, recordedById: adminId },
        })
      : await tx.attendance.create({
          data: {
            invitationId,
            activityId: inv.activityId,
            participantId: inv.participantId,
            method: "MANUAL",
            recordedAt: now,
            recordedById: adminId,
          },
        });
    await tx.invitation.update({ where: { id: invitationId }, data: { status: "ATTENDED" } });
    await tx.attendanceCorrection.create({
      data: {
        attendanceId: att.id,
        action: "MANUAL_ADD",
        previousStatus: inv.attendance?.status ?? null,
        newStatus: "VALID",
        reason: reason.trim(),
        adminId,
      },
    });
    await audit(tx, adminId, "attendance.correct", "Attendance", att.id, { action: "MANUAL_ADD" });
    return att;
  });
}
