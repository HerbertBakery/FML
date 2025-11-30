-- AlterTable
ALTER TABLE "MarketListing" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "resolutionStatus" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3);
