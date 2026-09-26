-- Corporate invoice details chosen at checkout, applied when the bill is paid
ALTER TABLE "Order" ADD COLUMN "invoiceRequest" JSONB;
ALTER TABLE "TableSession" ADD COLUMN "invoiceRequest" JSONB;
