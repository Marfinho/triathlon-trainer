import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { geocodeLocation, fetchDailyForecast } from "@/integrations/weather/openMeteo";
import { pickForecastForDate } from "@/domain/training/weather";
import { formatIsoDate } from "@/domain/training/dates";

/**
 * GET /api/races/:id/weather?location=<Name>
 * Liefert die Tagesprognose für das Renndatum. Hat das Rennen noch keine
 * Koordinaten, wird `location` per Open-Meteo-Geocoding aufgelöst und am
 * Rennen gespeichert (Cache für künftige Aufrufe).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  const race = await prisma.raceEvent.findFirst({ where: { id, userId } });
  if (!race) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let lat = race.lat;
  let lon = race.lon;
  let locationName = race.locationName;

  if (lat == null || lon == null) {
    const locationParam = new URL(request.url).searchParams.get("location")?.trim();
    if (!locationParam) {
      return NextResponse.json(
        { ok: false, error: "Kein Standort hinterlegt. Bitte ?location=<Ort> angeben." },
        { status: 400 },
      );
    }
    let geo;
    try {
      geo = await geocodeLocation(locationParam);
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "Geocoding fehlgeschlagen." },
        { status: 502 },
      );
    }
    if (!geo) {
      return NextResponse.json(
        { ok: false, error: `Standort "${locationParam}" nicht gefunden.` },
        { status: 404 },
      );
    }
    lat = geo.lat;
    lon = geo.lon;
    locationName = geo.displayName;
    await prisma.raceEvent.update({
      where: { id },
      data: { lat, lon, locationName },
    });
  }

  let daily;
  try {
    daily = await fetchDailyForecast(lat, lon);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Wetterabruf fehlgeschlagen." },
      { status: 502 },
    );
  }

  const raceDateIso = formatIsoDate(race.date);
  const forecast = pickForecastForDate(daily, raceDateIso);

  return NextResponse.json({
    ok: true,
    locationName,
    lat,
    lon,
    forecast,
    outOfHorizon: forecast === null,
  });
}
