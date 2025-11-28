-- AlterTable
ALTER TABLE "ObjectiveTemplate" ADD COLUMN     "category" TEXT,
ADD COLUMN     "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seasonCode" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ObjectiveSet" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "seasonCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectiveSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveSetObjective" (
    "id" TEXT NOT NULL,
    "objectiveSetId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,

    CONSTRAINT "ObjectiveSetObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserObjectiveSetProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectiveSetId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserObjectiveSetProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPack" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "isOpened" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveSet_code_key" ON "ObjectiveSet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserObjectiveSetProgress_userId_objectiveSetId_key" ON "UserObjectiveSetProgress"("userId", "objectiveSetId");

-- AddForeignKey
ALTER TABLE "ObjectiveSetObjective" ADD CONSTRAINT "ObjectiveSetObjective_objectiveSetId_fkey" FOREIGN KEY ("objectiveSetId") REFERENCES "ObjectiveSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveSetObjective" ADD CONSTRAINT "ObjectiveSetObjective_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "ObjectiveTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserObjectiveSetProgress" ADD CONSTRAINT "UserObjectiveSetProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserObjectiveSetProgress" ADD CONSTRAINT "UserObjectiveSetProgress_objectiveSetId_fkey" FOREIGN KEY ("objectiveSetId") REFERENCES "ObjectiveSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPack" ADD CONSTRAINT "RewardPack_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
