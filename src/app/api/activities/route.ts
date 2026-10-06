import { requireUser } from "@/lib/auth-guard";
import { createActivityFromRequest } from "@/lib/activities/create";

/**
 * POST /api/activities
 * Speichert eine (z.B. auf der Radrolle aufgezeichnete) Ist-Aktivität.
 * Ist-Aktivitäten sind unantastbar – diese Route legt nur NEUE Datensätze an.
 *
 * Body: { sport, date?, durationMin, distanceKm?, load?, avgHr?, avgPower?,
 *         rpe?, source?, notes?, samples? }
 */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  return createActivityFromRequest(user.userId, request);
}
