import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { deriveQrToken, hashQrToken } from "@/lib/qr-token";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; code: string; message: string };

/** Creates one invitation per selected participant. Existing (participant, activity) pairs are skipped, never duplicated. */
export async function createInvitations(opts: {
  activityId: string;
  participantIds: string[];
  adminId: string;
  qrSecret: string;
}) {
  const ids = [...new Set(opts.participantIds)];
  return prisma.$transaction(async (tx) => {
    const activity = await tx.activity.findUnique({ where: { id: opts.activityId } });
    if (!activity) throw new Error("ACTIVITY_NOT_FOUND");
    const participants = await tx.participant.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      select: { id: true },
    });
    const existing = await tx.invitation.findMany({
      where: { activityId: opts.activityId, participantId: { in: ids } },
      select: { participantId: true },
    });
    const already = new Set(existing.map((e) => e.participantId));
    const toCreate = participants.filter((p) => !already.has(p.id));
    if (toCreate.length) {
      await tx.invitation.createMany({
        data: toCreate.map((p) => {
          const id = randomUUID();
          return {
            id,
            participantId: p.id,
            activityId: opts.activityId,
            qrTokenHash: hashQrToken(deriveQrToken(opts.qrSecret, id, 1)),
            createdById: opts.adminId,
          };
        }),
      });
    }
    await audit(tx, opts.adminId, "invitation.create", "Activity", opts.activityId, {
      created: toCreate.length,
      skippedExisting: already.size,
      skippedInactive: ids.length - participants.length,
    });
    return {
      created: toCreate.length,
      skippedExisting: already.size,
      skippedInactive: ids.length - participants.length,
    };
  });
}

/** Marks the message as prepared. This is NOT a delivery claim. */
export async function markPrepared(invitationId: string, channel: "WHATSAPP" | "EMAIL", adminId: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    if (inv.status === "CANCELLED" || inv.status === "ATTENDED") throw new Error("INVALID_STATE");
    const updated = await tx.invitation.update({
      where: { id: invitationId },
      data: {
        status: inv.status === "SENT_CONFIRMED" ? "SENT_CONFIRMED" : "PREPARED",
        channel,
        preparedAt: new Date(),
      },
    });
    await audit(tx, adminId, "invitation.prepare", "Invitation", invitationId, { channel });
    return updated;
  });
}

/** An administrator manually attests having sent the message. Records who and when. */
export async function confirmSent(invitationId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    if (inv.status !== "PREPARED") throw new Error("INVALID_STATE");
    const updated = await tx.invitation.update({
      where: { id: invitationId },
      data: { status: "SENT_CONFIRMED", sentConfirmedAt: new Date(), sentConfirmedById: adminId },
    });
    await audit(tx, adminId, "invitation.confirm_sent", "Invitation", invitationId);
    return updated;
  });
}

export async function cancelInvitation(invitationId: string, adminId: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    if (inv.status === "ATTENDED") throw new Error("ATTENDANCE_EXISTS");
    const updated = await tx.invitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById: adminId, cancelReason: reason },
    });
    await audit(tx, adminId, "invitation.cancel", "Invitation", invitationId);
    return updated;
  });
}

/** Audited resend: rotates the QR token so any previously shared QR stops working. */
export async function resendInvitation(invitationId: string, adminId: string, qrSecret: string) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    if (inv.status === "CANCELLED" || inv.status === "ATTENDED") throw new Error("INVALID_STATE");
    const version = inv.qrTokenVersion + 1;
    const updated = await tx.invitation.update({
      where: { id: invitationId },
      data: {
        qrTokenVersion: version,
        qrTokenHash: hashQrToken(deriveQrToken(qrSecret, invitationId, version)),
        resendCount: { increment: 1 },
        status: "PREPARED",
        sentConfirmedAt: null,
        sentConfirmedById: null,
      },
    });
    await audit(tx, adminId, "invitation.resend", "Invitation", invitationId, { version });
    return updated;
  });
}
