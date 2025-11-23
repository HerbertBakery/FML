// app/api/challenges/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  challengeId?: string;
  userMonsterIds?: string[];
};

function normalizeStr(s: string | null | undefined) {
  return (s || "").trim().toUpperCase();
}

// Very simple rarity "ranking" for comparisons if you want to extend later
const rarityOrder = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

function rarityMeets(min: string | null | undefined, actual: string) {
  if (!min) return true; // no requirement
  const m = rarityOrder.indexOf(normalizeStr(min));
  const a = rarityOrder.indexOf(normalizeStr(actual));
  if (m === -1 || a === -1) return true; // if unknown, don't block
  return a >= m;
}

// POST /api/challenges/submit
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    // ignore, will validate below
  }

  const challengeId = body.challengeId || "";
  const userMonsterIds = body.userMonsterIds || [];

  if (!challengeId || !Array.isArray(userMonsterIds) || userMonsterIds.length === 0) {
    return NextResponse.json(
      { error: "Challenge ID and at least one monster are required." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Load challenge
      const challenge = await tx.squadChallengeTemplate.findUnique({
        where: { id: challengeId }
      });

      if (!challenge || !challenge.isActive) {
        throw new Error("Challenge not found or inactive.");
      }

      // Load monsters that belong to this user
      const monsters = await tx.userMonster.findMany({
        where: {
          id: { in: userMonsterIds },
          userId: user.id,
          isConsumed: false
        }
      });

      if (monsters.length !== userMonsterIds.length) {
        throw new Error(
          "Some selected monsters do not exist, are not yours, or are already consumed."
        );
      }

      // Basic constraint: minMonsters
      if (monsters.length < challenge.minMonsters) {
        throw new Error(
          `You must submit at least ${challenge.minMonsters} monsters for this challenge.`
        );
      }

      // Constraint: requiredPosition (at least one monster with this position)
      if (challenge.requiredPosition) {
        const requiredPos = normalizeStr(challenge.requiredPosition);
        const hasRequiredPos = monsters.some(
          (m) => normalizeStr(m.position) === requiredPos
        );
        if (!hasRequiredPos) {
          throw new Error(
            `You must include at least one ${challenge.requiredPosition} in this challenge.`
          );
        }
      }

      // Constraint: requiredClub (at least one from this club code/short name)
      if (challenge.requiredClub) {
        const requiredClub = normalizeStr(challenge.requiredClub);
        const hasRequiredClub = monsters.some(
          (m) => normalizeStr(m.club) === requiredClub
        );
        if (!hasRequiredClub) {
          throw new Error(
            `You must include at least one monster from club ${challenge.requiredClub}.`
          );
        }
      }

      // Constraint: minRarity (all monsters must be >= min)
      if (challenge.minRarity) {
        const bad = monsters.filter(
          (m) => !rarityMeets(challenge.minRarity, m.rarity)
        );
        if (bad.length > 0) {
          throw new Error(
            `All submitted monsters must be at least ${challenge.minRarity} rarity.`
          );
        }
      }

      // Handle reward: coins only for now
      let coinsGranted = 0;
      let coinsAfter = undefined as number | undefined;

      if (challenge.rewardType === "coins") {
        const val = parseInt(challenge.rewardValue, 10);
        coinsGranted = isNaN(val) ? 0 : Math.max(0, val);

        if (coinsGranted > 0) {
          const updatedUser = await tx.user.update({
            where: { id: user.id },
            data: {
              coins: {
                increment: coinsGranted
              }
            }
          });
          coinsAfter = updatedUser.coins;
        } else {
          coinsAfter = (
            await tx.user.findUnique({ where: { id: user.id } })
          )?.coins ?? 0;
        }
      } else {
        throw new Error(
          "This challenge has an unsupported reward type. (Coins only for now.)"
        );
      }

      // Create submission + link monsters
      const submission = await tx.squadChallengeSubmission.create({
        data: {
          userId: user.id,
          challengeId: challenge.id,
          completedAt: new Date(),
          rewardGranted: true,
          monsters: {
            create: monsters.map((m) => ({
              userMonsterId: m.id
            }))
          }
        }
      });

      // Remove these monsters from any saved squads
      await tx.squadMonster.deleteMany({
        where: {
          userMonsterId: { in: userMonsterIds }
        }
      });

      // (Optional but sensible) remove from any gameweek entries too
      await tx.gameweekEntryMonster.deleteMany({
        where: {
          userMonsterId: { in: userMonsterIds }
        }
      });

      // Mark monsters as consumed, so they vanish from the collection / squad builder
      await tx.userMonster.updateMany({
        where: {
          id: { in: userMonsterIds },
          userId: user.id
        },
        data: {
          isConsumed: true
        }
      });

      // Log history for each consumed monster
      await Promise.all(
        monsters.map((m) =>
          tx.monsterHistoryEvent.create({
            data: {
              userMonsterId: m.id,
              actorUserId: user.id,
              action: "CONSUMED_SBC",
              description: `Consumed in SBC: ${challenge.name} (${challenge.code})`
            }
          })
        )
      );

      return {
        submissionId: submission.id,
        coinsGranted,
        coinsAfter
      };
    });

    return NextResponse.json({
      ok: true,
      submissionId: result.submissionId,
      coinsGranted: result.coinsGranted,
      coinsAfter: result.coinsAfter
    });
  } catch (err: any) {
    console.error("Error submitting challenge:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to submit challenge." },
      { status: 400 }
    );
  }
}
