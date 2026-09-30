import Link from "next/link";

/** 404-Seite im ruhigen Dashboard-Look. */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-5xl font-semibold text-neutral-300">404</p>
      <h1 className="text-lg font-semibold text-neutral-900">Seite nicht gefunden</h1>
      <p className="max-w-sm text-sm text-neutral-500">
        Diese Adresse gibt es nicht (mehr).
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
      >
        Zum Dashboard
      </Link>
    </div>
  );
}
