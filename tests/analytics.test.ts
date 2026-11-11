import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { attendanceRate, participantStats, rankParticipants } from "@/lib/services/analytics";
import { recordAttendanceByToken } from "@/lib/services/attendance";
import { resetDb, seedActivity, seedAdmin, seedInvitation, seedParticipant } from "./helpers";

beforeEach(resetDb);
const DAY = 86400_000;

describe("attendance rate", () => {
  it("is attended / finalized, null when nothing is finalized", () => {
    expect(attendanceRate(3, 4)).toBe(75);
    expect(attendanceRate(0, 0)).toBeNull();
  });

  it("excludes cancelled, not-invited and still-open invitations", async () => {
    const admin = await seedAdmin();
    const p = await seedParticipant("أحمد", 1);
    const stranger = await seedParticipant("لم يُدعَ", 2);
    const past = (n: number) => ({
      opens: new Date(Date.now() - n * DAY - 3600_000),
      closes: new Date(Date.now() - n * DAY),
      startsAt: new Date(Date.now() - n * DAY - 1800_000),
    });

    const a1 = await seedActivity({ title: "حضر", ...past(10) });
    const a2 = await seedActivity({ title: "غاب", ...past(8) });
    const a3 = await seedActivity({ title: "ملغاة", ...past(6) });
    const a4 = await seedActivity({ title: "ما زال مفتوحًا" });
    await seedActivity({ title: "لم يُدعَ إليه", ...past(4) });

    const i1 = await seedInvitation(a1.id, p.id, admin.id);
    await seedInvitation(a2.id, p.id, admin.id);
    const i3 = await seedInvitation(a3.id, p.id, admin.id);
    await seedInvitation(a4.id, p.id, admin.id);
    // record attendance for the past activity while its window was open
    await recordAttendanceByToken({
      token: i1.token,
      adminId: admin.id,
      now: new Date(Date.now() - 10 * DAY - 1800_000),
    });
    await prisma.invitation.update({ where: { id: i3.invitation.id }, data: { status: "CANCELLED" } });

    const [s] = await participantStats({ participantId: p.id });
    expect(s).toMatchObject({ invitations: 3, finalized: 2, attended: 1, absent: 1, pending: 1, rate: 50 });
    expect(await participantStats({ participantId: stranger.id })).toEqual([]);
  });

  it("filters by activity date range", async () => {
    const admin = await seedAdmin();
    const p = await seedParticipant("أحمد", 1);
    const old = await seedActivity({
      title: "قديم",
      startsAt: new Date(Date.now() - 100 * DAY),
      opens: new Date(Date.now() - 101 * DAY),
      closes: new Date(Date.now() - 99 * DAY),
    });
    const recent = await seedActivity({
      title: "حديث",
      startsAt: new Date(Date.now() - 5 * DAY),
      opens: new Date(Date.now() - 6 * DAY),
      closes: new Date(Date.now() - 4 * DAY),
    });
    await seedInvitation(old.id, p.id, admin.id);
    await seedInvitation(recent.id, p.id, admin.id);
    const [all] = await participantStats({ participantId: p.id });
    const [ranged] = await participantStats({ participantId: p.id, from: new Date(Date.now() - 30 * DAY) });
    expect(all.finalized).toBe(2);
    expect(ranged.finalized).toBe(1);
  });
});

describe("ranking", () => {
  const mk = (name: string, finalized: number, attended: number) => ({
    participantId: name,
    fullName: name,
    invitations: finalized,
    finalized,
    attended,
    absent: finalized - attended,
    pending: 0,
    distinctActivities: attended,
    rate: attendanceRate(attended, finalized),
  });

  it("ranks by rate, not raw count, and ignores participants below the minimum sample", () => {
    const ranked = rankParticipants([
      mk("كثير الدعوات", 20, 15),
      mk("منتظم", 4, 4),
      mk("جديد", 1, 1),
      mk("متوسط", 10, 9),
    ]);
    expect(ranked.map((r) => r.fullName)).toEqual(["منتظم", "متوسط", "كثير الدعوات"]);
  });

  it("breaks ties by attended count then absences", () => {
    expect(rankParticipants([mk("ب", 4, 4), mk("أ", 8, 8)]).map((r) => r.fullName)).toEqual(["أ", "ب"]);
  });
});
