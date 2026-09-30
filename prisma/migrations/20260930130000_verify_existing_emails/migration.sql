-- Bestandskonten gelten als bestätigt, damit sie sich nach Einführung der
-- E-Mail-Bestätigung weiterhin anmelden können.
UPDATE "User" SET "emailVerified" = "createdAt" WHERE "emailVerified" IS NULL;
