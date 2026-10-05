-- Promo applied to a whole table bill at checkout

-- AlterTable
ALTER TABLE "TableSession" ADD COLUMN     "promoCodeId" TEXT;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

