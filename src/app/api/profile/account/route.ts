import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/** PATCH /api/profile/account – Account-Anzeigename ändern. Body: { name } */
export async function PATCH(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültiger Body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ ok: false, error: "Name ist erforderlich." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name },
  });

  return NextResponse.json({ ok: true, name: updated.name });
}
