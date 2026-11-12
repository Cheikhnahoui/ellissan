import { prisma } from "@/lib/db";
import { registrationState } from "./attendance";
import { participantStats } from "./analytics";

export type HistoryStatus = "ATTENDED" | "ABSENT" | "PENDING" | "CANCELLED";

/** Per-invitation classification. Open activities are PENDING, never ABSENT. Activities the person was never invited to are not listed. */
export async function participantProfile(id: string, now = new Date()) {
  const p = await prisma.participant.findUnique({
    where: { id },
    include: {
      recognitions: { orderBy: { awardedOn: "desc" } },
      invitations: {
        orderBy: { activity: { startsAt: "desc" } },
        include: { activity: true, attendance: true },
      },
    },
  });
  if (!p) return null;
  const history = p.invitations.map((i) => {
    const finalized = ["CLOSED", "WINDOW_ENDED"].includes(registrationState(i.activity, now));
    const status: HistoryStatus =
      i.status === "CANCELLED"
        ? "CANCELLED"
        : i.attendance?.status === "VALID"
          ? "ATTENDED"
          : finalized
            ? "ABSENT"
            : "PENDING";
    return {
      invitationId: i.id,
      activityId: i.activityId,
      title: i.activity.title,
      startsAt: i.activity.startsAt,
      invitedAt: i.createdAt,
      invitationStatus: i.status,
      attendedAt: i.attendance?.status === "VALID" ? i.attendance.recordedAt : null,
      status,
    };
  });
  const [stats] = await participantStats({ participantId: id, now });
  return { participant: p, history, stats: stats ?? null };
}
