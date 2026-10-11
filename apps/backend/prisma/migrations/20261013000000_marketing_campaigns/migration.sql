-- Guests opt in to offers per device; campaigns sent by stores
ALTER TABLE "PushSubscription" ADD COLUMN "marketingOptIn" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "promoCode" TEXT,
    "audience" TEXT NOT NULL,
    "sentById" TEXT,
    "sentByName" TEXT,
    "targeted" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingCampaign_storeId_createdAt_idx" ON "MarketingCampaign"("storeId", "createdAt");

ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
