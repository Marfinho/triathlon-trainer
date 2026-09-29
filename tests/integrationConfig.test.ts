import { describe, it, expect } from "vitest";
import { INTEGRATION_PROVIDERS, isKnownProvider } from "@/lib/integration-config";

describe("Integration-Provider-Registry", () => {
  it("kennt genau die fünf unterstützten Provider", () => {
    const ids = INTEGRATION_PROVIDERS.map((p) => p.provider).sort();
    expect(ids).toEqual(["intervals", "ollama", "strava", "wahoo", "withings"]);
  });

  it("markiert Intervals.icu und Ollama als API-Key-Integration und die übrigen als OAuth", () => {
    const byId = new Map(INTEGRATION_PROVIDERS.map((p) => [p.provider, p.kind]));
    expect(byId.get("intervals")).toBe("apikey");
    expect(byId.get("ollama")).toBe("apikey");
    expect(byId.get("strava")).toBe("oauth");
    expect(byId.get("wahoo")).toBe("oauth");
    expect(byId.get("withings")).toBe("oauth");
  });

  it("erkennt bekannte und lehnt unbekannte Provider ab", () => {
    expect(isKnownProvider("strava")).toBe(true);
    expect(isKnownProvider("intervals")).toBe(true);
    expect(isKnownProvider("garmin")).toBe(false);
    expect(isKnownProvider("")).toBe(false);
  });
});
