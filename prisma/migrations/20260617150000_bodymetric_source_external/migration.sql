-- AlterTable
ALTER TABLE "BodyMetric" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "BodyMetric" ADD COLUMN "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BodyMetric_userId_source_externalId_key" ON "BodyMetric"("userId", "source", "externalId");
