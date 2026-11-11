import { prisma } from "@/lib/db";
import { createInvitations } from "@/lib/services/invitations";
import { deriveQrToken } from "@/lib/qr-token";

export const SECRET = process.env.QR_TOKEN_SECRET!;

export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "AttendanceCorrection","Attendance","Invitation","Recognition","Participant","Activity","AuditEvent","Session","RateLimit","Admin" RESTART IDENTITY CASCADE`,
  );
}

export async function seedAdmin(email = "admin@example.org") {
  return prisma.admin.create({ data: { email, name: "مدير", passwordHash: "x" } });
}

export async function seedParticipant(name: string, n: number) {
  return prisma.participant.create({
    data: {
      fullName: name,
      nameNormalized: name,
      phone: `+2223000${String(n).padStart(4, "0")}`,
      phoneNormalized: `+2223000${String(n).padStart(4, "0")}`,
    },
  });
}

const H = 3600_000;
export async function seedActivity(
  over: Partial<{
    title: string;
    opens: Date;
    closes: Date;
    status: "OPEN" | "CLOSED";
    capacity: number;
    startsAt: Date;
  }> = {},
) {
  const now = Date.now();
  return prisma.activity.create({
    data: {
      title: over.title ?? "أمسية شعرية",
      location: "نواكشوط",
      startsAt: over.startsAt ?? new Date(now + H),
      endsAt: new Date((over.startsAt?.getTime() ?? now + H) + 2 * H),
      attendanceOpensAt: over.opens ?? new Date(now - H),
      attendanceClosesAt: over.closes ?? new Date(now + 2 * H),
      status: over.status ?? "OPEN",
      capacity: over.capacity,
    },
  });
}

/** Creates a prepared invitation and returns the QR token that would be shown to the admin. */
export async function seedInvitation(activityId: string, participantId: string, adminId: string, prepared = true) {
  await createInvitations({ activityId, participantIds: [participantId], adminId, qrSecret: SECRET });
  const inv = await prisma.invitation.findUniqueOrThrow({
    where: { participantId_activityId: { participantId, activityId } },
  });
  if (prepared)
    await prisma.invitation.update({
      where: { id: inv.id },
      data: { status: "PREPARED", channel: "WHATSAPP", preparedAt: new Date() },
    });
  return { invitation: inv, token: deriveQrToken(SECRET, inv.id, inv.qrTokenVersion) };
}
