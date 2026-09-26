-- Bills a manager closes without payment ("on the house"): the order total becomes 0 and the waived value is recorded
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'COMPLIMENTARY';

ALTER TABLE "Order" ADD COLUMN "compAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "compReason" TEXT,
ADD COLUMN "compedAt" TIMESTAMP(3),
ADD COLUMN "compedById" TEXT;

ALTER TABLE "Order" ADD CONSTRAINT "Order_compedById_fkey" FOREIGN KEY ("compedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
