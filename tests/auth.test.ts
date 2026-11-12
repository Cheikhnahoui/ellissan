import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import {
  bootstrapFirstAdmin,
  changeOwnPassword,
  createAdmin,
  login,
  logout,
  setAdminActive,
  validateSession,
  SESSION_TTL_MS,
} from "@/lib/auth/service";
import { resetDb } from "./helpers";

const PW = "كلمة-سر-قوية-123";
beforeEach(resetDb);
async function admin(email = "a@example.org") {
  return prisma.admin.create({ data: { email, name: "مدير", passwordHash: await hashPassword(PW) } });
}

describe("login", () => {
  it("accepts valid credentials, stores only a hash of the session token, and audits", async () => {
    await admin();
    const r = await login("A@Example.org ", PW, "1.1.1.1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const s = await prisma.session.findFirstOrThrow();
    expect(s.tokenHash).not.toBe(r.sessionToken);
    expect((await validateSession(r.sessionToken))?.email).toBe("a@example.org");
    expect(await prisma.auditEvent.count({ where: { action: "auth.login" } })).toBe(1);
  });

  it("rejects wrong password and unknown email with the same generic result", async () => {
    await admin();
    expect(await login("a@example.org", "wrong-password-1", "1.1.1.1")).toEqual({ ok: false, code: "INVALID" });
    expect(await login("nobody@example.org", PW, "1.1.1.1")).toEqual({ ok: false, code: "INVALID" });
  });

  it("locks after 5 failures, even for the correct password, then unlocks after the lock time", async () => {
    await admin();
    const t0 = new Date("2026-01-01T10:00:00Z");
    for (let i = 0; i < 5; i++) await login("a@example.org", "bad-password-1", "2.2.2.2", t0);
    expect(await login("a@example.org", PW, "9.9.9.9", t0)).toEqual({ ok: false, code: "RATE_LIMITED" });
    expect((await login("a@example.org", PW, "9.9.9.9", new Date(t0.getTime() + 16 * 60_000))).ok).toBe(true);
  });

  it("rejects disabled accounts", async () => {
    const a = await admin();
    await prisma.admin.update({ where: { id: a.id }, data: { isActive: false } });
    expect(await login("a@example.org", PW, "1.1.1.1")).toEqual({ ok: false, code: "INVALID" });
  });
});

describe("sessions", () => {
  it("expires, and is invalid after logout", async () => {
    await admin();
    const t0 = new Date();
    const r = await login("a@example.org", PW, "1.1.1.1", t0);
    if (!r.ok) throw new Error();
    expect(await validateSession(r.sessionToken, new Date(t0.getTime() + SESSION_TTL_MS + 1000))).toBeNull();
    expect(await validateSession(r.sessionToken, t0)).not.toBeNull();
    await logout(r.sessionToken);
    expect(await validateSession(r.sessionToken, t0)).toBeNull();
    expect(await validateSession(undefined)).toBeNull();
    expect(await validateSession("garbage")).toBeNull();
  });

  it("deactivating an administrator revokes their sessions immediately", async () => {
    const a = await admin("a@example.org");
    const b = await admin("b@example.org");
    const r = await login("b@example.org", PW, "1.1.1.1");
    if (!r.ok) throw new Error();
    await setAdminActive(a.id, b.id, false);
    expect(await validateSession(r.sessionToken)).toBeNull();
  });

  it("password change invalidates other sessions but keeps the current one", async () => {
    const a = await admin();
    const s1 = await login("a@example.org", PW, "1.1.1.1");
    const s2 = await login("a@example.org", PW, "1.1.1.1");
    if (!s1.ok || !s2.ok) throw new Error();
    await expect(changeOwnPassword(a.id, "wrong", "كلمة-جديدة-456789", s1.sessionToken)).rejects.toThrow(
      "WRONG_PASSWORD",
    );
    await changeOwnPassword(a.id, PW, "كلمة-جديدة-456789", s1.sessionToken);
    expect(await validateSession(s1.sessionToken)).not.toBeNull();
    expect(await validateSession(s2.sessionToken)).toBeNull();
  });
});

describe("administrator management", () => {
  it("bootstrap works once and then is closed", async () => {
    await bootstrapFirstAdmin("first@example.org", "الأول", PW);
    await expect(bootstrapFirstAdmin("second@example.org", "الثاني", PW)).rejects.toThrow(/already exists/);
    expect(await prisma.admin.count()).toBe(1);
  });

  it("bootstrap rejects weak passwords", async () => {
    await expect(bootstrapFirstAdmin("a@example.org", "x", "short1")).rejects.toThrow();
  });

  it("an authenticated administrator can create another; duplicates and weak passwords are rejected; passwords are hashed", async () => {
    const a = await admin();
    const b = await createAdmin(a.id, { email: "NEW@example.org", name: "جديد", password: PW });
    const row = await prisma.admin.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(row.createdById).toBe(a.id);
    await expect(createAdmin(a.id, { email: "new@example.org", name: "x", password: PW })).rejects.toThrow(
      "EMAIL_EXISTS",
    );
    await expect(createAdmin(a.id, { email: "z@example.org", name: "x", password: "weak" })).rejects.toThrow(
      "WEAK_PASSWORD",
    );
    expect(await prisma.auditEvent.count({ where: { action: "admin.create" } })).toBe(1);
  });

  it("protects against self-deactivation and removing the last administrator", async () => {
    const a = await admin("a@example.org");
    const b = await admin("b@example.org");
    await expect(setAdminActive(a.id, a.id, false)).rejects.toThrow("CANNOT_DEACTIVATE_SELF");
    await setAdminActive(a.id, b.id, false);
    await prisma.admin.update({ where: { id: b.id }, data: { isActive: false } });
    await expect(setAdminActive(b.id, a.id, false)).rejects.toThrow();
  });
});
