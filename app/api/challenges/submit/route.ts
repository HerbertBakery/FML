// app/api/challenges/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  challengeId?: string;
  userMonsterIds?: string[]; // monsters being submitted
};

// Helper: rarity ranking
const rarityOrder = ["common", "rare", "epic", "legendary"] as const;

function rarityIndex(r: string | null | undefined): number {
  if (!r) return -1;
  const idx = rarityOrder.indexOf(r.toLowerCase() as any);
  return idx === -1 ? -1 : idx;
}

// Helper: enforce requiredRarity / minRarity
function validateRarityConstraint(
  challenge: {
    minRarity: string | null;
    requiredRarity?: string | null;
  },
  monsters: { rarity: string }[]
) {
  const { minRarity, requiredRarity } = challenge;

  // 1) Exact rarity – if set, ONLY that rarity is allowed
  if (requiredRarity) {
    const required = requiredRarity.toLowerCase();
    const bad = monsters.some(
      (m) => (m.rarity || "").toLowerCase() !== required
    );
    if (bad) {
      throw new Error(
        `This challenge requires ONLY ${requiredRarity.toUpperCase()} monsters.`
      );
    }
    // If we have exact rarity, we don't also enforce minRarity – exact wins.
    return;
  }

  // 2) Legacy behavior: minimum rarity ("RARE or better")
  if (minRarity) {
    const minIdx = rarityIndex(minRarity);
    if (minIdx >= 0) {
      const bad = monsters.some(
        (m) => rarityIndex(m.rarity) < minIdx
      );
      if (bad) {
        throw new Error(
          `All submitted monsters must be at least ${minRarity.toUpperCase()} rarity.`
        );
      }
    }
  }
}

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

      // Position constraint
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

      // Club constraint
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

      // NEW: rarity constraint (exact or min)
      validateRarityConstraint(
        {
          minRarity: challenge.minRarity,
          requiredRarity: (challenge as any).requiredRarity ?? null,
        },
        monsters
      );

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
        const packType =
          challenge.rewardValue || "starter";
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
