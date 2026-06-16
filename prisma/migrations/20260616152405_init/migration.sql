-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "provider" TEXT,
    "providerId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "planInterval" TEXT,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "athleteId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "ftpWatts" INTEGER,
    "thresholdHr" INTEGER,
    "thresholdPaceSecPerKm" INTEGER,
    "thresholdSwimPer100m" INTEGER,
    "trainingLevel" TEXT,
    "primarySports" JSONB,
    "knownLimiters" JSONB,
    "equipment" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AthleteProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "distance" TEXT,
    "priority" TEXT,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "resultSeconds" INTEGER,
    "resultPlacement" INTEGER,
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedWorkout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sport" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plannedDurationMin" INTEGER NOT NULL DEFAULT 0,
    "plannedDistanceM" INTEGER,
    "rpe" INTEGER,
    "description" TEXT,
    "segmentsJson" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" TEXT NOT NULL DEFAULT 'plan_import',
    "planImportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'intervals',
    "date" TIMESTAMP(3) NOT NULL,
    "sport" TEXT NOT NULL,
    "durationMin" DOUBLE PRECISION,
    "distanceKm" DOUBLE PRECISION,
    "distanceM" DOUBLE PRECISION,
    "load" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "avgHr" INTEGER,
    "notes" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlanImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "planName" TEXT,
    "generatedAt" TIMESTAMP(3),
    "planStart" TIMESTAMP(3) NOT NULL,
    "planDays" INTEGER NOT NULL,
    "planEnd" TIMESTAMP(3) NOT NULL,
    "rawJson" JSONB NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "validationErrorsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPlanImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachSummaryExport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "exportPurpose" TEXT NOT NULL,
    "requestedFormat" TEXT NOT NULL,
    "planStart" TIMESTAMP(3),
    "planDays" INTEGER,
    "includedModulesJson" JSONB NOT NULL,
    "modulesJson" JSONB NOT NULL,
    "chatGptInstructionJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachSummaryExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntervalsWorkoutSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localWorkoutId" TEXT NOT NULL,
    "intervalsEventId" TEXT,
    "intervalsActivityId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncedHash" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncConflictState" TEXT,
    "deletedOrSupersededAt" TIMESTAMP(3),
    "supersededByLocalWorkoutId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntervalsWorkoutSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncQueue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localWorkoutId" TEXT NOT NULL,
    "intervalsEventId" TEXT,
    "action" TEXT NOT NULL,
    "payloadJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localWorkoutId" TEXT,
    "intervalsEventId" TEXT,
    "action" TEXT,
    "type" TEXT,
    "status" TEXT,
    "durationMs" INTEGER,
    "previousStateJson" JSONB,
    "newStateJson" JSONB,
    "reason" TEXT,
    "triggeredBy" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadinessSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT,
    "sleepTrend" TEXT,
    "hrvTrend" TEXT,
    "restingHrTrend" TEXT,
    "subjectiveFatigue" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadinessSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PainSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "overall" INTEGER,
    "knee" INTEGER,
    "achilles" INTEGER,
    "calf" INTEGER,
    "back" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sport" TEXT,
    "parentId" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "autoTrack" BOOLEAN NOT NULL DEFAULT true,
    "manualKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alertKm" DOUBLE PRECISION,
    "alertHours" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mood" INTEGER,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BodyMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION,
    "restingHr" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" TEXT NOT NULL,
    "weeklyTargetMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "UserIntegration_userId_idx" ON "UserIntegration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserIntegration_userId_provider_key" ON "UserIntegration"("userId", "provider");

-- CreateIndex
CREATE INDEX "AthleteProfile_userId_idx" ON "AthleteProfile"("userId");

-- CreateIndex
CREATE INDEX "RaceEvent_userId_idx" ON "RaceEvent"("userId");

-- CreateIndex
CREATE INDEX "RaceEvent_date_idx" ON "RaceEvent"("date");

-- CreateIndex
CREATE INDEX "PlannedWorkout_userId_idx" ON "PlannedWorkout"("userId");

-- CreateIndex
CREATE INDEX "PlannedWorkout_date_idx" ON "PlannedWorkout"("date");

-- CreateIndex
CREATE INDEX "PlannedWorkout_status_idx" ON "PlannedWorkout"("status");

