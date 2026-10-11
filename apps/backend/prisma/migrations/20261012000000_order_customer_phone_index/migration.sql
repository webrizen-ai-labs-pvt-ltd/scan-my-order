-- POS customer directory looks customers up by mobile number
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");
