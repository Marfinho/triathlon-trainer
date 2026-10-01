-- CreateTable
CREATE TABLE "MailConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "host" TEXT,
    "port" INTEGER,
    "secure" BOOLEAN,
    "user" TEXT,
    "password" TEXT,
    "fromAddr" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MailConfig_pkey" PRIMARY KEY ("id")
);
