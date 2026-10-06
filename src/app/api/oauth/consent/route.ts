import { requireUser } from "@/lib/auth-guard";
import { handleConsent } from "@/lib/mcp/oauthHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Entscheidung der Zustimmungsseite – nur mit eingeloggter Session. */
export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (response) return response;
  return handleConsent(request, user.userId);
}
