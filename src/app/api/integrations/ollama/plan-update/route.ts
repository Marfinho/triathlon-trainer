/**
 * Ollama Plan-Update-Endpunkt.
 * Erlaubt Ollama, Trainings zu erstellen, zu aktualisieren oder zu löschen.
 * Änderungen werden automatisch zu Intervals.icu synchronisiert.
 */

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { syncPlannedWorkout } from "@/integrations/intervals/syncPlannedWorkout";
import { createIntervalsClientForUser } from "@/integrations/intervals/userClient";

interface WorkoutUpdate {
  action: "create" | "update" | "delete";
  date: string;
  sport?: string;
  title?: string;
  plannedDurationMin?: number;
  plannedDistanceM?: number;
  description?: string;
  rpe?: number;
  workoutId?: string; // for update/delete
}

interface PlanUpdateRequest {
  updates: WorkoutUpdate[];
  reason?: string;
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { updates, reason } = (await req.json()) as PlanUpdateRequest;

    if (!Array.isArray(updates) || updates.length === 0) {
      return Response.json(
        { error: "Updates array required" },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const results = [];

    // Process each update
    for (const update of updates) {
      try {
        if (update.action === "create") {
          const workoutDate = new Date(update.date);

          const workout = await prisma.plannedWorkout.create({
            data: {
              userId,
              date: workoutDate,
              sport: update.sport || "other",
              title: update.title || "Ollama Training",
              plannedDurationMin: update.plannedDurationMin || 45,
              plannedDistanceM: update.plannedDistanceM || null,
              description: update.description || null,
              rpe: update.rpe || null,
              status: "planned",
              segmentsJson: [],
            },
          });

          // Sync to Intervals
          const intervalsClient = await createIntervalsClientForUser(userId);
          if (intervalsClient) {
            await syncPlannedWorkout({
              db: prisma,
              client: intervalsClient,
              userId,
              workoutId: workout.id,
              triggeredBy: "ollama",
            });
          }

          results.push({
            action: "create",
            date: update.date,
            sport: update.sport,
            workoutId: workout.id,
            synced: !!intervalsClient,
          });
        } else if (update.action === "update" && update.workoutId) {
          const updateData: Record<string, unknown> = {};

          if (update.title) updateData.title = update.title;
          if (update.sport) updateData.sport = update.sport;
          if (update.plannedDurationMin)
            updateData.plannedDurationMin = update.plannedDurationMin;
          if (update.plannedDistanceM !== undefined)
            updateData.plannedDistanceM = update.plannedDistanceM;
          if (update.description !== undefined)
            updateData.description = update.description;
          if (update.rpe !== undefined) updateData.rpe = update.rpe;

          if (Object.keys(updateData).length > 0) {
            updateData.status = "planned"; // Mark as modified
            updateData.lastSyncedHash = null; // Force re-sync

            await prisma.plannedWorkout.update({
              where: { id: update.workoutId },
              data: updateData,
            });

            // Sync to Intervals
            const intervalsClient = await createIntervalsClientForUser(userId);
            if (intervalsClient) {
              await syncPlannedWorkout({
                db: prisma,
                client: intervalsClient,
                userId,
                workoutId: update.workoutId,
                triggeredBy: "ollama",
              });
            }

            results.push({
              action: "update",
              workoutId: update.workoutId,
              synced: !!intervalsClient,
            });
          }
        } else if (update.action === "delete" && update.workoutId) {
          await prisma.plannedWorkout.delete({
            where: { id: update.workoutId },
          });

          results.push({
            action: "delete",
            workoutId: update.workoutId,
          });
        }
      } catch (error) {
        results.push({
          action: update.action,
          date: update.date,
          error:
            error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return Response.json({
      ok: true,
      updates: results,
      reason,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { ok: false, error: message },
      { status: 400 },
    );
  }
}
