import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { buildTcx, type TcxSample } from "@/domain/export/tcx";

/** GET /api/activities/:id/tcx – TCX-Export einer aufgezeichneten Aktivität. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  const { id } = await params;
  const activity = await prisma.actualActivity.findFirst({ where: { id, userId } });
  if (!activity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const samples = Array.isArray(activity.rawJson)
    ? (activity.rawJson as unknown as TcxSample[])
    : null;
  if (!samples || samples.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Keine Sample-Daten für diese Aktivität vorhanden." },
      { status: 400 },
    );
  }

  const xml = buildTcx({ sport: activity.sport, startTime: activity.date, samples });

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.garmin.tcx+xml",
      "Content-Disposition": `attachment; filename="activity-${id}.tcx"`,
    },
  });
}
