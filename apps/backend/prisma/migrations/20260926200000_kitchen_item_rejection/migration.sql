-- Kitchen rejections: per-item status/reason, and refund-due tracking on orders
-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('ACTIVE', 'REJECTED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "refundDue" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "rejectReason" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "status" "OrderItemStatus" NOT NULL DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

