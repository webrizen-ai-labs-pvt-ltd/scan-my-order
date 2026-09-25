-- Payments ledger: per-tender Payment rows, Order.paidAt, offline UPI IDs, Razorpay webhook secret
-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('RAZORPAY', 'UPI_OFFLINE', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "offlineUpiId" TEXT,
ADD COLUMN     "offlineUpiPayeeName" TEXT;

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "offlineUpiId" TEXT,
ADD COLUMN     "offlineUpiPayeeName" TEXT;

-- AlterTable
ALTER TABLE "TenantPaymentGateway" ADD COLUMN     "webhookSecret" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "orderId" TEXT,
    "tableSessionId" TEXT,
    "channel" "PaymentChannel" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" INTEGER NOT NULL,
    "providerKind" TEXT,
    "providerRef" TEXT,
    "providerPaymentId" TEXT,
    "qrImageUrl" TEXT,
    "qrPayload" TEXT,
    "cashTendered" INTEGER,
    "changeDue" INTEGER,
    "collectedById" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerRef_key" ON "Payment"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_tableSessionId_idx" ON "Payment"("tableSessionId");

-- CreateIndex
CREATE INDEX "Payment_storeId_status_idx" ON "Payment"("storeId", "status");

-- CreateIndex
CREATE INDEX "Payment_status_channel_idx" ON "Payment"("status", "channel");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_collectedById_fkey" FOREIGN KEY ("collectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

