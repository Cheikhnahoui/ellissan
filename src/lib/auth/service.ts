import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { normalizeEmail } from "@/lib/normalize";
import { hashPassword, passwordProblem, verifyDummy, verifyPassword } from "./password";
import { clearFailures, isLocked, recordFailure } from "./rate-limit";

export const SESSION_TTL_MS = 8 * 3600_000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export type LoginResult =
  | { ok: true; adminId: string; sessionToken: string; expiresAt: Date }
  | { ok: false; code: "INVALID" | "RATE_LIMITED" };

/** Generic failure on purpose: never reveals whether the email exists or the account is disabled. */
export async function login(email: string, password: string, ip: string, now = new Date()): Promise<LoginResult> {
  const e = normalizeEmail(email) ?? "invalid";
  const keys = [`login:email:${e}`, `login:ip:${ip}`];
  for (const k of keys) if (await isLocked(k, now)) return { ok: false, code: "RATE_LIMITED" };

  const admin = await prisma.admin.findUnique({ where: { email: e } });
  const valid = admin ? await verifyPassword(admin.passwordHash, password) : (await verifyDummy(password), false);
  if (!admin || !valid || !admin.isActive) {
    for (const k of keys) await recordFailure(k, now);
    return { ok: false, code: "INVALID" };
  }
  await clearFailures(keys[0]);
  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.session.create({ data: { tokenHash: sha(sessionToken), adminId: admin.id, expiresAt } });
    await tx.session.deleteMany({ where: { expiresAt: { lt: now } } }); // opportunistic cleanup
    await audit(tx, admin.id, "auth.login", "Admin", admin.id);
  });
  return { ok: true, adminId: admin.id, sessionToken, expiresAt };
}

export async function validateSession(token: string | undefined, now = new Date()) {
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { tokenHash: sha(token) },
    include: { admin: { select: { id: true, email: true, name: true, isActive: true } } },
  });
  if (!s || s.expiresAt <= now || !s.admin.isActive) return null;
  return s.admin;
}

export async function logout(token: string | undefined) {
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha(token) } });
}

/** First administrator: only callable from the CLI (scripts/create-admin.ts), refuses if any admin exists. */
export async function bootstrapFirstAdmin(email: string, name: string, password: string) {
  const e = normalizeEmail(email);
  if (!e) throw new Error("بريد إلكتروني غير صالح");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const passwordHash = await hashPassword(password);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`LOCK TABLE "Admin" IN EXCLUSIVE MODE`;
    if ((await tx.admin.count()) > 0) throw new Error("An administrator already exists; bootstrap is disabled.");
    const a = await tx.admin.create({ data: { email: e, name, passwordHash } });
    await audit(tx, a.id, "admin.bootstrap", "Admin", a.id);
    return a;
  });
}

export async function createAdmin(actorId: string, input: { email: string; name: string; password: string }) {
  const e = normalizeEmail(input.email);
  if (!e) throw new Error("INVALID_EMAIL");
  if (passwordProblem(input.password)) throw new Error("WEAK_PASSWORD");
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    if (await tx.admin.findUnique({ where: { email: e } })) throw new Error("EMAIL_EXISTS");
    const a = await tx.admin.create({
      data: { email: e, name: input.name.trim(), passwordHash, createdById: actorId },
    });
    await audit(tx, actorId, "admin.create", "Admin", a.id);
    return { id: a.id, email: a.email, name: a.name };
  });
}

/** Deactivating revokes every session immediately. An admin cannot deactivate themself, and the last active admin is protected. */
export async function setAdminActive(actorId: string, targetId: string, active: boolean) {
  return prisma.$transaction(async (tx) => {
    if (!active) {
      if (actorId === targetId) throw new Error("CANNOT_DEACTIVATE_SELF");
      const others = await tx.admin.count({ where: { isActive: true, id: { not: targetId } } });
      if (others === 0) throw new Error("LAST_ADMIN");
    }
    await tx.admin.update({ where: { id: targetId }, data: { isActive: active } });
    if (!active) await tx.session.deleteMany({ where: { adminId: targetId } });
    await audit(tx, actorId, active ? "admin.activate" : "admin.deactivate", "Admin", targetId);
  });
}

export async function changeOwnPassword(adminId: string, current: string, next: string, keepToken?: string) {
  if (passwordProblem(next)) throw new Error("WEAK_PASSWORD");
  const a = await prisma.admin.findUniqueOrThrow({ where: { id: adminId } });
  if (!(await verifyPassword(a.passwordHash, current))) throw new Error("WRONG_PASSWORD");
  const passwordHash = await hashPassword(next);
  await prisma.$transaction(async (tx) => {
    await tx.admin.update({ where: { id: adminId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { adminId, ...(keepToken ? { tokenHash: { not: sha(keepToken) } } : {}) } });
    await audit(tx, adminId, "admin.password_change", "Admin", adminId);
  });
}
