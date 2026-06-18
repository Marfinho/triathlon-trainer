import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";
import { encryptApiKey, decryptApiKey } from "@/lib/crypto";

vi.mock("@/integrations/oauth/providers", async () => {
  const actual = await vi.importActual<typeof import("@/integrations/oauth/providers")>(
    "@/integrations/oauth/providers",
  );
  return {
    ...actual,
    refreshOAuthToken: vi.fn(),
  };
});

import { refreshOAuthToken } from "@/integrations/oauth/providers";
import { refreshExpiringTokens } from "@/integrations/oauth/refreshScheduler";

let db: PrismaClient;
let cleanup: () => Promise<void>;
let userId: string;

beforeAll(() => {
  const ctx = createTestDb();
  db = ctx.db;
  cleanup = ctx.cleanup;
});

afterAll(async () => {
  await cleanup();
});

beforeEach(async () => {
  userId = await resetDb(db);
  vi.mocked(refreshOAuthToken).mockReset();
});

describe("refreshExpiringTokens", () => {
  it("erneuert Tokens, die bald ablaufen", async () => {
    await db.userIntegration.create({
      data: {
        userId,
        provider: "strava",
        apiKey: encryptApiKey("old-access"),
        refreshToken: encryptApiKey("old-refresh"),
        tokenExpiresAt: new Date(Date.now() + 5 * 60_000),
        enabled: true,
      },
    });
    vi.mocked(refreshOAuthToken).mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresAt: new Date(Date.now() + 6 * 60 * 60_000),
      externalId: null,
      scope: "activity:read_all",
    });

    const result = await refreshExpiringTokens(db);
    expect(result).toEqual({ checked: 1, refreshed: 1, failed: 0 });

    const updated = await db.userIntegration.findFirst({ where: { userId } });
    expect(decryptApiKey(updated!.apiKey)).toBe("new-access");
    expect(decryptApiKey(updated!.refreshToken!)).toBe("new-refresh");
  });

  it("lässt Tokens unangetastet, die noch lange gültig sind", async () => {
    await db.userIntegration.create({
      data: {
        userId,
        provider: "strava",
        apiKey: encryptApiKey("old-access"),
        refreshToken: encryptApiKey("old-refresh"),
        tokenExpiresAt: new Date(Date.now() + 6 * 60 * 60_000),
        enabled: true,
      },
    });

    const result = await refreshExpiringTokens(db);
    expect(result).toEqual({ checked: 0, refreshed: 0, failed: 0 });
    expect(refreshOAuthToken).not.toHaveBeenCalled();
  });

  it("isoliert Fehler einer Integration, statt den Lauf abzubrechen", async () => {
    await db.userIntegration.create({
      data: {
        userId,
        provider: "strava",
        apiKey: encryptApiKey("old-access"),
        refreshToken: encryptApiKey("old-refresh"),
        tokenExpiresAt: new Date(Date.now() + 1 * 60_000),
        enabled: true,
      },
    });
    vi.mocked(refreshOAuthToken).mockRejectedValue(new Error("revoked"));

    const result = await refreshExpiringTokens(db);
    expect(result).toEqual({ checked: 1, refreshed: 0, failed: 1 });

    const unchanged = await db.userIntegration.findFirst({ where: { userId } });
    expect(decryptApiKey(unchanged!.apiKey)).toBe("old-access");
  });
});
