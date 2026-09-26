-- Signs out every session of a user when their password is changed or reset
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
