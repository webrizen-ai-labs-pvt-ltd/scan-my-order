-- Guests paying by UPI to the store's own ID (staff confirm), pay-at-counter, and the kitchen-before-confirmation setting

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "payAtCounter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "startBeforeUpiConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "guestPayMethod" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "fromGuest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "guestClaimedAt" TIMESTAMP(3),
ADD COLUMN     "guestReference" TEXT;

-- CreateIndex
CREATE INDEX "Payment_storeId_guestReference_idx" ON "Payment"("storeId", "guestReference");

