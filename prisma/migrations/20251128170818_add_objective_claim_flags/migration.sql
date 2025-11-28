-- AlterTable
ALTER TABLE "ObjectiveProgress" ADD COLUMN     "rewardClaimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "UserObjectiveSetProgress" ADD COLUMN     "rewardClaimedAt" TIMESTAMP(3);
