import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { activitySchema } from "@/lib/validation";
import { registrationState } from "./attendance";
import type { Prisma } from "@/generated/prisma/client";

export class ActivityError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type ActivityInput = Record<string, unknown>;

export function parseActivity(input: ActivityInput) {
  const r = activitySchema.safeParse(input);
  if (!r.success) throw new ActivityError("VALIDATION", r.error.issues[0].message);
  return r.data;
}

export async function createActivity(adminId: string, input: ActivityInput) {
  const d = parseActivity(input);
  return prisma.$transaction(async (tx) => {
    const a = await tx.activity.create({ data: { ...d, createdById: adminId } });
    await audit(tx, adminId, "activity.create", "Activity", a.id);
    return a;
  });
}

export async function updateActivity(adminId: string, id: string, input: ActivityInput) {
  const d = parseActivity(input);
  return prisma.$transaction(async (tx) => {
    if (d.capacity != null) {
      const n = await tx.attendance.count({ where: { activityId: id, status: "VALID" } });
      if (d.capacity < n) throw new ActivityError("CAPACITY", `السعة أقل من عدد الحضور المسجل (${n})`);
    }
    const a = await tx.activity.update({ where: { id }, data: d });
    await audit(tx, adminId, "activity.update", "Activity", id);
    return a;
  });
}

export async function closeActivity(adminId: string, id: string) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.activity.findUniqueOrThrow({ where: { id } });
    if (a.status === "CLOSED") throw new ActivityError("ALREADY_CLOSED", "النشاط مغلق مسبقًا");
    await tx.activity.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), closedById: adminId } });
    await audit(tx, adminId, "activity.close", "Activity", id);
  });
}

export async function reopenActivity(adminId: string, id: string, newClosesAt: Date, now = new Date()) {
  if (newClosesAt <= now) throw new ActivityError("DEADLINE", "موعد الإغلاق الجديد يجب أن يكون في المستقبل");
  return prisma.$transaction(async (tx) => {
    const a = await tx.activity.findUniqueOrThrow({ where: { id } });
    if (a.status !== "CLOSED") throw new ActivityError("NOT_CLOSED", "النشاط ليس مغلقًا");
    await tx.activity.update({
      where: { id },
      data: { status: "OPEN", closedAt: null, closedById: null, attendanceClosesAt: newClosesAt },
    });
    await audit(tx, adminId, "activity.reopen", "Activity", id, { newClosesAt: newClosesAt.toISOString() });
  });
}

export async function extendDeadline(adminId: string, id: string, newClosesAt: Date, now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const a = await tx.activity.findUniqueOrThrow({ where: { id } });
    if (a.status === "CLOSED") throw new ActivityError("CLOSED", "النشاط مغلق؛ أعد فتحه أولًا");
    if (newClosesAt <= a.attendanceClosesAt)
      throw new ActivityError("DEADLINE", "الموعد الجديد يجب أن يكون بعد الموعد الحالي");
    if (newClosesAt <= now) throw new ActivityError("DEADLINE", "الموعد الجديد يجب أن يكون في المستقبل");
    await tx.activity.update({ where: { id }, data: { attendanceClosesAt: newClosesAt } });
    await audit(tx, adminId, "activity.extend", "Activity", id, {
      from: a.attendanceClosesAt.toISOString(),
      to: newClosesAt.toISOString(),
    });
  });
}

export async function listActivities(
  opts: { q?: string; when?: "upcoming" | "past" | "all"; page?: number; pageSize?: number; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(100, opts.pageSize ?? 20);
  const where: Prisma.ActivityWhereInput = {
    ...(opts.q
      ? {
          OR: [
            { title: { contains: opts.q, mode: "insensitive" } },
            { location: { contains: opts.q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(opts.when === "upcoming" ? { endsAt: { gte: now } } : opts.when === "past" ? { endsAt: { lt: now } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      orderBy: { startsAt: opts.when === "past" ? "desc" : "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { _count: { select: { invitations: true } } },
    }),
  ]);
  const attended = await prisma.attendance.groupBy({
    by: ["activityId"],
    where: { status: "VALID", activityId: { in: rows.map((r) => r.id) } },
    _count: true,
  });
  const map = new Map(attended.map((a) => [a.activityId, a._count]));
  return {
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((r) => ({
      ...r,
      invitationCount: r._count.invitations,
      attendedCount: map.get(r.id) ?? 0,
      registration: registrationState(r, now),
    })),
  };
}

export async function activityStats(id: string, now = new Date()) {
  const a = await prisma.activity.findUniqueOrThrow({ where: { id } });
  const [byStatus, attended] = await Promise.all([
    prisma.invitation.groupBy({ by: ["status"], where: { activityId: id }, _count: true }),
    prisma.attendance.count({ where: { activityId: id, status: "VALID" } }),
  ]);
  const c = Object.fromEntries(byStatus.map((s) => [s.status, s._count])) as Record<string, number>;
  const valid = (c.DRAFT ?? 0) + (c.PREPARED ?? 0) + (c.SENT_CONFIRMED ?? 0) + (c.ATTENDED ?? 0);
  const state = registrationState(a, now);
  const finalized = state === "CLOSED" || state === "WINDOW_ENDED";
  return {
    activity: a,
    registration: state,
    finalized,
    invited: valid,
    cancelled: c.CANCELLED ?? 0,
    attended,
    absent: finalized ? valid - attended : null,
    pending: finalized ? 0 : valid - attended,
  };
}
