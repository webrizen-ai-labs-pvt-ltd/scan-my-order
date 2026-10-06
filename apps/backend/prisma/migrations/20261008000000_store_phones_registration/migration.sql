-- More store phone numbers, and an optional registration number (e.g. FSSAI licence)

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "extraPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "registrationNumber" TEXT;

