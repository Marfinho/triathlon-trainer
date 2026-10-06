import { prisma } from "@/lib/db";
import { activityCreateData, parseActivityInput } from "@/lib/activity-input";
import { requireDevice, deviceJson } from "@/lib/device/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2_000_000;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * POST /api/tv/activities – Upload einer auf dem Fernseher aufgezeichneten
 * Einheit. Idempotent über `clientId` (die App sendet nach Netzausfall erneut):
 * ein zweiter Upload mit derselben clientId liefert die bestehende id zurück.
 */
export async function POST(request: Request) {
  const { device, response } = await requireDevice(request);
  if (response) return response;

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return deviceJson(413, { ok: false, error: "Body zu groß." });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return deviceJson(400, { ok: false, error: "Ungültiger Body." });
  }
  const clientId = (body as { clientId?: unknown } | null)?.clientId;
  if (typeof clientId !== "string" || !CLIENT_ID_RE.test(clientId)) {
    return deviceJson(400, { ok: false, error: "clientId fehlt oder ist ungültig." });
  }
  const parsed = parseActivityInput(body);
  if (!parsed.ok) return deviceJson(400, { ok: false, error: parsed.error });

  const source = "brick-tv";
  const existing = await prisma.actualActivity.findFirst({
    where: { userId: device.userId, source, externalId: clientId },
    select: { id: true },
  });
  if (existing) return deviceJson(200, { ok: true, id: existing.id, duplicate: true });

  try {
    const created = await prisma.actualActivity.create({
      data: activityCreateData(device.userId, parsed.input, { source, externalId: clientId }),
    });
    return deviceJson(201, { ok: true, id: created.id, duplicate: false });
  } catch (e) {
    // Paralleler Doppel-Upload: Unique (userId, source, externalId) greift.
    if ((e as { code?: string }).code === "P2002") {
      const row = await prisma.actualActivity.findFirst({
        where: { userId: device.userId, source, externalId: clientId },
        select: { id: true },
      });
      if (row) return deviceJson(200, { ok: true, id: row.id, duplicate: true });
    }
    throw e;
  }
}
