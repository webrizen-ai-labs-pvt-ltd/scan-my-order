-- Advanced inventory: suppliers, deliveries, lots with use-by dates, standing deliveries
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'WASTE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'COUNT';

ALTER TABLE "Store" ADD COLUMN "inventoryMode" TEXT NOT NULL DEFAULT 'BASIC';

ALTER TABLE "RawMaterial" ADD COLUMN "shortCode" TEXT,
ADD COLUMN "shelfLifeDays" INTEGER,
ADD COLUMN "packName" TEXT,
ADD COLUMN "packSize" DOUBLE PRECISION,
ADD COLUMN "costPerUnit" DOUBLE PRECISION,
ADD COLUMN "lastCountedAt" TIMESTAMP(3);

ALTER TABLE "StockTransaction" ADD COLUMN "reason" TEXT,
ADD COLUMN "batchId" TEXT,
ADD COLUMN "actorName" TEXT;
CREATE INDEX "StockTransaction_materialId_createdAt_idx" ON "StockTransaction"("materialId", "createdAt");

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "fssaiNumber" TEXT,
    "gstin" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Supplier_storeId_idx" ON "Supplier"("storeId");
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StockReceipt" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT,
    "billNumber" TEXT,
    "note" TEXT,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "standingDeliveryId" TEXT,
    "receivedById" TEXT,
    "receivedByName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockReceipt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockReceipt_storeId_receivedAt_idx" ON "StockReceipt"("storeId", "receivedAt");
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StockBatch" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "receiptId" TEXT,
    "supplierId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'RECEIVED',
    "quantity" DOUBLE PRECISION NOT NULL,
    "originalQuantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedReason" TEXT,
    CONSTRAINT "StockBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StockBatch_materialId_closedAt_idx" ON "StockBatch"("materialId", "closedAt");
CREATE INDEX "StockBatch_storeId_expiresAt_idx" ON "StockBatch"("storeId", "expiresAt");
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockBatch" ADD CONSTRAINT "StockBatch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "StandingDelivery" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "supplierId" TEXT,
    "name" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "arrivesByHour" INTEGER NOT NULL DEFAULT 7,
    "lines" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPostedOn" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StandingDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "StandingDelivery_storeId_idx" ON "StandingDelivery"("storeId");
ALTER TABLE "StandingDelivery" ADD CONSTRAINT "StandingDelivery_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StandingDelivery" ADD CONSTRAINT "StandingDelivery_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Advanced inventory is part of the Enterprise plan (the platform can grant it to any brand)
UPDATE "SubscriptionPlan" SET "features" = array_append("features", 'ADVANCED_INVENTORY')
WHERE "name" = 'Enterprise Plan' AND NOT ('ADVANCED_INVENTORY' = ANY("features"));
