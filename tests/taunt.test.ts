import { describe, it, expect } from "vitest";
import { pickTaunt, blockedResponse } from "@/lib/security/taunt";

describe("pickTaunt", () => {
  it("liefert immer einen nicht-leeren String", () => {
    for (let i = 0; i < 20; i++) {
      expect(pickTaunt().length).toBeGreaterThan(0);
    }
  });
});

describe("blockedResponse", () => {
  it("setzt Status, X-Nice-Try-Header und einen taunt im Body", async () => {
    const res = blockedResponse({ error: "Forbidden" }, 403);
    expect(res.status).toBe(403);
    expect(res.headers.get("X-Nice-Try")).toBe("true");
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
    expect(typeof body.taunt).toBe("string");
    expect(body.taunt.length).toBeGreaterThan(0);
  });

  it("erlaubt zusätzliche Header über init", async () => {
    const res = blockedResponse({ error: "TOO_MANY_REQUESTS" }, 429, {
      headers: { "Retry-After": "30" },
    });
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(res.headers.get("X-Nice-Try")).toBe("true");
  });
});
