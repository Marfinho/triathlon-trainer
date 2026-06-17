import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Signiertes, kurzlebiges State-Token für OAuth-Redirects (CSRF-Schutz).
 * Format: base64url(`${userId}:${nonce}:${exp}.${hmac}`)
 */
const STATE_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const s = process.env.ENCRYPTION_KEY ?? "";
  if (!s) throw new Error("ENCRYPTION_KEY ist nicht gesetzt.");
  return s;
}

export function createOAuthState(userId: string): string {
  const nonce = randomBytes(8).toString("hex");
  const exp = Date.now() + STATE_TTL_MS;
  const payload = `${userId}:${nonce}:${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/** Prüft Signatur, Ablauf und dass das Token zur aktuellen Session-userId passt. */
export function verifyOAuthState(token: string, userId: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dot = decoded.lastIndexOf(".");
    if (dot === -1) return false;
    const payload = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    const expected = createHmac("sha256", secret()).update(payload).digest("hex");
    if (sig.length !== expected.length) return false;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;

    const [stateUserId, , expStr] = payload.split(":");
    if (stateUserId !== userId) return false;
    return Date.now() < Number(expStr);
  } catch {
    return false;
  }
}
