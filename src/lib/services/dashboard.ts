import { prisma } from "@/lib/db";
import { attendanceRate, participantStats, rankParticipants } from "./analytics";

/** Every figure is computed from database rows at request time. */
export async function dashboardData(now = new Date()) {
  const [
    participants,
    activities,
    upcoming,
    completed,
    invitations,
    attended,
    recentActivities,
    recentAttendance,
    recognitions,
    recognizedPeople,
    stats,
  ] = await Promise.all([
    prisma.participant.count({ where: { status: "ACTIVE" } }),
    prisma.activity.count(),
    prisma.activity.count({ where: { status: "OPEN", endsAt: { gte: now } } }),
    prisma.activity.count({ where: { OR: [{ status: "CLOSED" }, { endsAt: { lt: now } }] } }),
    prisma.invitation.count(),
    prisma.attendance.count({ where: { status: "VALID" } }),
    prisma.activity.findMany({
      orderBy: { startsAt: "desc" },
      take: 5,
      select: { id: true, title: true, startsAt: true, status: true, endsAt: true },
    }),
    prisma.attendance.findMany({
      where: { status: "VALID" },
      orderBy: { recordedAt: "desc" },
      take: 6,
      select: {
        id: true,
        recordedAt: true,
        method: true,
        participant: { select: { id: true, fullName: true } },
        activity: { select: { id: true, title: true } },
      },
    }),
    prisma.recognition.count(),
    prisma.recognition.groupBy({ by: ["participantId"] }).then((r) => r.length),
    participantStats({ now }),
  ]);
  const finalized = stats.reduce((s, x) => s + x.finalized, 0);
  const finalizedAttended = stats.reduce((s, x) => s + x.attended, 0);
  return {
    participants,
    activities,
    upcoming,
    completed,
    invitations,
    attended,
    overallRate: attendanceRate(finalizedAttended, finalized),
    finalized,
    pendingInvitations: stats.reduce((s, x) => s + x.pending, 0),
    recentActivities,
    recentAttendance,
    recognitions,
    recognizedPeople,
    topEngaged: rankParticipants(stats).slice(0, 5),
  };
}
