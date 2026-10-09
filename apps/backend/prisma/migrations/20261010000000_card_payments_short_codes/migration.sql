-- Card machine payments recorded at the POS, and optional item short codes for fast billing

-- AlterEnum
ALTER TYPE "PaymentChannel" ADD VALUE 'CARD';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "shortCode" TEXT;

