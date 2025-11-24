// app/api/challenges/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  challengeId?: string;
  userMonsterIds?: string[]; // monsters being submitted
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { challengeId, userMonsterIds } = body;

  if (!challengeId || !userMonsterIds || userMonsterIds.length === 0) {
    return NextResponse.json(
      {
        error:
          "challengeId and at least one userMonsterId are required.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const challenge =
        await tx.squadChallengeTemplate.findUnique({
          where: { id: challengeId },
        });

      if (!challenge || !challenge.isActive) {
        throw new Error("Challenge not available.");
      }

      // If NOT repeatable, ensure the user has not already completed it.
      if (!challenge.isRepeatable) {
        const alreadyCompleted =
          await tx.squadChallengeSubmission.findFirst({
            where: {
              challengeId: challenge.id,
              userId: user.id,
              completedAt: {
                not: null,
              },
            },
          });

        if (alreadyCompleted) {
          throw new Error(
            "You have already completed this challenge. It is not repeatable."
          );
        }
      }

      // Load monsters & validate ownership + not consumed
      const monsters = await tx.userMonster.findMany({
        where: {
          id: { in: userMonsterIds },
          userId: user.id,
          isConsumed: false,
        },
      });

      if (monsters.length !== userMonsterIds.length) {
        throw new Error(
          "One or more selected monsters are invalid or not owned by you."
        );
      }

      if (monsters.length < challenge.minMonsters) {
        throw new Error(
          `This challenge requires at least ${challenge.minMonsters} monsters.`
        );
      }

      // Very simple checks for requiredPosition, club, rarity, etc.
      if (challenge.requiredPosition) {
        const ok = monsters.every(
          (m) => m.position === challenge.requiredPosition
        );
        if (!ok) {
          throw new Error(
            `All submitted monsters must be position ${challenge.requiredPosition}.`
          );
        }
      }

      if (challenge.requiredClub) {
        const ok = monsters.every(
          (m) => m.club === challenge.requiredClub
        );
        if (!ok) {
          throw new Error(
            `All submitted monsters must be from club ${challenge.requiredClub}.`
          );
        }
      }

      if (challenge.minRarity) {
        const minReq = challenge.minRarity.toLowerCase();
        const rarOrder = ["common", "rare", "epic", "legendary"];
        const minIndex = rarOrder.indexOf(minReq);
        if (minIndex >= 0) {
          const ok = monsters.every((m) => {
            const idx = rarOrder.indexOf(
              (m.rarity || "").toLowerCase()
            );
            return idx >= minIndex;
          });
          if (!ok) {
            throw new Error(
              `All submitted monsters must be at least ${challenge.minRarity} rarity.`
            );
          }
        }
      }

      // Create submission
      const submission =
        await tx.squadChallengeSubmission.create({
          data: {
            userId: user.id,
            challengeId: challenge.id,
            completedAt: new Date(),
            rewardGranted: false,
          },
        });

      // Link monsters to submission
      await tx.squadChallengeSubmissionMonster.createMany({
        data: monsters.map((m) => ({
          submissionId: submission.id,
          userMonsterId: m.id,
        })),
      });

      const monsterIds = monsters.map((m) => m.id);

      // "Consume" monsters:

      // 1) Flag as consumed (but do NOT delete, to avoid FK issues)
      await tx.userMonster.updateMany({
        where: { id: { in: monsterIds } },
        data: { isConsumed: true },
      });

      // 2) Remove from any squads
      await tx.squadMonster.deleteMany({
        where: {
          userMonsterId: { in: monsterIds },
        },
      });

      // 3) Remove from any locked gameweek entries
      await tx.gameweekEntryMonster.deleteMany({
        where: {
          userMonsterId: { in: monsterIds },
        },
      });

      // 4) Deactivate any marketplace listings for these monsters
      await tx.marketListing.updateMany({
        where: {
          userMonsterId: { in: monsterIds },
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Grant reward
      let rewardDescription = "";
      if (challenge.rewardType === "coins") {
        const coins =
          parseInt(challenge.rewardValue, 10) || 0;
        if (coins > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              coins: { increment: coins },
            },
          });
          rewardDescription = `${coins} coins`;
        }
      } else if (challenge.rewardType === "pack") {
        const packType = challenge.rewardValue || "starter";
        await tx.packOpen.create({
          data: {
            userId: user.id,
            packType,
          },
        });
        rewardDescription = `${packType} pack`;
      } else {
        rewardDescription = challenge.rewardValue;
      }

      // Mark reward as granted
      await tx.squadChallengeSubmission.update({
        where: { id: submission.id },
        data: {
          rewardGranted: true,
        },
      });

      return {
        submissionId: submission.id,
        consumedMonsterIds: monsterIds,
        reward: rewardDescription,
      };
    });

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error submitting challenge:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to submit challenge.",
      },
      { status: 400 }
    );
  }
}
