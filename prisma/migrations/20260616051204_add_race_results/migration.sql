-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RaceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "distance" TEXT,
    "priority" TEXT,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "resultSeconds" INTEGER,
    "resultPlacement" INTEGER,
    "resultNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RaceEvent" ("createdAt", "date", "distance", "id", "name", "notes", "priority", "type", "updatedAt") SELECT "createdAt", "date", "distance", "id", "name", "notes", "priority", "type", "updatedAt" FROM "RaceEvent";
DROP TABLE "RaceEvent";
ALTER TABLE "new_RaceEvent" RENAME TO "RaceEvent";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
