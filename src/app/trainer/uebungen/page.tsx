import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listExercisesForUser } from "@/domain/exercises/resolve";
import { isExercise3d, musclesOf, renderThumbAny } from "@/domain/exercises/any";
import {
  ExerciseLibraryBrowser,
  type LibraryListItem,
} from "@/components/exercises/ExerciseLibraryBrowser";
import { ExerciseLegend } from "@/components/exercises/ExerciseMuscleView";
import { NewExerciseExchange } from "@/components/exercises/NewExerciseExchange";
import { buildNewExercisePrompt, WISH_PLACEHOLDER } from "@/domain/exercises/newExercisePrompt";

export const dynamic = "force-dynamic";

export default async function ExerciseLibraryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const items: LibraryListItem[] = (await listExercisesForUser(session.user.id)).map(
    ({ definition, custom }) => ({
      id: definition.id,
      title: definition.title,
      subtitle: definition.subtitle,
      category: definition.category,
      muscles: musclesOf(definition).map((m) => m.label),
      custom,
      thumbSvg: renderThumbAny(definition),
      ...(isExercise3d(definition) ? { definition3d: definition } : {}),
    }),
  );

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <p>
          <Link href="/trainer?tab=kraft" className="text-xs font-medium text-blue-600 hover:underline">
            ← Trainer
          </Link>
        </p>
        <h1 className="mt-3 text-[2rem] font-bold leading-none tracking-tight text-neutral-900 md:text-5xl">
          Übungsbibliothek
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Kraft und Mobility mit Muskelbild, Ablauf und Animation.
        </p>
        <div className="mt-3">
          <ExerciseLegend />
        </div>
      </header>
      <div className="mb-6">
        <NewExerciseExchange
          promptTemplate={buildNewExercisePrompt({ wish: WISH_PLACEHOLDER, existingIds: items.map((i) => i.id) })}
          placeholder={WISH_PLACEHOLDER}
        />
      </div>
      <ExerciseLibraryBrowser items={items} />
    </main>
  );
}
