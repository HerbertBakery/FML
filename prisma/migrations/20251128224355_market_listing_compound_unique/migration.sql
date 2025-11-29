/*
  Warnings:

  - A unique constraint covering the columns `[userMonsterId,isActive]` on the table `MarketListing` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "MarketListing_userMonsterId_key";

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_userMonsterId_isActive_key" ON "MarketListing"("userMonsterId", "isActive");
