import { requireUser } from "@/lib/auth-guard";
import { getLive, LIVE_STALE_MS, subscribeLive, type LiveEvent } from "@/lib/live-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/live/stream – Server-Sent Events mit dem Live-Zustand der eigenen
 * Einheit (für die TV-Ansicht). Sendet sofort den aktuellen Stand, danach jede
 * Änderung; veraltete Einheiten werden als `idle` gemeldet.
 */
export async function GET(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  const userId = user.userId;

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastKind = "";
      const send = (event: LiveEvent) => {
        lastKind = event.snapshot.kind;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send(getLive(userId));

      const unsubscribe = subscribeLive(userId, send);
      // Heartbeat + Stale-Erkennung: ohne neue Snapshots auf idle zurückfallen.
      const timer = setInterval(() => {
        const current = getLive(userId);
        if (current.snapshot.kind === "idle" && lastKind !== "idle") send(current);
        else controller.enqueue(encoder.encode(": ping\n\n"));
      }, Math.min(LIVE_STALE_MS / 2, 10_000));

      cleanup = () => {
        clearInterval(timer);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // bereits geschlossen
        }
      };
      request.signal.addEventListener("abort", cleanup);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
