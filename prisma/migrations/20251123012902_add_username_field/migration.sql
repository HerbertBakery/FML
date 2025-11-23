/*
  Warnings:

  - The primary key for the `Gameweek` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `endAt` on the `Gameweek` table. All the data in the column will be lost.
  - You are about to drop the column `startAt` on the `Gameweek` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Gameweek` table. All the data in the column will be lost.
  - You are about to drop the column `selectedMonsterIds` on the `GameweekEntry` table. All the data in the column will be lost.
  - You are about to drop the column `totalPoints` on the `GameweekEntry` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `GameweekEntry` table. All the data in the column will be lost.
  - You are about to drop the column `seasonPoints` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `number` to the `Gameweek` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "GameweekEntry" DROP CONSTRAINT "GameweekEntry_gameweekId_fkey";

-- DropIndex
DROP INDEX "GameweekEntry_userId_gameweekId_key";

-- AlterTable
ALTER TABLE "Gameweek" DROP CONSTRAINT "Gameweek_pkey",
DROP COLUMN "endAt",
DROP COLUMN "startAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "number" INTEGER NOT NULL,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "name" DROP NOT NULL,
ADD CONSTRAINT "Gameweek_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "GameweekEntry" DROP COLUMN "selectedMonsterIds",
DROP COLUMN "totalPoints",
DROP COLUMN "updatedAt",
ALTER COLUMN "gameweekId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "seasonPoints",
ADD COLUMN     "coins" INTEGER NOT NULL DEFAULT 1000,
ADD COLUMN     "username" TEXT;

-- AlterTable
ALTER TABLE "UserMonster" ADD COLUMN     "evolutionLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalAssists" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCleanSheets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalFantasyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalGoals" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "GameweekEntryMonster" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "isSub" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "GameweekEntryMonster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameweekScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGameweekScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvolutionEvent" (
    "id" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "gameweekId" TEXT,
    "reason" TEXT NOT NULL,
    "oldLevel" INTEGER NOT NULL,
    "newLevel" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvolutionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketTransaction" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserGameweekScore_userId_gameweekId_key" ON "UserGameweekScore"("userId", "gameweekId");

-- CreateIndex
CREATE UNIQUE INDEX "League_code_key" ON "League"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_leagueId_userId_key" ON "LeagueMember"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketListing_userMonsterId_key" ON "MarketListing"("userMonsterId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "GameweekEntry" ADD CONSTRAINT "GameweekEntry_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekEntryMonster" ADD CONSTRAINT "GameweekEntryMonster_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "GameweekEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekEntryMonster" ADD CONSTRAINT "GameweekEntryMonster_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekScore" ADD CONSTRAINT "UserGameweekScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameweekScore" ADD CONSTRAINT "UserGameweekScore_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionEvent" ADD CONSTRAINT "EvolutionEvent_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvolutionEvent" ADD CONSTRAINT "EvolutionEvent_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketListing" ADD CONSTRAINT "MarketListing_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "MarketListing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketTransaction" ADD CONSTRAINT "MarketTransaction_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
