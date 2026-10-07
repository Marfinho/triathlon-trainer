import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUserOrDevice } from "@/lib/device/auth";
import { findExerciseForUser } from "@/domain/exercises/resolve";
import { isExercise3d } from "@/domain/exercises/any";
import { Exercise3dViewer } from "@/components/exercises/Exercise3dViewer";
import { ExerciseAnimation } from "@/components/exercises/ExerciseAnimation";
import { ExerciseSvgDefs } from "@/components/exercises/ExerciseFigure";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Brick – Übung" };

/**
 * Übungsanimation für die Fire-TV-App (brick-tv): nur das 3D-Modell bzw. die
 * 2D-Animation, randlos und dunkel, zum Einbetten in eine WebView. Auth per
 * Geräte-Token (`Authorization: Bearer lht_…`, von der App beim Laden gesetzt)
 * oder Session. Eigene Übungen nur für den eigenen Nutzer.
 */
export default async function TvExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const h = await headers();
  const auth = await requireUserOrDevice(new Request("http://localhost/tv/exercise", { headers: h }));
  if (auth.response) {
    return <Message text="Nicht angemeldet." />;
  }
  const item = await findExerciseForUser(auth.userId, id.slice(0, 64));
  if (!item) return <Message text="Übung nicht gefunden." />;
  const def = item.definition;
  return (
    <main className="flex h-screen w-screen items-center justify-center overflow-hidden bg-neutral-950">
      <ExerciseSvgDefs />
      <div className="h-full w-full max-w-[100vh]">
        {isExercise3d(def) ? (
          <Exercise3dViewer key={def.id} definition={def} compact />
        ) : (
          <ExerciseAnimation key={def.id} definition={def} showControls={false} />
        )}
      </div>
    </main>
  );
}

function Message({ text }: { text: string }) {
  return (
    <main className="flex h-screen w-screen items-center justify-center bg-neutral-950 text-2xl text-neutral-400">
      {text}
    </main>
  );
}
