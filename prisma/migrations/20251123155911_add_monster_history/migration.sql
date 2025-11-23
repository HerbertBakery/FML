-- CreateTable
CREATE TABLE "MonsterHistoryEvent" (
    "id" TEXT NOT NULL,
    "userMonsterId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonsterHistoryEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "MonsterHistoryEvent" ADD CONSTRAINT "MonsterHistoryEvent_userMonsterId_fkey" FOREIGN KEY ("userMonsterId") REFERENCES "UserMonster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonsterHistoryEvent" ADD CONSTRAINT "MonsterHistoryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
