import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  activityStats,
  closeActivity,
  createActivity,
  extendDeadline,
  listActivities,
  reopenActivity,
  updateActivity,
} from "@/lib/services/activities";
import { recordAttendanceByToken } from "@/lib/services/attendance";
import { resetDb, seedActivity, seedAdmin, seedInvitation, seedParticipant } from "./helpers";

beforeEach(resetDb);
const H = 3600_000;
const valid = () => {
  const n = Date.now();
  return {
    title: "ندوة لغوية",
    description: "وصف",
    location: "المركز الثقافي",
    startsAt: new Date(n + 24 * H),
    endsAt: new Date(n + 26 * H),
    capacity: "50",
    attendanceOpensAt: new Date(n + 23 * H),
    attendanceClosesAt: new Date(n + 25 * H),
  };
};

describe("activities", () => {
  it("creates and updates with audit", async () => {
    const a = await seedAdmin();
    const act = await createActivity(a.id, valid());
    expect(act.capacity).toBe(50);
    await updateActivity(a.id, act.id, { ...valid(), title: "عنوان معدل" });
    expect((await prisma.activity.findUniqueOrThrow({ where: { id: act.id } })).title).toBe("عنوان معدل");
    expect(await prisma.auditEvent.count({ where: { targetType: "Activity" } })).toBe(2);
  });

  it("rejects invalid dates and capacity", async () => {
    const a = await seedAdmin();
    const v = valid();
    await expect(createActivity(a.id, { ...v, endsAt: v.startsAt })).rejects.toThrow("وقت النهاية");
    await expect(createActivity(a.id, { ...v, attendanceClosesAt: v.attendanceOpensAt })).rejects.toThrow(
      "إغلاق التسجيل",
    );
    await expect(createActivity(a.id, { ...v, startsAt: "not a date" })).rejects.toThrow();
    await expect(createActivity(a.id, { ...v, capacity: "-3" })).rejects.toThrow();
  });

  it("cannot shrink capacity below recorded attendance", async () => {
    const a = await seedAdmin();
    const act = await seedActivity({ capacity: 5 });
    for (const n of [1, 2]) {
      const i = await seedInvitation(act.id, (await seedParticipant(`مشارك ${n}`, n)).id, a.id);
      expect((await recordAttendanceByToken({ token: i.token, adminId: a.id })).ok).toBe(true);
    }
    await expect(updateActivity(a.id, act.id, { ...valid(), capacity: "1" })).rejects.toThrow("السعة");
    await expect(updateActivity(a.id, act.id, { ...valid(), capacity: "2" })).resolves.toBeTruthy();
  });

  it("manual close blocks scans; reopen with a new deadline restores them; extension rules hold", async () => {
    const a = await seedAdmin();
    const act = await seedActivity();
    const i = await seedInvitation(act.id, (await seedParticipant("أحمد", 1)).id, a.id);
    await closeActivity(a.id, act.id);
    await expect(closeActivity(a.id, act.id)).rejects.toThrow("مغلق");
    expect(await recordAttendanceByToken({ token: i.token, adminId: a.id })).toMatchObject({
      ok: false,
      code: "ACTIVITY_CLOSED",
    });
    await expect(extendDeadline(a.id, act.id, new Date(Date.now() + 5 * H))).rejects.toThrow("مغلق");
    await expect(reopenActivity(a.id, act.id, new Date(Date.now() - H))).rejects.toThrow("المستقبل");
    await reopenActivity(a.id, act.id, new Date(Date.now() + 5 * H));
    expect((await recordAttendanceByToken({ token: i.token, adminId: a.id })).ok).toBe(true);
    await expect(extendDeadline(a.id, act.id, new Date(Date.now()))).rejects.toThrow();
    const cur = (await prisma.activity.findUniqueOrThrow({ where: { id: act.id } })).attendanceClosesAt;
    await extendDeadline(a.id, act.id, new Date(cur.getTime() + H));
    expect(
      await prisma.auditEvent.count({
        where: { action: { in: ["activity.close", "activity.reopen", "activity.extend"] } },
      }),
    ).toBe(3);
  });

  it("an extended deadline re-admits scans after the original window ended", async () => {
    const a = await seedAdmin();
    const act = await seedActivity({ opens: new Date(Date.now() - 3 * H), closes: new Date(Date.now() - 1000) });
    const i = await seedInvitation(act.id, (await seedParticipant("أحمد", 1)).id, a.id);
    expect(await recordAttendanceByToken({ token: i.token, adminId: a.id })).toMatchObject({
      ok: false,
      code: "WINDOW_ENDED",
    });
    await extendDeadline(a.id, act.id, new Date(Date.now() + H));
    expect((await recordAttendanceByToken({ token: i.token, adminId: a.id })).ok).toBe(true);
  });

  it("lists upcoming vs past, searches, and computes stats without calling open invitations absent", async () => {
    const a = await seedAdmin();
    await seedActivity({ title: "قادم", startsAt: new Date(Date.now() + 5 * H) });
    const past = await seedActivity({
      title: "ماضي",
      startsAt: new Date(Date.now() - 30 * H),
      opens: new Date(Date.now() - 31 * H),
      closes: new Date(Date.now() - 20 * H),
    });
    expect((await listActivities({ when: "upcoming" })).items.map((x) => x.title)).toEqual(["قادم"]);
    expect((await listActivities({ when: "past" })).items.map((x) => x.title)).toEqual(["ماضي"]);
    expect((await listActivities({ q: "ماض" })).total).toBe(1);
    await seedInvitation(past.id, (await seedParticipant("أحمد", 1)).id, a.id);
    expect(await activityStats(past.id)).toMatchObject({ finalized: true, invited: 1, attended: 0, absent: 1 });
    const open = await seedActivity({ title: "مفتوح" });
    await seedInvitation(open.id, (await seedParticipant("ب", 2)).id, a.id);
    expect(await activityStats(open.id)).toMatchObject({ finalized: false, invited: 1, absent: null, pending: 1 });
  });
});
