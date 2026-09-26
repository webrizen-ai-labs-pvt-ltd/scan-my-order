-- Cutlery and table-cleaning requests get their own call types (they were saved as CALL_WAITER),
-- and the guest's note is stored instead of living only in server memory
ALTER TYPE "WaiterCallType" ADD VALUE IF NOT EXISTS 'CUTLERY';
ALTER TYPE "WaiterCallType" ADD VALUE IF NOT EXISTS 'CLEAN_TABLE';
ALTER TABLE "WaiterCall" ADD COLUMN "note" TEXT;
