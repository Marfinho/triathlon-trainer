import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { parseBackup, restoreBackup } from "@/lib/backup";

/**
 * POST /api/backup/restore – multipart/form-data mit Feld "backup-json".
 * Schritte: Version -> Zod -> userId-Abgleich -> Transaktion (upsert, Ist/
 * completed unantastbar) -> Ergebnis.
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let raw: unknown;
  try {
    const form = await request.formData();
    const file = form.get("backup-json");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "INVALID_FORMAT", details: "Feld 'backup-json' fehlt." },
        { status: 400 },
      );
    }
    raw = JSON.parse(await file.text());
  } catch {
    return NextResponse.json(
      { error: "INVALID_FORMAT", details: "Datei ist kein gültiges JSON." },
      { status: 400 },
    );
  }

  const parsed = parseBackup(raw);
  if (!parsed.ok) {
    if (parsed.error === "INVALID_FORMAT") {
      return NextResponse.json(
        { error: "INVALID_FORMAT", details: parsed.details },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "VALIDATION_FAILED", issues: parsed.issues },
      { status: 400 },
    );
  }

  if (parsed.backup.userId !== userId) {
    return NextResponse.json({ error: "USER_MISMATCH" }, { status: 400 });
  }

  try {
    const result = await restoreBackup(prisma, userId, parsed.backup);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: "RESTORE_FAILED", details: e instanceof Error ? e.message : "" },
      { status: 500 },
    );
  }
}
