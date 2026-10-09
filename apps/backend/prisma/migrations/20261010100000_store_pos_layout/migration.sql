-- Which POS billing screen a store uses: CLASSIC (default) or MODERN

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "posLayout" TEXT NOT NULL DEFAULT 'CLASSIC';

