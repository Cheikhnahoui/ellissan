import { hash, verify } from "@node-rs/argon2";

// Argon2id (algorithm 2) with OWASP-recommended minimums.
const OPTS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (pw: string) => hash(pw, OPTS);

export async function verifyPassword(stored: string, pw: string): Promise<boolean> {
  try {
    return await verify(stored, pw);
  } catch {
    return false;
  }
}

/** Used to burn equivalent time when the account does not exist (no user enumeration by timing). */
let dummy: Promise<string> | undefined;
export async function verifyDummy(pw: string) {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(await dummy, pw);
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "كلمة المرور يجب ألا تقل عن 10 أحرف";
  if (pw.length > 200) return "كلمة المرور طويلة جدًا";
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/\d/.test(pw)) return "يجب أن تحتوي كلمة المرور على أحرف وأرقام";
  return null;
}
