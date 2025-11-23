-- CreateTable
CREATE TABLE "SquadChallengeTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minMonsters" INTEGER NOT NULL DEFAULT 3,
    "minRarity" TEXT,
    "requiredPosition" TEXT,
    "requiredClub" TEXT,
    "requiredNation" TEXT,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquadChallengeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadChallengeSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SquadChallengeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadChallengeSubmissionMonster" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,

    CONSTRAINT "SquadChallengeSubmissionMonster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetValue" INTEGER NOT NULL DEFAULT 1,
    "rewardType" TEXT NOT NULL,
    "rewardValue" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectiveTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObjectiveProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "currentValue" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObjectiveProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStreak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyStreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SquadChallengeTemplate_code_key" ON "SquadChallengeTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveTemplate_code_key" ON "ObjectiveTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ObjectiveProgress_userId_objectiveId_key" ON "ObjectiveProgress"("userId", "objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyStreak_userId_key" ON "DailyStreak"("userId");

-- AddForeignKey
ALTER TABLE "SquadChallengeSubmission" ADD CONSTRAINT "SquadChallengeSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadChallengeSubmission" ADD CONSTRAINT "SquadChallengeSubmission_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "SquadChallengeTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadChallengeSubmissionMonster" ADD CONSTRAINT "SquadChallengeSubmissionMonster_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "SquadChallengeSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadChallengeSubmissionMonster" ADD CONSTRAINT "SquadChallengeSubmissionMonster_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveProgress" ADD CONSTRAINT "ObjectiveProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObjectiveProgress" ADD CONSTRAINT "ObjectiveProgress_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "ObjectiveTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStreak" ADD CONSTRAINT "DailyStreak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
