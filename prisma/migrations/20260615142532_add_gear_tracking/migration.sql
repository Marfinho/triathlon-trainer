-- CreateTable
CREATE TABLE "GearItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sport" TEXT,
    "parentId" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" DATETIME,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "autoTrack" BOOLEAN NOT NULL DEFAULT true,
    "manualKm" REAL NOT NULL DEFAULT 0,
    "manualHours" REAL NOT NULL DEFAULT 0,
    "alertKm" REAL,
    "alertHours" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GearItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "GearItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GearItem_type_idx" ON "GearItem"("type");

-- CreateIndex
CREATE INDEX "GearItem_parentId_idx" ON "GearItem"("parentId");
