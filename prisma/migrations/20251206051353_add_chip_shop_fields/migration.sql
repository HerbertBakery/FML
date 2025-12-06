-- AlterTable
ALTER TABLE "ChipTemplate" ADD COLUMN     "isInShop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shopPrice" INTEGER;
