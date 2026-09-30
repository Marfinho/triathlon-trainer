/**
 * Admin ist der Nutzer mit dieser E-Mail-Adresse – egal ob per Registrierung
 * oder Google-Login angelegt. Die Rolle wird bei jedem Login/JWT-Refresh
 * gesetzt (siehe auth.ts) und kann im Admin-Panel nicht entzogen werden.
 */
export const OWNER_ADMIN_EMAIL = "svenmeendermann@gmail.com";

export function isOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OWNER_ADMIN_EMAIL;
}
