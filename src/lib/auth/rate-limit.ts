import { prisma } from "@/lib/db";

export const LIMIT = { max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };

export async function isLocked(key: string, now: Date): Promise<boolean> {
  const r = await prisma.rateLimit.findUnique({ where: { key } });
  return !!r?.lockedUntil && r.lockedUntil > now;
}

export async function recordFailure(key: string, now: Date) {
  await prisma.$transaction(async (tx) => {
    const r = await tx.rateLimit.findUnique({ where: { key } });
    const fresh =
      !r || now.getTime() - r.windowStart.getTime() > LIMIT.windowMs || (r.lockedUntil && r.lockedUntil <= now);
    const count = fresh ? 1 : r.count + 1;
    await tx.rateLimit.upsert({
      where: { key },
      create: {
        key,
        count,
        windowStart: now,
        lockedUntil: count >= LIMIT.max ? new Date(now.getTime() + LIMIT.lockMs) : null,
      },
      update: {
        count,
        windowStart: fresh ? now : r.windowStart,
        lockedUntil: count >= LIMIT.max ? new Date(now.getTime() + LIMIT.lockMs) : null,
      },
    });
  });
}

export async function clearFailures(key: string) {
  await prisma.rateLimit.deleteMany({ where: { key } });
}
