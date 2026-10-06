-- CreateTable
CREATE TABLE "DeviceCode" (
    "id" TEXT NOT NULL,
    "deviceCodeHash" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '["tv"]',
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCode_deviceCodeHash_key" ON "DeviceCode"("deviceCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceCode_userCode_key" ON "DeviceCode"("userCode");

-- CreateIndex
CREATE INDEX "DeviceCode_expiresAt_idx" ON "DeviceCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_tokenHash_key" ON "DeviceToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- AddForeignKey
ALTER TABLE "DeviceCode" ADD CONSTRAINT "DeviceCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

