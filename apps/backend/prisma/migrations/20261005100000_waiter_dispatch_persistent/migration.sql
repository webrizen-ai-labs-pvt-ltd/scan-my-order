-- Waiter call dispatch kept in the database (was server memory): survives restarts and deploys.

-- CreateEnum
CREATE TYPE "WaiterAvailability" AS ENUM ('AVAILABLE', 'BUSY');

-- AlterTable
ALTER TABLE "WaiterCall" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedWaiterId" TEXT,
ADD COLUMN     "attemptedWaiterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "escalateAt" TIMESTAMP(3),
ADD COLUMN     "escalationLevel" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WaiterPresence" (
    "storeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "WaiterAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "lastResolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiterPresence_pkey" PRIMARY KEY ("storeId","userId")
);

-- CreateIndex
CREATE INDEX "WaiterCall_status_escalateAt_idx" ON "WaiterCall"("status", "escalateAt");

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_assignedWaiterId_fkey" FOREIGN KEY ("assignedWaiterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterPresence" ADD CONSTRAINT "WaiterPresence_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterPresence" ADD CONSTRAINT "WaiterPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Calls left waiting from before (their in-memory dispatch is gone): show them to managers
UPDATE "WaiterCall" SET "escalationLevel" = 2 WHERE "status" = 'PENDING';
