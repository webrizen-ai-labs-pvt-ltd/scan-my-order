-- Plans carry features; subscriptions carry platform-granted extras; payments are recorded
ALTER TABLE "SubscriptionPlan" ADD COLUMN "description" TEXT,
ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TenantSubscription" ADD COLUMN "extraFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "maxStoresOverride" INTEGER,
ADD COLUMN "adminNote" TEXT;

CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sourceApp" TEXT,
    "initiatedById" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SubscriptionPayment_transactionId_key" ON "SubscriptionPayment"("transactionId");
CREATE INDEX "SubscriptionPayment_tenantId_createdAt_idx" ON "SubscriptionPayment"("tenantId", "createdAt");
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPayment" ADD CONSTRAINT "SubscriptionPayment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The three existing plans get the feature split agreed on 2026-10-11
UPDATE "SubscriptionPlan" SET "sortOrder" = 1, "description" = 'One outlet: billing, QR menu and kitchen screen', "features" = ARRAY[]::TEXT[] WHERE "name" = 'Starter Plan';
UPDATE "SubscriptionPlan" SET "sortOrder" = 2, "description" = 'Run the floor, control stock and stop leakage',
  "features" = ARRAY['WAITER_PANEL','RESERVATIONS','COMPLIMENTARY','ONLINE_PAYMENTS','DUES','CORPORATE_INVOICES','INVENTORY','LEAKAGES','PROMO_CODES','CUSTOMERS'] WHERE "name" = 'Growth Plan';
UPDATE "SubscriptionPlan" SET "sortOrder" = 3, "description" = 'Everything, for chains and food courts',
  "features" = ARRAY['WAITER_PANEL','RESERVATIONS','COMPLIMENTARY','ONLINE_PAYMENTS','DUES','CORPORATE_INVOICES','INVENTORY','LEAKAGES','TABLE_ANALYTICS','PROMO_CODES','CUSTOMERS','CAMPAIGNS','LOYALTY','ITEM_VIDEOS'] WHERE "name" = 'Enterprise Plan';

-- Until now nothing ever ended a subscription. Ones already past their end date get a week
-- of grace from today instead of being cut off the moment enforcement starts.
UPDATE "TenantSubscription" SET "status" = 'PAST_DUE', "gracePeriodEndsAt" = NOW() + INTERVAL '7 days'
WHERE "currentPeriodEnd" < NOW() AND "status" IN ('ACTIVE', 'TRIALING');
