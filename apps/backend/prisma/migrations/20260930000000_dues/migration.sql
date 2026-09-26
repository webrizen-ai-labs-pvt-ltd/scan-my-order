-- Dues: bills closed on credit and owed by a dues account (e.g. the owner), paid back later.
-- Replaces the short-lived "complimentary" close (no complimentary orders were ever saved).

-- CreateEnum
CREATE TYPE "DuesRepaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE', 'OTHER');

-- AlterEnum
ALTER TYPE "PaymentChannel" ADD VALUE 'DUES';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'ONLINE', 'SPLIT', 'DUES');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TABLE "TableSession" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_compedById_fkey";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "compAmount",
DROP COLUMN "compGuest",
DROP COLUMN "compReason",
DROP COLUMN "compedAt",
DROP COLUMN "compedById",
ADD COLUMN     "duesAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "duesAccountId" TEXT,
ADD COLUMN     "duesGuest" JSONB,
ADD COLUMN     "duesNote" TEXT,
ADD COLUMN     "duesReduced" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duesSettled" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "duesAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DuesAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "note" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DuesAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesRepayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "storeId" TEXT,
    "amount" INTEGER NOT NULL,
    "method" "DuesRepaymentMethod" NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuesRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DuesAllocation" (
    "id" TEXT NOT NULL,
    "repaymentId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DuesAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DuesAccount_tenantId_isActive_idx" ON "DuesAccount"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "DuesRepayment_tenantId_receivedAt_idx" ON "DuesRepayment"("tenantId", "receivedAt");

-- CreateIndex
CREATE INDEX "DuesRepayment_accountId_idx" ON "DuesRepayment"("accountId");

-- CreateIndex
CREATE INDEX "DuesAllocation_paymentId_idx" ON "DuesAllocation"("paymentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_duesAccountId_fkey" FOREIGN KEY ("duesAccountId") REFERENCES "DuesAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesAccount" ADD CONSTRAINT "DuesAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesRepayment" ADD CONSTRAINT "DuesRepayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesRepayment" ADD CONSTRAINT "DuesRepayment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "DuesAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesRepayment" ADD CONSTRAINT "DuesRepayment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesRepayment" ADD CONSTRAINT "DuesRepayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesAllocation" ADD CONSTRAINT "DuesAllocation_repaymentId_fkey" FOREIGN KEY ("repaymentId") REFERENCES "DuesRepayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DuesAllocation" ADD CONSTRAINT "DuesAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
