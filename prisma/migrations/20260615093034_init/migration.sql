-- CreateTable
CREATE TABLE "AthleteProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "heightCm" INTEGER,
    "weightKg" REAL,
    "trainingLevel" TEXT,
    "primarySports" TEXT,
    "knownLimiters" TEXT,
    "equipment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RaceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "distance" TEXT,
    "priority" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PlannedWorkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "sport" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plannedDurationMin" INTEGER NOT NULL DEFAULT 0,
    "plannedDistanceM" INTEGER,
    "rpe" INTEGER,
    "description" TEXT,
    "segmentsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'planned',
    "source" TEXT NOT NULL DEFAULT 'plan_import',
    "planImportId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlannedWorkout_planImportId_fkey" FOREIGN KEY ("planImportId") REFERENCES "TrainingPlanImport" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActualActivity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'intervals',
    "date" DATETIME NOT NULL,
    "sport" TEXT NOT NULL,
    "durationMin" REAL,
    "distanceKm" REAL,
    "distanceM" REAL,
    "load" REAL,
    "rpe" REAL,
    "avgHr" INTEGER,
    "notes" TEXT,
    "rawJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TrainingPlanImport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaVersion" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "planName" TEXT,
    "generatedAt" DATETIME,
    "planStart" DATETIME NOT NULL,
    "planDays" INTEGER NOT NULL,
    "planEnd" DATETIME NOT NULL,
    "rawJson" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "validationErrorsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CoachSummaryExport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "schemaVersion" TEXT NOT NULL,
    "exportPurpose" TEXT NOT NULL,
    "requestedFormat" TEXT NOT NULL,
    "planStart" DATETIME,
    "planDays" INTEGER,
    "includedModulesJson" TEXT NOT NULL,
    "modulesJson" TEXT NOT NULL,
    "chatGptInstructionJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IntervalsWorkoutSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localWorkoutId" TEXT NOT NULL,
    "intervalsEventId" TEXT,
    "intervalsActivityId" TEXT,
    "lastSyncedAt" DATETIME,
    "lastSyncedHash" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'pending',
    "syncConflictState" TEXT,
    "deletedOrSupersededAt" DATETIME,
    "supersededByLocalWorkoutId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntervalsWorkoutSync_localWorkoutId_fkey" FOREIGN KEY ("localWorkoutId") REFERENCES "PlannedWorkout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localWorkoutId" TEXT NOT NULL,
    "intervalsEventId" TEXT,
    "action" TEXT NOT NULL,
    "payloadJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncQueue_localWorkoutId_fkey" FOREIGN KEY ("localWorkoutId") REFERENCES "PlannedWorkout" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "localWorkoutId" TEXT,
    "intervalsEventId" TEXT,
    "action" TEXT NOT NULL,
    "previousStateJson" TEXT,
    "newStateJson" TEXT,
    "reason" TEXT,
    "triggeredBy" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReadinessSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "status" TEXT,
    "sleepTrend" TEXT,
    "hrvTrend" TEXT,
    "restingHrTrend" TEXT,
    "subjectiveFatigue" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PainSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "overall" INTEGER,
    "knee" INTEGER,
    "achilles" INTEGER,
    "calf" INTEGER,
    "back" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "PlannedWorkout_date_idx" ON "PlannedWorkout"("date");

-- CreateIndex
CREATE INDEX "PlannedWorkout_status_idx" ON "PlannedWorkout"("status");

-- CreateIndex
CREATE INDEX "PlannedWorkout_planImportId_idx" ON "PlannedWorkout"("planImportId");

-- CreateIndex
CREATE INDEX "ActualActivity_date_idx" ON "ActualActivity"("date");

-- CreateIndex
CREATE UNIQUE INDEX "ActualActivity_source_externalId_key" ON "ActualActivity"("source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "IntervalsWorkoutSync_localWorkoutId_key" ON "IntervalsWorkoutSync"("localWorkoutId");

-- CreateIndex
CREATE INDEX "IntervalsWorkoutSync_intervalsEventId_idx" ON "IntervalsWorkoutSync"("intervalsEventId");

-- CreateIndex
CREATE INDEX "SyncQueue_status_idx" ON "SyncQueue"("status");

-- CreateIndex
CREATE INDEX "SyncQueue_localWorkoutId_idx" ON "SyncQueue"("localWorkoutId");

-- CreateIndex
CREATE INDEX "SyncLog_localWorkoutId_idx" ON "SyncLog"("localWorkoutId");

-- CreateIndex
CREATE INDEX "SyncLog_createdAt_idx" ON "SyncLog"("createdAt");

-- CreateIndex
CREATE INDEX "ReadinessSnapshot_date_idx" ON "ReadinessSnapshot"("date");

-- CreateIndex
CREATE INDEX "PainSnapshot_date_idx" ON "PainSnapshot"("date");
