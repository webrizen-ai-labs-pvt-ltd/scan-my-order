-- Packaged items (bottled water, cans, dips) skip the kitchen: ready as soon as they're ordered
ALTER TABLE "MenuItem" ADD COLUMN "isPackaged" BOOLEAN NOT NULL DEFAULT false;
