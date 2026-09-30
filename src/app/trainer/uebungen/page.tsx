import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listExercisesForUser } from "@/domain/exercises/resolve";
import { renderThumbSvg } from "@/domain/exercises/engine";
import {
  ExerciseLibraryBrowser,
  type LibraryListItem,
} from "@/components/exercises/ExerciseLibraryBrowser";
import { ExerciseLegend } from "@/components/exercises/ExerciseMuscleView";

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
      muscles: definition.muscles.map((m) => m.label),
      custom,
      thumbSvg: renderThumbSvg(definition),
    }),
  );

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6">
        <Link href="/trainer?tab=kraft" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
          ← Trainer
        </Link>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 md:text-3xl">
          Übungsbibliothek
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Kraft und Mobility mit Muskelbild, Ablauf und Animation.
        </p>
        <div className="mt-3">
          <ExerciseLegend />
        </div>
      </header>
      <ExerciseLibraryBrowser items={items} />
    </main>
  );
}
