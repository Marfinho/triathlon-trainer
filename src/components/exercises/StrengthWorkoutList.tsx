import Link from "next/link";
import { prisma } from "@/lib/db";
import { addDays, formatIsoDate } from "@/domain/training/dates";
import { exerciseIdsFromSegments } from "@/domain/exercises/resolve";
import { Card, sportLabel } from "@/components/dashboard/Card";

/**
 * Nächste 21 Tage Kraft- und Mobility-Einheiten (planned/synced) mit Link zum
 * Kraft-Player. Server-Komponente, filtert strikt nach userId.
 */
export async function StrengthWorkoutList({ userId }: { userId: string }) {
  const now = new Date();
  const workouts = await prisma.plannedWorkout.findMany({
    where: {
      userId,
      sport: { in: ["strength", "mobility"] },
      status: { in: ["planned", "synced"] },
      date: { gte: addDays(now, -1), lte: addDays(now, 21) },
    },
    orderBy: { date: "asc" },
    take: 30,
  });

  return (
    <>
      <Card
        title="Nächste Einheiten"
        subtitle="Kraft und Mobility der nächsten 21 Tage"
        actions={
          <Link
            href="/trainer/uebungen"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            Übungsbibliothek
          </Link>
        }
      >
        {workouts.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Keine Kraft- oder Mobility-Einheiten geplant.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {workouts.map((w) => {
              const exerciseCount = exerciseIdsFromSegments(w.segmentsJson).length;
              return (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {formatIsoDate(w.date)} · {sportLabel(w.sport)} · {w.plannedDurationMin} min
                    </p>
                    <p className="font-medium text-neutral-900 dark:text-neutral-100">{w.title}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      {exerciseCount > 0 ? `${exerciseCount} Übungen` : "ohne Übungsbilder"}
                    </p>
                  </div>
                  <Link
                    href={`/trainer/kraft/${w.id}`}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Einheit starten
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
