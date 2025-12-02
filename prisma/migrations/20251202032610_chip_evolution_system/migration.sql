-- AlterTable
ALTER TABLE "UserMonster" ADD COLUMN     "blankStreak" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ChipTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conditionType" TEXT NOT NULL,
    "minRarity" TEXT,
    "maxRarity" TEXT,
    "allowedPositions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChipTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserChip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "isConsumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserChip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonsterChipAssignment" (
    "id" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "userChipId" TEXT NOT NULL,
    "gameweekId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonsterChipAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChipTemplate_code_key" ON "ChipTemplate"("code");

-- AddForeignKey
ALTER TABLE "UserChip" ADD CONSTRAINT "UserChip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserChip" ADD CONSTRAINT "UserChip_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChipTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterChipAssignment" ADD CONSTRAINT "MonsterChipAssignment_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterChipAssignment" ADD CONSTRAINT "MonsterChipAssignment_userChipId_fkey" FOREIGN KEY ("userChipId") REFERENCES "UserChip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterChipAssignment" ADD CONSTRAINT "MonsterChipAssignment_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
