-- CreateEnum
CREATE TYPE "WaiterCallType" AS ENUM ('WATER', 'BILL', 'CALL_WAITER');

-- CreateEnum
CREATE TYPE "WaiterCallStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED', 'RESOLVED');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "googleReviewUrl" TEXT;

-- AlterTable
ALTER TABLE "TenantSubscription" ADD COLUMN     "gracePeriodEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WaiterCall" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "type" "WaiterCallType" NOT NULL,
    "status" "WaiterCallStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiterCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaiterCall_storeId_status_idx" ON "WaiterCall"("storeId", "status");

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
