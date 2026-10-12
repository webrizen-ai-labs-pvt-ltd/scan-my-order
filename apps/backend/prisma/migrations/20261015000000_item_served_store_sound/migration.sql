-- Lines can be served one at a time; each store picks its notification sound
ALTER TABLE "OrderItem" ADD COLUMN "servedAt" TIMESTAMP(3),
ADD COLUMN "servedById" TEXT;

ALTER TABLE "Store" ADD COLUMN "notificationSound" TEXT NOT NULL DEFAULT 'classic';

-- Orders already served or closed: their lines were served too
UPDATE "OrderItem" SET "servedAt" = o."updatedAt"
FROM "Order" o
WHERE "OrderItem"."orderId" = o."id" AND o."status" IN ('SERVED', 'SETTLED') AND "OrderItem"."status" = 'ACTIVE';
