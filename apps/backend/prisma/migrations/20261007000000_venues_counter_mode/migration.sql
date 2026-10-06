-- Venues (malls, food courts, cinemas), counter-mode stores, pickup numbers, guest phone contacts and kitchen ETAs

-- CreateEnum
CREATE TYPE "StoreServiceMode" AS ENUM ('TABLES', 'COUNTER');

-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "serviceMode" "StoreServiceMode" NOT NULL DEFAULT 'TABLES',
ADD COLUMN     "venueId" TEXT,
ADD COLUMN     "venueLocation" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "estimatedReadyAt" TIMESTAMP(3),
ADD COLUMN     "guestContactId" TEXT,
ADD COLUMN     "kitchenAt" TIMESTAMP(3),
ADD COLUMN     "pickupNumber" INTEGER;

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "description" TEXT,
    "coverImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StorePickupCounter" (
    "storeId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "last" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StorePickupCounter_pkey" PRIMARY KEY ("storeId","day")
);

-- CreateTable
CREATE TABLE "GuestContact" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Venue_slug_key" ON "Venue"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "GuestContact_phone_key" ON "GuestContact"("phone");

-- CreateIndex
CREATE INDEX "Store_venueId_idx" ON "Store"("venueId");

-- CreateIndex
CREATE INDEX "Order_guestContactId_idx" ON "Order"("guestContactId");

-- AddForeignKey
ALTER TABLE "StorePickupCounter" ADD CONSTRAINT "StorePickupCounter_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_guestContactId_fkey" FOREIGN KEY ("guestContactId") REFERENCES "GuestContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

