import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { addManualAttendance, recordAttendanceByToken, voidAttendance } from "@/lib/services/attendance";
import { resetDb, seedActivity, seedAdmin, seedInvitation, seedParticipant } from "./helpers";

beforeEach(resetDb);

async function setup(over = {}) {
  const admin = await seedAdmin();
  const p = await seedParticipant("أحمد محمد", 1);
  const act = await seedActivity(over);
  const { invitation, token } = await seedInvitation(act.id, p.id, admin.id);
  return { admin, p, act, invitation, token };
}

describe("QR attendance", () => {
  it("records a valid scan and returns participant + activity", async () => {
    const { admin, token, act } = await setup();
    const r = await recordAttendanceByToken({ token, adminId: admin.id, expectedActivityId: act.id });
    expect(r).toMatchObject({ ok: true, participantName: "أحمد محمد", activityTitle: "أمسية شعرية" });
    expect((await prisma.invitation.findFirstOrThrow()).status).toBe("ATTENDED");
  });

  it("rejects an invalid token", async () => {
    const { admin } = await setup();
    expect(await recordAttendanceByToken({ token: "nope", adminId: admin.id })).toMatchObject({
      ok: false,
      code: "INVALID_TOKEN",
    });
  });

  it("rejects a token that belongs to another activity", async () => {
    const { admin, token } = await setup();
    const other = await seedActivity({ title: "نشاط آخر" });
    expect(await recordAttendanceByToken({ token, adminId: admin.id, expectedActivityId: other.id })).toMatchObject({
      ok: false,
      code: "WRONG_ACTIVITY",
    });
  });

  it("rejects duplicate scans", async () => {
    const { admin, token } = await setup();
    await recordAttendanceByToken({ token, adminId: admin.id });
    expect(await recordAttendanceByToken({ token, adminId: admin.id })).toMatchObject({ ok: false, code: "DUPLICATE" });
    expect(await prisma.attendance.count()).toBe(1);
  });

  it("rejects after the registration deadline and when the activity is closed", async () => {
    const late = await setup({ closes: new Date(Date.now() - 1000), opens: new Date(Date.now() - 5000) });
    expect(await recordAttendanceByToken({ token: late.token, adminId: late.admin.id })).toMatchObject({
      ok: false,
      code: "WINDOW_ENDED",
    });
    await resetDb();
    const closed = await setup({ status: "CLOSED" });
    expect(await recordAttendanceByToken({ token: closed.token, adminId: closed.admin.id })).toMatchObject({
      ok: false,
      code: "ACTIVITY_CLOSED",
    });
    expect(await prisma.attendance.count()).toBe(0);
  });

  it("rejects before the window opens", async () => {
    const s = await setup({ opens: new Date(Date.now() + 3600_000), closes: new Date(Date.now() + 7200_000) });
    expect(await recordAttendanceByToken({ token: s.token, adminId: s.admin.id })).toMatchObject({
      ok: false,
      code: "NOT_OPEN_YET",
    });
  });

  it("rejects revoked and unprepared invitations", async () => {
    const s = await setup();
    await prisma.invitation.update({ where: { id: s.invitation.id }, data: { status: "CANCELLED" } });
    expect(await recordAttendanceByToken({ token: s.token, adminId: s.admin.id })).toMatchObject({
      ok: false,
      code: "REVOKED",
    });
    await prisma.invitation.update({ where: { id: s.invitation.id }, data: { status: "DRAFT" } });
    expect(await recordAttendanceByToken({ token: s.token, adminId: s.admin.id })).toMatchObject({
      ok: false,
      code: "NOT_PREPARED",
    });
  });

  it("enforces capacity", async () => {
    const admin = await seedAdmin();
    const act = await seedActivity({ capacity: 1 });
    const a = await seedInvitation(act.id, (await seedParticipant("أ", 1)).id, admin.id);
    const b = await seedInvitation(act.id, (await seedParticipant("ب", 2)).id, admin.id);
    expect((await recordAttendanceByToken({ token: a.token, adminId: admin.id })).ok).toBe(true);
    expect(await recordAttendanceByToken({ token: b.token, adminId: admin.id })).toMatchObject({
      ok: false,
      code: "CAPACITY_REACHED",
    });
  });

  it("handles concurrent scans of the same QR: exactly one succeeds", async () => {
    const admin2 = await seedAdmin("b@example.org");
    const { admin, token } = await setup();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => recordAttendanceByToken({ token, adminId: i % 2 ? admin.id : admin2.id })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.code === "DUPLICATE")).toHaveLength(7);
    expect(await prisma.attendance.count()).toBe(1);
  });

  it("DB constraint: same participant cannot be present twice for one activity", async () => {
    const { invitation, admin } = await setup();
    await recordAttendanceByToken({ token: "x", adminId: admin.id });
    const mk = () =>
      prisma.attendance.create({
        data: {
          invitationId: invitation.id,
          activityId: invitation.activityId,
          participantId: invitation.participantId,
          method: "MANUAL",
        },
      });
    await mk();
    await expect(mk()).rejects.toThrow();
  });
});

describe("attendance correction", () => {
  it("voids with an audited reason, keeps the row, and allows a later re-scan", async () => {
    const { admin, token } = await setup();
    const ok = await recordAttendanceByToken({ token, adminId: admin.id });
    if (!ok.ok) throw new Error("setup failed");
    await expect(voidAttendance(ok.attendanceId, admin.id, "")).rejects.toThrow("REASON_REQUIRED");
    await voidAttendance(ok.attendanceId, admin.id, "تم المسح بالخطأ");
    const row = await prisma.attendance.findUniqueOrThrow({
      where: { id: ok.attendanceId },
      include: { corrections: true },
    });
    expect(row.status).toBe("VOIDED");
    expect(row.corrections[0]).toMatchObject({
      action: "VOID",
      previousStatus: "VALID",
      newStatus: "VOIDED",
      reason: "تم المسح بالخطأ",
      adminId: admin.id,
    });
    expect(await prisma.auditEvent.count({ where: { action: "attendance.correct" } })).toBe(1);
    expect((await recordAttendanceByToken({ token, adminId: admin.id })).ok).toBe(true);
    expect(await prisma.attendance.count()).toBe(1);
  });

  it("adds manual attendance with a required reason", async () => {
    const { admin, invitation } = await setup();
    await expect(addManualAttendance(invitation.id, admin.id, " ")).rejects.toThrow("REASON_REQUIRED");
    const att = await addManualAttendance(invitation.id, admin.id, "تعذر مسح الرمز");
    expect(att.method).toBe("MANUAL");
  });
});
