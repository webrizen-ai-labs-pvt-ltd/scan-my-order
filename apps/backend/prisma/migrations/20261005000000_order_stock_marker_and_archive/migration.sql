-- Stock marker: stock moves only when this flips, so an order's ingredients can't be taken or returned twice.
-- Archive: old cancelled orders are hidden from Order History instead of being deleted.

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "stockDeductedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Orders that already reached the kitchen had their stock taken (cancelled ones had it returned)
UPDATE "Order" SET "stockDeductedAt" = "updatedAt" WHERE "status" IN ('PROCESSING', 'READY', 'SERVED', 'SETTLED');
