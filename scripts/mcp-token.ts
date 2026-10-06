/**
 * Verwaltung der MCP-Zugriffstoken (Remote-MCP-Server /api/mcp).
 *
 *   npx tsx scripts/mcp-token.ts create --email du@example.com --name "Claude" [--write] [--days 365|--no-expiry]
 *   npx tsx scripts/mcp-token.ts list   [--email du@example.com]
 *   npx tsx scripts/mcp-token.ts revoke <tokenId>
 *   npx tsx scripts/mcp-token.ts revoke-oauth --email du@example.com   (alle Connector-Verbindungen trennen)
 *
 * Im Docker-Setup: docker compose exec app npx tsx scripts/mcp-token.ts …
 * Das Klartext-Token wird nur beim Erzeugen ausgegeben – danach nie wieder.
 */
import { prisma } from "../src/lib/db";
import { createMcpToken, listMcpTokens, revokeMcpToken } from "../src/lib/mcp/token";
import { recordAudit } from "../src/lib/audit";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);

  if (cmd === "create") {
    const email = flag(args, "email");
    if (!email) throw new Error("--email fehlt");
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`Kein Nutzer mit E-Mail ${email}`);
    const days = args.includes("--no-expiry") ? null : Number(flag(args, "days") ?? 365);
    if (days !== null && (!Number.isFinite(days) || days <= 0)) throw new Error("--days muss > 0 sein");
    const t = await createMcpToken({
      userId: user.id,
      name: flag(args, "name") ?? "Claude",
      writePlan: args.includes("--write"),
      expiresInDays: days,
    });
    await recordAudit({ userId: user.id, action: "mcp.token_created", meta: { tokenId: t.id, scopes: t.scopes } });
    console.log(`Token-ID:  ${t.id}`);
    console.log(`Scopes:    ${t.scopes.join(", ")}`);
    console.log(`Läuft ab:  ${t.expiresAt ? t.expiresAt.toISOString() : "nie"}`);
    console.log(`\nToken (nur jetzt sichtbar – sicher speichern):\n${t.token}\n`);
  } else if (cmd === "list") {
    const email = flag(args, "email");
    const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
    if (email && !user) throw new Error(`Kein Nutzer mit E-Mail ${email}`);
    const rows = await listMcpTokens(user?.id);
    for (const r of rows) {
      const state = r.revokedAt ? "widerrufen" : r.expiresAt && r.expiresAt < new Date() ? "abgelaufen" : "aktiv";
      console.log(
        `${r.id}  ${r.prefix}  ${state.padEnd(10)}  ${JSON.stringify(r.scopes)}  zuletzt: ${r.lastUsedAt?.toISOString() ?? "nie"}  ${r.name}`,
      );
    }
    if (rows.length === 0) console.log("Keine Token.");
  } else if (cmd === "revoke") {
    const id = args[0];
    if (!id) throw new Error("Token-ID fehlt");
    const ok = await revokeMcpToken(id);
    if (ok) await recordAudit({ action: "mcp.token_revoked", meta: { tokenId: id } });
    console.log(ok ? "Token widerrufen." : "Token nicht gefunden oder bereits widerrufen.");
  } else if (cmd === "revoke-oauth") {
    const email = flag(args, "email");
    if (!email) throw new Error("--email fehlt");
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new Error(`Kein Nutzer mit E-Mail ${email}`);
    const res = await prisma.mcpToken.updateMany({
      where: { userId: user.id, clientId: { not: null }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    // Noch nicht eingelöste Autorisierungscodes ebenfalls ungültig machen.
    const codes = await prisma.oAuthCode.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    await recordAudit({ userId: user.id, action: "mcp.oauth_revoked_all", meta: { count: res.count, openCodes: codes.count } });
    console.log(`${res.count} OAuth-Token widerrufen, ${codes.count} offene Codes ungültig gemacht.`);
  } else {
    console.log("Befehle: create | list | revoke | revoke-oauth  (siehe Kopfkommentar)");
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
