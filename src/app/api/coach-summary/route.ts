import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-guard";
import { buildCoachSummary } from "@/domain/coach-summary/buildCoachSummary";
import { gatherCoachSummaryContext } from "@/domain/coach-summary/gatherContext";
import {
  EXPORT_PURPOSES,
  type ExportPurpose,
  type SummaryModule,
} from "@/domain/schemas";
import { formatIsoDate, addDays } from "@/domain/training/dates";

/**
 * POST /api/coach-summary
 * Erzeugt eine modulare coach_summary, persistiert sie als CoachSummaryExport
 * und gibt sie zurück (zum Kopieren in das externe LLM).
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const { userId } = user;

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // leerer Body ist ok – Defaults greifen.
  }

  const exportPurpose = (
    EXPORT_PURPOSES.includes(body.exportPurpose as ExportPurpose)
      ? body.exportPurpose
      : "training_plan"
  ) as ExportPurpose;

  let planStart = formatIsoDate(addDays(new Date(), 1));
  if (typeof body.planStart === "string" && body.planStart) {
    const parsed = new Date(`${body.planStart.slice(0, 10)}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) planStart = body.planStart.slice(0, 10);
  }
  const planDays =
    typeof body.planDays === "number" && Number.isFinite(body.planDays) && body.planDays > 0
      ? Math.min(Math.round(body.planDays), 90)
      : 7;

  const includeModules = Array.isArray(body.includeModules)
    ? (body.includeModules as SummaryModule[])
    : undefined;
  const excludeModules = Array.isArray(body.excludeModules)
    ? (body.excludeModules as SummaryModule[])
    : undefined;

  const { context, athleteId } = await gatherCoachSummaryContext(prisma, {
    userId,
  });

  const summary = buildCoachSummary({
    exportPurpose,
    athleteId,
    planStart,
    planDays,
    includeModules,
    excludeModules,
    context,
    language: typeof body.language === "string" ? body.language : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
  });

  const saved = await prisma.coachSummaryExport.create({
    data: {
      userId,
      schemaVersion: summary.schemaVersion,
      exportPurpose: summary.exportPurpose,
      requestedFormat: summary.requestedOutput.format,
      planStart: new Date(`${planStart}T00:00:00Z`),
      planDays,
      includedModulesJson: summary.includedModules as unknown as Prisma.InputJsonValue,
      modulesJson: summary.modules as Prisma.InputJsonValue,
      chatGptInstructionJson: summary.chatGptInstruction as unknown as Prisma.InputJsonValue,
    },
  });

  return NextResponse.json({ exportId: saved.id, summary });
}
