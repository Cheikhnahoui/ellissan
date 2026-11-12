import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_TTL_MS, logout, validateSession } from "./service";

export const SESSION_COOKIE = "lisan_session";

export async function setSessionCookie(token: string, expiresAt: Date) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function currentToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentAdmin() {
  return validateSession(await currentToken());
}

/** Server-side authorization: call at the top of every page, server action and route handler that needs an admin. */
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) redirect("/login");
  return admin;
}

export async function destroySession() {
  await logout(await currentToken());
  (await cookies()).delete(SESSION_COOKIE);
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
