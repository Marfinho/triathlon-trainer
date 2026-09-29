/**
 * Fester Betreiber-Account: Diese E-Mail-Adresse ist IMMER Admin. Sie wird beim
 * Login (JWT-Callback) und beim Seed zum Admin gemacht, kann im Admin-Panel
 * nicht herabgestuft werden und ist für die offene Registrierung gesperrt
 * (sonst könnte sich jemand ohne E-Mail-Verifikation als Betreiber anmelden).
 */
export const OWNER_ADMIN_EMAIL = "svenmeendermann@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_ADMIN_EMAIL;
}
