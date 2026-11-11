import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  cancelInvitation,
  confirmSent,
  createInvitations,
  markPrepared,
  resendInvitation,
} from "@/lib/services/invitations";
import { deriveQrToken, hashQrToken } from "@/lib/qr-token";
import { SECRET, resetDb, seedActivity, seedAdmin, seedParticipant } from "./helpers";

beforeEach(resetDb);

describe("invitations", () => {
  it("creates one invitation per selected participant and never duplicates", async () => {
    const admin = await seedAdmin();
    const act = await seedActivity();
    const ps = await Promise.all([1, 2, 3].map((i) => seedParticipant(`مشارك ${i}`, i)));
    const ids = ps.map((p) => p.id);
    expect(
      await createInvitations({ activityId: act.id, participantIds: ids, adminId: admin.id, qrSecret: SECRET }),
    ).toMatchObject({ created: 3 });
    expect(
      await createInvitations({ activityId: act.id, participantIds: ids, adminId: admin.id, qrSecret: SECRET }),
    ).toMatchObject({ created: 0, skippedExisting: 3 });
    expect(await prisma.invitation.count()).toBe(3);
  });

  it("gives every invitation a distinct QR token, including across activities", async () => {
    const admin = await seedAdmin();
    const p = await seedParticipant("أحمد", 1);
    const acts = await Promise.all([
      seedActivity({ title: "1" }),
      seedActivity({ title: "2" }),
      seedActivity({ title: "3" }),
    ]);
    for (const a of acts)
      await createInvitations({ activityId: a.id, participantIds: [p.id], adminId: admin.id, qrSecret: SECRET });
    const invs = await prisma.invitation.findMany();
    expect(new Set(invs.map((i) => i.qrTokenHash)).size).toBe(3);
    for (const i of invs) expect(i.qrTokenHash).toBe(hashQrToken(deriveQrToken(SECRET, i.id, 1)));
  });

  it("skips archived participants", async () => {
    const admin = await seedAdmin();
    const act = await seedActivity();
    const p = await seedParticipant("مؤرشف", 1);
    await prisma.participant.update({ where: { id: p.id }, data: { status: "ARCHIVED" } });
    expect(
      await createInvitations({ activityId: act.id, participantIds: [p.id], adminId: admin.id, qrSecret: SECRET }),
    ).toMatchObject({ created: 0, skippedInactive: 1 });
  });

  it("keeps status honest: prepared is not sent; confirm records who and when; resend rotates the QR", async () => {
    const admin = await seedAdmin();
    const act = await seedActivity();
    const p = await seedParticipant("أحمد", 1);
    await createInvitations({ activityId: act.id, participantIds: [p.id], adminId: admin.id, qrSecret: SECRET });
    const inv = await prisma.invitation.findFirstOrThrow();
    expect(inv.status).toBe("DRAFT");
    await expect(confirmSent(inv.id, admin.id)).rejects.toThrow("INVALID_STATE");
    expect((await markPrepared(inv.id, "WHATSAPP", admin.id)).status).toBe("PREPARED");
    const sent = await confirmSent(inv.id, admin.id);
    expect(sent).toMatchObject({ status: "SENT_CONFIRMED", sentConfirmedById: admin.id });
    expect(sent.sentConfirmedAt).toBeInstanceOf(Date);
    const re = await resendInvitation(inv.id, admin.id, SECRET);
    expect(re.qrTokenHash).not.toBe(inv.qrTokenHash);
    expect(re.status).toBe("PREPARED");
  });

  it("cancelled invitations cannot be prepared again", async () => {
    const admin = await seedAdmin();
    const act = await seedActivity();
    const p = await seedParticipant("أحمد", 1);
    await createInvitations({ activityId: act.id, participantIds: [p.id], adminId: admin.id, qrSecret: SECRET });
    const inv = await prisma.invitation.findFirstOrThrow();
    await cancelInvitation(inv.id, admin.id, "خطأ");
    await expect(markPrepared(inv.id, "EMAIL", admin.id)).rejects.toThrow("INVALID_STATE");
  });

  it("archiving a participant keeps history; deleting one with history is blocked by the DB", async () => {
    const admin = await seedAdmin();
    const act = await seedActivity();
    const p = await seedParticipant("أحمد", 1);
    await createInvitations({ activityId: act.id, participantIds: [p.id], adminId: admin.id, qrSecret: SECRET });
    await prisma.participant.update({ where: { id: p.id }, data: { status: "ARCHIVED", archivedAt: new Date() } });
    expect(await prisma.invitation.count({ where: { participantId: p.id } })).toBe(1);
    await expect(prisma.participant.delete({ where: { id: p.id } })).rejects.toThrow();
  });
});
