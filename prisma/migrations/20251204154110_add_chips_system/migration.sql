-- AlterTable
ALTER TABLE "ChipTemplate" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "MonsterChipAssignment" ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "wasSuccessful" BOOLEAN;

-- AlterTable
ALTER TABLE "UserChip" ADD COLUMN     "consumedAt" TIMESTAMP(3),
ADD COLUMN     "remainingTries" INTEGER NOT NULL DEFAULT 2;
