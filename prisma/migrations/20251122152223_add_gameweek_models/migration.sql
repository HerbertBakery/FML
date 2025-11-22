-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seasonPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMonster" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "realPlayerName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "club" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "baseMagic" INTEGER NOT NULL,
    "baseDefense" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMonster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackOpen" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackOpen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Squad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Squad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquadMonster" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,

    CONSTRAINT "SquadMonster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gameweek" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gameweek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameweekEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameweekId" INTEGER NOT NULL,
    "selectedMonsterIds" TEXT[],
    "totalPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameweekEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GameweekEntry_userId_gameweekId_key" ON "GameweekEntry"("userId", "gameweekId");

-- AddForeignKey
ALTER TABLE "UserMonster" ADD CONSTRAINT "UserMonster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackOpen" ADD CONSTRAINT "PackOpen_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMonster" ADD CONSTRAINT "SquadMonster_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquadMonster" ADD CONSTRAINT "SquadMonster_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekEntry" ADD CONSTRAINT "GameweekEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameweekEntry" ADD CONSTRAINT "GameweekEntry_gameweekId_fkey" FOREIGN KEY ("gameweekId") REFERENCES "Gameweek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
