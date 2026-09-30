import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatIsoDate } from "@/domain/training/dates";
import { resolveExercisesForWorkout } from "@/domain/exercises/resolve";
import { segmentSchema } from "@/domain/schemas";
import { StrengthPlayer, type StrengthPlayerStep } from "@/components/exercises/StrengthPlayer";
import { ExerciseSvgDefs } from "@/components/exercises/ExerciseFigure";

export const dynamic = "force-dynamic";

/** Geführte Kraft-/Mobility-Einheit. Nur eigene Workouts (sonst 404). */
export default async function StrengthPlayerPage({
  params,
}: {
  params: Promise<{ workoutId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const userId = session.user.id;
  const { workoutId } = await params;

  const workout = await prisma.plannedWorkout.findFirst({
    where: { id: workoutId, userId },
  });
  if (!workout) notFound();

  const rawSegments = Array.isArray(workout.segmentsJson) ? workout.segmentsJson : [];
  // Gespeicherte Segmente defensiv erneut parsen (unbekannte/kaputte werden übersprungen).
  const segments = rawSegments.flatMap((s) => {
    const r = segmentSchema.safeParse(s);
    return r.success ? [r.data] : [];
  });
  const resolved = await resolveExercisesForWorkout(userId, segments);

  const steps: StrengthPlayerStep[] = segments.map((seg) => {
    if (seg.exercise) {
      const r = resolved.get(seg.exercise.id);
      return {
        kind: "exercise",
        exercise: seg.exercise,
        definition: r?.status === "ok" ? r.definition : null,
        status: r?.status ?? "missing",
        description: seg.description,
      };
    }
    return {
      kind: "text",
      description: seg.description,
      segmentType: seg.type,
      durationSec: seg.durationSec,
    };
  });

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <ExerciseSvgDefs />
      <p>
        <Link href="/trainer?tab=kraft" className="text-xs font-medium text-blue-600 hover:underline">
          ← Kraft und Mobility
        </Link>
      </p>
      <h1 className="mt-1.5 mb-4 text-2xl font-semibold tracking-tight text-neutral-900">
        {workout.title}
      </h1>
      <StrengthPlayer title={workout.title} date={formatIsoDate(workout.date)} steps={steps} />
    </main>
  );
}
