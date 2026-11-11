import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * QR tokens contain no personal data and no database identifiers.
 * token = base64url(HMAC-SHA256(QR_TOKEN_SECRET, invitationId ":" version)) -> 256 bits, unpredictable without the secret.
 * Only SHA-256(token) is stored. Bumping `version` (resend/rotate) invalidates the previous QR.
 */
export function deriveQrToken(secret: string, invitationId: string, version: number): string {
  return createHmac("sha256", secret).update(`${invitationId}:${version}`).digest("base64url");
}

export function hashQrToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
