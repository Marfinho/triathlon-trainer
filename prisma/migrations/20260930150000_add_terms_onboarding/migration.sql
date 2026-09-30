ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "onboardingDismissedAt" TIMESTAMP(3);
-- Bestandsnutzer brauchen die Einstiegs-Checkliste nicht mehr.
UPDATE "User" SET "onboardingDismissedAt" = CURRENT_TIMESTAMP;
