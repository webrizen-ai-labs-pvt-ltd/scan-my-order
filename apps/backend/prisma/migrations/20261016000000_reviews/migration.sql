-- Guest reviews: overall stars per visit, stars per dish, Google review links
ALTER TABLE "Store" ADD COLUMN "showRatings" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Tenant" ADD COLUMN "googleReviewUrl" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "ratingSum" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "reviewId" TEXT;

CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "customerId" TEXT,
    "sessionId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "tableNumber" INTEGER,
    "orderTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ItemRating" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ItemRating_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Review_storeId_createdAt_idx" ON "Review"("storeId", "createdAt");
CREATE UNIQUE INDEX "ItemRating_reviewId_menuItemId_key" ON "ItemRating"("reviewId", "menuItemId");
CREATE INDEX "ItemRating_menuItemId_idx" ON "ItemRating"("menuItemId");
CREATE INDEX "ItemRating_storeId_createdAt_idx" ON "ItemRating"("storeId", "createdAt");
CREATE INDEX "Order_reviewId_idx" ON "Order"("reviewId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemRating" ADD CONSTRAINT "ItemRating_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemRating" ADD CONSTRAINT "ItemRating_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reviews are part of the Growth and Enterprise plans
UPDATE "SubscriptionPlan" SET "features" = array_append("features", 'REVIEWS')
WHERE "name" IN ('Growth Plan', 'Enterprise Plan') AND NOT ('REVIEWS' = ANY("features"));
