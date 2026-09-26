-- Name and contact of the guest whose bill was closed without payment
ALTER TABLE "Order" ADD COLUMN "compGuest" JSONB;
