import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-for-oauth-state";
});

describe("OAuth state token", () => {
  it("akzeptiert ein gültiges Token für den richtigen Nutzer", async () => {
    const { createOAuthState, verifyOAuthState } = await import("@/lib/oauth-state");
    const token = createOAuthState("user-1");
    expect(verifyOAuthState(token, "user-1")).toBe(true);
  });

  it("lehnt ein Token für einen anderen Nutzer ab", async () => {
    const { createOAuthState, verifyOAuthState } = await import("@/lib/oauth-state");
    const token = createOAuthState("user-1");
    expect(verifyOAuthState(token, "user-2")).toBe(false);
  });

  it("lehnt eine manipulierte Signatur ab", async () => {
    const { createOAuthState, verifyOAuthState } = await import("@/lib/oauth-state");
    const token = createOAuthState("user-1");
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dot = decoded.lastIndexOf(".");
    const tampered = Buffer.from(`${decoded.slice(0, dot)}.deadbeef`).toString("base64url");
    expect(verifyOAuthState(tampered, "user-1")).toBe(false);
  });

  it("lehnt ein abgelaufenes Token ab", async () => {
    const { verifyOAuthState } = await import("@/lib/oauth-state");
    const { createHmac } = await import("node:crypto");
    const payload = `user-1:abc123:${Date.now() - 1000}`;
    const sig = createHmac("sha256", process.env.ENCRYPTION_KEY!).update(payload).digest("hex");
    const expired = Buffer.from(`${payload}.${sig}`).toString("base64url");
    expect(verifyOAuthState(expired, "user-1")).toBe(false);
  });

  it("lehnt ein kaputtes Token ohne Fehler ab", async () => {
    const { verifyOAuthState } = await import("@/lib/oauth-state");
    expect(verifyOAuthState("not-a-valid-token", "user-1")).toBe(false);
  });
});
