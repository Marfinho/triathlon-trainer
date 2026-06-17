-- AlterTable
ALTER TABLE "UserIntegration" ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "tokenExpiresAt" TIMESTAMP(3);
