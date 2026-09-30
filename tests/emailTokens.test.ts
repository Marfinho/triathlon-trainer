import { describe, it, expect, vi } from "vitest";
import { createEmailToken, consumeEmailToken } from "@/lib/email-tokens";

function fakeDb() {
  const rows: { identifier: string; token: string; expires: Date }[] = [];
  return {
    rows,
    verificationToken: {
      deleteMany: vi.fn(async ({ where }: { where: { identifier?: string; token?: string } }) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (rows[i].identifier === where.identifier || rows[i].token === where.token) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      }),
      create: vi.fn(async ({ data }: { data: (typeof rows)[number] }) => void rows.push(data)),
      findUnique: vi.fn(async ({ where }: { where: { token: string } }) => rows.find((r) => r.token === where.token) ?? null),
    },
  };
}

describe("email tokens", () => {
  it("stores only a hash and is single-use", async () => {
    const db = fakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await createEmailToken("verify", "a@b.de", db as any);
    expect(db.rows[0].token).not.toBe(token);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await consumeEmailToken("verify", token, db as any)).toBe("a@b.de");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await consumeEmailToken("verify", token, db as any)).toBeNull();
  });

  it("rejects wrong purpose and expired tokens", async () => {
    const db = fakeDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const token = await createEmailToken("reset", "a@b.de", db as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await consumeEmailToken("verify", token, db as any)).toBeNull();
    db.rows[0].expires = new Date(Date.now() - 1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await consumeEmailToken("reset", token, db as any)).toBeNull();
  });
});
