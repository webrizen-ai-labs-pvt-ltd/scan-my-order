-- Kitchen timing: per-item ready, order readyAt (recall window), announced delay minutes
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "delayMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "readyAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "readyAt" TIMESTAMP(3);