-- CreateIndex
CREATE INDEX "PlannedWorkout_planImportId_idx" ON "PlannedWorkout"("planImportId");

-- CreateIndex
CREATE INDEX "ActualActivity_userId_idx" ON "ActualActivity"("userId");

-- CreateIndex
CREATE INDEX "ActualActivity_date_idx" ON "ActualActivity"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ActualActivity_userId_source_externalId_key" ON "ActualActivity"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "TrainingPlanImport_userId_idx" ON "TrainingPlanImport"("userId");

-- CreateIndex
CREATE INDEX "CoachSummaryExport_userId_idx" ON "CoachSummaryExport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntervalsWorkoutSync_localWorkoutId_key" ON "IntervalsWorkoutSync"("localWorkoutId");

-- CreateIndex
CREATE INDEX "IntervalsWorkoutSync_userId_idx" ON "IntervalsWorkoutSync"("userId");

-- CreateIndex
CREATE INDEX "IntervalsWorkoutSync_intervalsEventId_idx" ON "IntervalsWorkoutSync"("intervalsEventId");

-- CreateIndex
CREATE INDEX "SyncQueue_userId_idx" ON "SyncQueue"("userId");

-- CreateIndex
CREATE INDEX "SyncQueue_status_idx" ON "SyncQueue"("status");

-- CreateIndex
CREATE INDEX "SyncQueue_localWorkoutId_idx" ON "SyncQueue"("localWorkoutId");

-- CreateIndex
CREATE INDEX "SyncLog_userId_idx" ON "SyncLog"("userId");

-- CreateIndex
CREATE INDEX "SyncLog_localWorkoutId_idx" ON "SyncLog"("localWorkoutId");

-- CreateIndex
CREATE INDEX "SyncLog_type_idx" ON "SyncLog"("type");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReadinessSnapshot_userId_idx" ON "ReadinessSnapshot"("userId");

-- CreateIndex
CREATE INDEX "ReadinessSnapshot_date_idx" ON "ReadinessSnapshot"("date");

-- CreateIndex
CREATE INDEX "PainSnapshot_userId_idx" ON "PainSnapshot"("userId");

-- CreateIndex
CREATE INDEX "PainSnapshot_date_idx" ON "PainSnapshot"("date");

-- CreateIndex
CREATE INDEX "GearItem_userId_idx" ON "GearItem"("userId");

-- CreateIndex
CREATE INDEX "GearItem_type_idx" ON "GearItem"("type");

-- CreateIndex
CREATE INDEX "GearItem_parentId_idx" ON "GearItem"("parentId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "JournalEntry"("date");

-- CreateIndex
CREATE INDEX "BodyMetric_userId_idx" ON "BodyMetric"("userId");

-- CreateIndex
CREATE INDEX "BodyMetric_date_idx" ON "BodyMetric"("date");

-- CreateIndex
CREATE INDEX "TrainingGoal_userId_idx" ON "TrainingGoal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingGoal_userId_sport_key" ON "TrainingGoal"("userId", "sport");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIntegration" ADD CONSTRAINT "UserIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteProfile" ADD CONSTRAINT "AthleteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEvent" ADD CONSTRAINT "RaceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedWorkout" ADD CONSTRAINT "PlannedWorkout_planImportId_fkey" FOREIGN KEY ("planImportId") REFERENCES "TrainingPlanImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualActivity" ADD CONSTRAINT "ActualActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanImport" ADD CONSTRAINT "TrainingPlanImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachSummaryExport" ADD CONSTRAINT "CoachSummaryExport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervalsWorkoutSync" ADD CONSTRAINT "IntervalsWorkoutSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntervalsWorkoutSync" ADD CONSTRAINT "IntervalsWorkoutSync_localWorkoutId_fkey" FOREIGN KEY ("localWorkoutId") REFERENCES "PlannedWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncQueue" ADD CONSTRAINT "SyncQueue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncQueue" ADD CONSTRAINT "SyncQueue_localWorkoutId_fkey" FOREIGN KEY ("localWorkoutId") REFERENCES "PlannedWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessSnapshot" ADD CONSTRAINT "ReadinessSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PainSnapshot" ADD CONSTRAINT "PainSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BodyMetric" ADD CONSTRAINT "BodyMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGoal" ADD CONSTRAINT "TrainingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
