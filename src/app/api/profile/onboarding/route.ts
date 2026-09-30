import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";

/** POST /api/profile/onboarding – blendet die „Erste Schritte“-Checkliste dauerhaft aus. */
export async function POST() {
  const { user, response } = await requireUser();
  if (response) return response;
  await prisma.user.update({ where: { id: user.userId }, data: { onboardingDismissedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
