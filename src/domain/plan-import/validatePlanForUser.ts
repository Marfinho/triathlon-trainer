import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/db";
import {
  validateLocalhubPlan,
  type ExistingWorkoutRef,
} from "./validateLocalhubPlan";
import { parseIsoDate, addDays } from "@/domain/training/dates";

/**
 * Validiert einen localhub_plan gegen den DB-Stand eines Nutzers (eigene
 * Übungen, bestehende Workouts im Planzeitraum). Rein lesend – keine
 * DB-Änderung. Gemeinsame Basis für die Validate-Vorschau der Plan-Import-Route
 * und für den MCP-Server.
 */
export async function validatePlanForUser(
  plan: unknown,
  userId: string,
  db: PrismaClient = defaultPrisma,
) {
  const existingCustomExercises = (
    await db.customExercise.findMany({
      where: { userId },
      select: { exerciseId: true, definitionJson: true },
    })
  ).map((c) => ({ exerciseId: c.exerciseId, definitionJson: c.definitionJson as unknown }));

  const firstPass = validateLocalhubPlan(plan, { existingCustomExercises });
  let existingRefs: ExistingWorkoutRef[] = [];
  if (firstPass.meta) {
    const rangeStart = parseIsoDate(firstPass.meta.planStart);
    const rangeEndExclusive = addDays(parseIsoDate(firstPass.meta.planEnd), 1);
    const existing = await db.plannedWorkout.findMany({
      where: { userId, date: { gte: rangeStart, lt: rangeEndExclusive } },
      select: { id: true, date: true, status: true, title: true },
    });
    existingRefs = existing.map((w) => ({
      id: w.id,
      date: w.date,
      status: w.status,
      title: w.title,
    }));
  }

  const result = validateLocalhubPlan(plan, {
    existingWorkouts: existingRefs,
    existingCustomExercises,
  });
  return { result, existingRefs, existingCustomExercises };
}
