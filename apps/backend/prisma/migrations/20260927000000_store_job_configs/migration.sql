-- Scheduled job settings/status move from data/cron-configs.json (lost on every Render deploy) into the database
-- CreateTable
CREATE TABLE "StoreJobConfig" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "enabled" BOOLEAN,
    "schedule" TEXT,
    "params" JSONB,
    "lastRunAt" TIMESTAMP(3),
    "lastRunStatus" TEXT,
    "lastRunSummary" TEXT,
    "lastRunDurationMs" INTEGER,
    "lastRunError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreJobConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreJobConfig_storeId_jobKey_key" ON "StoreJobConfig"("storeId", "jobKey");

-- AddForeignKey
ALTER TABLE "StoreJobConfig" ADD CONSTRAINT "StoreJobConfig_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

