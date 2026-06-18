-- AlterTable
ALTER TABLE "BodyMetric" ADD COLUMN     "hrv" INTEGER;

-- AlterTable
ALTER TABLE "RaceEvent" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "locationName" TEXT,
ADD COLUMN     "lon" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "SyncQueue" ADD COLUMN     "nextAttemptAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RaceNutritionPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "raceEventId" TEXT NOT NULL,
    "carbsGPerHour" INTEGER,
    "fluidMlPerHour" INTEGER,
    "sodiumMgPerHour" INTEGER,
    "caffeineMg" INTEGER,
    "bikeCarbsGPerHour" INTEGER,
    "runCarbsGPerHour" INTEGER,
    "notes" TEXT,
    "checklistJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceNutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEntry" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitEntry_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "StripeProcessedEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaceNutritionPlan_raceEventId_key" ON "RaceNutritionPlan"("raceEventId");

-- CreateIndex
CREATE INDEX "RaceNutritionPlan_userId_idx" ON "RaceNutritionPlan"("userId");

-- AddForeignKey
ALTER TABLE "RaceNutritionPlan" ADD CONSTRAINT "RaceNutritionPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceNutritionPlan" ADD CONSTRAINT "RaceNutritionPlan_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
