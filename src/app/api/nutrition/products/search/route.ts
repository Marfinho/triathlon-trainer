import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { requireNutritionConsent } from "@/lib/nutrition-consent";
import { searchProductsByName } from "@/integrations/open-food-facts/client";

/**
 * GET /api/nutrition/products/search?q=... – Produktsuche per Name.
 * Durchsucht zuerst den lokalen Cache (globale + eigene private Produkte),
 * ergänzt dann um Treffer von Open Food Facts (werden bei Auswahl erst über
 * die Barcode-Route bzw. separat persistiert, hier nur zur Anzeige).
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const consent = await requireNutritionConsent(user.userId);
  if (!consent.ok) return consent.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (q.length < 2) {
    return NextResponse.json({ ok: true, local: [], external: [] });
  }

  const local = await prisma.foodProduct.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      OR: [{ createdByUserId: null }, { createdByUserId: user.userId }],
    },
    take: 20,
    orderBy: { name: "asc" },
  });

  let external: Awaited<ReturnType<typeof searchProductsByName>> = [];
  try {
    external = await searchProductsByName(q);
  } catch {
    // Open Food Facts down ist kein Fehler für die lokale Suche.
  }

  const knownEans = new Set(local.map((p) => p.ean).filter(Boolean));
  const externalFiltered = external.filter((hit) => !knownEans.has(hit.code));

  return NextResponse.json({ ok: true, local, external: externalFiltered });
}
