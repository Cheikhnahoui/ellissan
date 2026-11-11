import { prisma } from "@/lib/db";

/**
 * DOCUMENTED RULES
 * - An invitation is "finalized" when it is not CANCELLED and its activity is CLOSED or its registration window has ended.
 * - Attended = finalized invitation with a VALID attendance. Absent = finalized invitation without one.
 * - Rate = attended / finalized * 100. Cancelled invitations and never-invited activities are not in the denominator.
 * - Open (not yet finalized) invitations are reported separately and never counted as absence.
 */
export function attendanceRate(attended: number, finalized: number): number | null {
  return finalized === 0 ? null : Math.round((attended / finalized) * 1000) / 10;
}

export type ParticipantStat = {
  participantId: string;
  fullName: string;
  invitations: number; // non-cancelled
  finalized: number;
  attended: number;
  absent: number;
  pending: number;
  distinctActivities: number;
  rate: number | null;
};

export async function participantStats(
  opts: { from?: Date; to?: Date; now?: Date; participantId?: string } = {},
): Promise<ParticipantStat[]> {
  const now = opts.now ?? new Date();
  const from = opts.from ?? new Date(0);
  const to = opts.to ?? new Date("9999-12-31");
  const rows = await prisma.$queryRaw<
    { participantId: string; fullName: string; invitations: bigint; finalized: bigint; attended: bigint }[]
  >`
    SELECT p.id AS "participantId", p."fullName" AS "fullName",
      COUNT(i.id) FILTER (WHERE i.status <> 'CANCELLED') AS invitations,
      COUNT(i.id) FILTER (WHERE i.status <> 'CANCELLED' AND (a.status = 'CLOSED' OR a."attendanceClosesAt" <= ${now})) AS finalized,
      COUNT(i.id) FILTER (WHERE i.status <> 'CANCELLED' AND (a.status = 'CLOSED' OR a."attendanceClosesAt" <= ${now}) AND att.status = 'VALID') AS attended
    FROM "Participant" p
    JOIN "Invitation" i ON i."participantId" = p.id
    JOIN "Activity" a ON a.id = i."activityId" AND a."startsAt" >= ${from} AND a."startsAt" <= ${to}
    LEFT JOIN "Attendance" att ON att."invitationId" = i.id
    WHERE (${opts.participantId ?? null}::text IS NULL OR p.id = ${opts.participantId ?? null})
    GROUP BY p.id, p."fullName"`;
  return rows.map((r) => {
    const invitations = Number(r.invitations),
      finalized = Number(r.finalized),
      attended = Number(r.attended);
    return {
      participantId: r.participantId,
      fullName: r.fullName,
      invitations,
      finalized,
      attended,
      absent: finalized - attended,
      pending: invitations - finalized,
      distinctActivities: attended, // one valid attendance per activity (unique constraint)
      rate: attendanceRate(attended, finalized),
    };
  });
}

/** Ranking: rate first (only participants with at least `minFinalized` finalized invitations), then attended, then fewer absences. No hidden score. */
export function rankParticipants(stats: ParticipantStat[], minFinalized = 3): ParticipantStat[] {
  return stats
    .filter((s) => s.finalized >= minFinalized && s.rate !== null)
    .sort(
      (a, b) =>
        b.rate! - a.rate! ||
        b.attended - a.attended ||
        a.absent - b.absent ||
        a.fullName.localeCompare(b.fullName, "ar"),
    );
}
