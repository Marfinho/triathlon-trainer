import { describe, it, expect, vi } from "vitest";
import { HttpWithingsClient } from "@/integrations/withings/client";

describe("HttpWithingsClient.getActivities", () => {
  it("ruft /v2/measure mit action=getactivity auf (Status 2554 vermeiden)", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ status: 0, body: { activities: [{ date: "2026-11-01", steps: 1000 }], more: false } })),
    );
    const client = new HttpWithingsClient({ accessToken: "t", fetchImpl: fetchImpl as unknown as typeof fetch });
    const res = await client.getActivities(new Date("2026-11-01"), new Date("2026-11-02"));
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url.pathname).toBe("/v2/measure");
    expect(url.searchParams.get("action")).toBe("getactivity");
    expect(res).toHaveLength(1);
  });
});
