import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createTestDb, resetDb } from "./helpers/testDb";

const { mockAuth, mockFetchByEan, mockSearchByName } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFetchByEan: vi.fn(),
  mockSearchByName: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: mockAuth }));
vi.mock("@/integrations/open-food-facts/client", () => ({
  fetchProductByEan: mockFetchByEan,
  searchProductsByName: mockSearchByName,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/localhub_test";
  return { prisma: new PrismaClient({ datasourceUrl: url }) };
});

import { GET as barcodeGet } from "@/app/api/nutrition/products/barcode/[ean]/route";
import { GET as searchGet } from "@/app/api/nutrition/products/search/route";
import { POST as manualPost } from "@/app/api/nutrition/products/manual/route";
import { PUT as verifyPut } from "@/app/api/nutrition/products/[id]/verify/route";
import { POST as grantConsent } from "@/app/api/nutrition/consent/route";

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
  // Globale FoodProduct-Einträge (createdByUserId: null) hängen an keinem
  // User und werden daher NICHT durch die User-Cascade in resetDb entfernt.
  await db.foodProduct.deleteMany();
  mockAuth.mockReset();
  mockAuth.mockResolvedValue({ user: { id: userId } });
  mockFetchByEan.mockReset();
  mockSearchByName.mockReset();
  await grantConsent();
});

describe("GET /api/nutrition/products/barcode/:ean", () => {
  it("lehnt ungültige EANs mit 400 ab", async () => {
    const res = await barcodeGet(new Request("http://x"), { params: Promise.resolve({ ean: "abc" }) });
    expect(res.status).toBe(400);
  });

  it("liefert einen Treffer aus dem lokalen Cache, ohne Open Food Facts zu rufen", async () => {
    await db.foodProduct.create({
      data: { ean: "4001686308207", name: "Cachetreffer", kcalPer100g: 100, source: "open_food_facts" },
    });
    const res = await barcodeGet(new Request("http://x"), {
      params: Promise.resolve({ ean: "4001686308207" }),
    });
    const body = await res.json();
    expect(body.source).toBe("cache");
    expect(body.product.name).toBe("Cachetreffer");
    expect(mockFetchByEan).not.toHaveBeenCalled();
  });

  it("fragt Open Food Facts ab und cached den Treffer bei Cache-Miss", async () => {
    mockFetchByEan.mockResolvedValue({
      ean: "4001686308207",
      name: "Neuer Treffer",
      brand: null,
      kcalPer100g: 250,
      proteinGPer100g: null,
      carbsGPer100g: null,
      fatGPer100g: null,
      servingSizeG: null,
    });
    const res = await barcodeGet(new Request("http://x"), {
      params: Promise.resolve({ ean: "4001686308207" }),
    });
    const body = await res.json();
    expect(body.source).toBe("open_food_facts");
    expect(body.product.name).toBe("Neuer Treffer");
    expect(await db.foodProduct.count()).toBe(1);
  });

  it("liefert 404, wenn Open Food Facts nichts findet", async () => {
    mockFetchByEan.mockResolvedValue(null);
    const res = await barcodeGet(new Request("http://x"), {
      params: Promise.resolve({ ean: "4001686308207" }),
    });
    expect(res.status).toBe(404);
  });

  it("liefert 502, wenn Open Food Facts nicht erreichbar ist", async () => {
    mockFetchByEan.mockRejectedValue(new Error("network"));
    const res = await barcodeGet(new Request("http://x"), {
      params: Promise.resolve({ ean: "4001686308207" }),
    });
    expect(res.status).toBe(502);
  });
});

describe("GET /api/nutrition/products/search", () => {
  it("liefert leere Listen für zu kurze Suchbegriffe, ohne externe Suche", async () => {
    const res = await searchGet(new Request("http://x/api/nutrition/products/search?q=a"));
    const body = await res.json();
    expect(body.local).toEqual([]);
    expect(body.external).toEqual([]);
    expect(mockSearchByName).not.toHaveBeenCalled();
  });

  it("kombiniert lokale und externe Treffer, dedupliziert per EAN", async () => {
    await db.foodProduct.create({
      data: { ean: "1111111111111", name: "Apfelmus lokal", kcalPer100g: 60, source: "manual" },
    });
    mockSearchByName.mockResolvedValue([
      { code: "1111111111111", name: "Apfelmus lokal", kcalPer100g: 60, ean: "1111111111111" },
      { code: "2222222222222", name: "Apfelmus extern", kcalPer100g: 65, ean: "2222222222222" },
    ]);
    const res = await searchGet(new Request("http://x/api/nutrition/products/search?q=apfel"));
    const body = await res.json();
    expect(body.local).toHaveLength(1);
    expect(body.external).toHaveLength(1);
    expect(body.external[0].code).toBe("2222222222222");
  });

  it("liefert lokale Treffer auch, wenn Open Food Facts down ist", async () => {
    await db.foodProduct.create({
      data: { name: "Apfelmus lokal", kcalPer100g: 60, source: "manual" },
    });
    mockSearchByName.mockRejectedValue(new Error("network"));
    const res = await searchGet(new Request("http://x/api/nutrition/products/search?q=apfel"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.local).toHaveLength(1);
    expect(body.external).toEqual([]);
  });
});

describe("POST /api/nutrition/products/manual", () => {
  it("legt ein privates Produkt an", async () => {
    const res = await manualPost(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "Eigene Müsliriegel", kcalPer100g: 400 }) }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product.createdByUserId).toBe(userId);
    expect(body.product.source).toBe("manual");
  });

  it("lehnt fehlenden Namen oder negative kcal ab", async () => {
    const res = await manualPost(
      new Request("http://x", { method: "POST", body: JSON.stringify({ name: "", kcalPer100g: 400 }) }),
    );
    expect(res.status).toBe(400);
  });
});

describe("PUT /api/nutrition/products/:id/verify", () => {
  it("korrigiert ein Produkt und schreibt einen Audit-Log-Eintrag", async () => {
    const product = await db.foodProduct.create({
      data: { name: "Falscher Wert", kcalPer100g: 1000, source: "open_food_facts" },
    });
    const res = await verifyPut(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ kcalPer100g: 250 }) }),
      { params: Promise.resolve({ id: product.id }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.product.kcalPer100g).toBe(250);
    expect(body.product.verified).toBe(true);
    expect(body.product.verifiedByUserId).toBe(userId);

    const audit = await db.auditLog.findFirst({
      where: { action: "nutrition_product_corrected" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect((audit?.meta as { productId?: string })?.productId).toBe(product.id);
  });

  it("liefert 404 für unbekannte Produkte", async () => {
    const res = await verifyPut(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ kcalPer100g: 250 }) }),
      { params: Promise.resolve({ id: "does-not-exist" }) },
    );
    expect(res.status).toBe(404);
  });

  it("lehnt negative kcal ab", async () => {
    const product = await db.foodProduct.create({
      data: { name: "X", kcalPer100g: 100, source: "manual" },
    });
    const res = await verifyPut(
      new Request("http://x", { method: "PUT", body: JSON.stringify({ kcalPer100g: -5 }) }),
      { params: Promise.resolve({ id: product.id }) },
    );
    expect(res.status).toBe(400);
  });
});
