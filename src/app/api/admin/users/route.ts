import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guard";

/**
 * GET /api/admin/users – Liste aller Nutzer mit Rollen
 * POST /api/admin/users – { userId, role?, plan? } aktualisiert Nutzer-Rolle oder Tarif
 */

export async function GET(request: Request) {
  const { response } = await requireAdmin();
  if (response) return response;

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const [total, users] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
    }),
  ]);

  return NextResponse.json({ users, total, limit, offset });
}

export async function POST(request: Request) {
  const { user: adminUser, response } = await requireAdmin();
  if (response) return response;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Body." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = typeof body.role === "string" ? body.role : "";
  const plan = typeof body.plan === "string" ? body.plan : "";

  if (!userId) {
    return NextResponse.json({ error: "userId erforderlich." }, { status: 400 });
  }

  if (!role && !plan) {
    return NextResponse.json(
      { error: "role (user|admin) oder plan (free|paid) erforderlich." },
      { status: 400 },
    );
  }

  if (role && !["user", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "role muss 'user' oder 'admin' sein." },
      { status: 400 },
    );
  }

  if (plan && !["free", "paid"].includes(plan)) {
    return NextResponse.json(
      { error: "plan muss 'free' oder 'paid' sein." },
      { status: 400 },
    );
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) {
    return NextResponse.json({ error: "Nutzer nicht gefunden." }, { status: 404 });
  }

  const updateData: Record<string, string> = {};
  if (role) updateData.role = role;
  if (plan) updateData.plan = plan;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      plan: updated.plan,
    },
  });
}
