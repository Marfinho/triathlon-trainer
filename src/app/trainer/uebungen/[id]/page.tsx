import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { findExerciseForUser } from "@/domain/exercises/resolve";
import { EXERCISE_ID_REGEX } from "@/domain/exercises/schema";
import { ExerciseDetail } from "@/components/exercises/ExerciseDetail";
import { ExerciseSvgDefs } from "@/components/exercises/ExerciseFigure";

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");
  const { id } = await params;
  if (id.length > 48 || !EXERCISE_ID_REGEX.test(id)) notFound();

  const item = await findExerciseForUser(session.user.id, id);
  if (!item) notFound();

  return (
    <main className="px-4 py-6 md:px-8 md:py-10">
      <ExerciseSvgDefs />
      <Link href="/trainer/uebungen" className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400">
        ← Übungsbibliothek
      </Link>
      <div className="mt-3 rounded-2xl border border-neutral-200/80 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900 md:p-6">
        <ExerciseDetail definition={item.definition} custom={item.custom} />
      </div>
    </main>
  );
}
