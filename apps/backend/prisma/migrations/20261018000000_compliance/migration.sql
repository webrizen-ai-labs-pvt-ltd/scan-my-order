-- Food-safety records for stores on Advanced inventory: the daily hygiene checks a kitchen
-- does, what was found each day, and the licences and certificates the store must keep valid.

CREATE TABLE "HygieneCheck" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'CHECK',
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HygieneCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HygieneCheck_storeId_idx" ON "HygieneCheck"("storeId");
ALTER TABLE "HygieneCheck" ADD CONSTRAINT "HygieneCheck_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "HygieneLog" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "value" DOUBLE PRECISION,
    "note" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HygieneLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "HygieneLog_checkId_day_key" ON "HygieneLog"("checkId", "day");
CREATE INDEX "HygieneLog_storeId_day_idx" ON "HygieneLog"("storeId", "day");
ALTER TABLE "HygieneLog" ADD CONSTRAINT "HygieneLog_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HygieneLog" ADD CONSTRAINT "HygieneLog_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "HygieneCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StoreLicence" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT,
    "issuedBy" TEXT,
    "expiresOn" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StoreLicence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StoreLicence_storeId_expiresOn_idx" ON "StoreLicence"("storeId", "expiresOn");
ALTER TABLE "StoreLicence" ADD CONSTRAINT "StoreLicence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
