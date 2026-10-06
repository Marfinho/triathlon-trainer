import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guard";
import { recordAudit } from "@/lib/audit";
import { listDeviceTokens, revokeDeviceToken } from "@/lib/device/flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/device/tokens – eigene gekoppelte Geräte. */
export async function GET() {
  const { user, response } = await requireUser();
  if (response) return response;
  return NextResponse.json({ devices: await listDeviceTokens(user.userId) });
}

/** DELETE /api/device/tokens?id=… – Gerät entkoppeln (Widerruf). */
export async function DELETE(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const ok = id ? await revokeDeviceToken(id, user.userId) : false;
  if (ok) await recordAudit({ userId: user.userId, action: "device.revoked", meta: { tokenId: id } });
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
