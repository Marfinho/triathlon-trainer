import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
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

  const planStart =
    typeof body.planStart === "string"
      ? body.planStart
      : formatIsoDate(addDays(new Date(), 1));
  const planDays =
    typeof body.planDays === "number" && body.planDays > 0 ? body.planDays : 7;

  const includeModules = Array.isArray(body.includeModules)
    ? (body.includeModules as SummaryModule[])
    : undefined;
  const excludeModules = Array.isArray(body.excludeModules)
    ? (body.excludeModules as SummaryModule[])
    : undefined;

  const { context, athleteId } = await gatherCoachSummaryContext(prisma);

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
      schemaVersion: summary.schemaVersion,
      exportPurpose: summary.exportPurpose,
      requestedFormat: summary.requestedOutput.format,
      planStart: new Date(`${planStart}T00:00:00Z`),
      planDays,
      includedModulesJson: JSON.stringify(summary.includedModules),
      modulesJson: JSON.stringify(summary.modules),
      chatGptInstructionJson: JSON.stringify(summary.chatGptInstruction),
    },
  });

  return NextResponse.json({ exportId: saved.id, summary });
}
