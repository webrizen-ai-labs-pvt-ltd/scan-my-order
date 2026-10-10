-- Complimentary (free replacement) orders
ALTER TABLE "Order" ADD COLUMN "complimentaryOfId" TEXT,
ADD COLUMN "complimentaryReason" TEXT,
ADD COLUMN "complimentaryValue" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "OrderItem" ADD COLUMN "compValue" INTEGER;

CREATE INDEX "Order_complimentaryOfId_idx" ON "Order"("complimentaryOfId");
