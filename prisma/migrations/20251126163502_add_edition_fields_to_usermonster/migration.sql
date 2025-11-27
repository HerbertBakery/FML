-- CreateEnum
CREATE TYPE "EditionType" AS ENUM ('BASE', 'THEMED', 'LIMITED');

-- AlterTable
ALTER TABLE "UserMonster" ADD COLUMN     "artBasePath" TEXT,
ADD COLUMN     "artHoverPath" TEXT,
ADD COLUMN     "editionLabel" TEXT,
ADD COLUMN     "editionType" "EditionType" NOT NULL DEFAULT 'BASE',
ADD COLUMN     "serialNumber" INTEGER,
ADD COLUMN     "setCode" TEXT,
ADD COLUMN     "traitsJson" JSONB;
