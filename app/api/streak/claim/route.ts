// app/api/streak/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

function isSameDay(a: Date, b: Date) {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function dayDiff(a: Date, b: Date) {
  // difference in whole days using UTC dates
  const aUTC = Date.UTC(
    a.getUTCFullYear(),
    a.getUTCMonth(),
    a.getUTCDate()
  );
  const bUTC = Date.UTC(
    b.getUTCFullYear(),
    b.getUTCMonth(),
    b.getUTCDate()
  );
  const diffMs = aUTC - bUTC;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// POST /api/streak/claim
// Claims today's daily reward, updating current & longest streak and granting coins.
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      let streak = await tx.dailyStreak.findUnique({
        where: { userId: user.id },
      });

      // First-ever claim: create streak row and treat as day 1
      if (!streak) {
        const coinsGranted = 50 * 1;

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            coins: {
              increment: coinsGranted,
            },
          },
        });

        const createdStreak = await tx.dailyStreak.create({
          data: {
            userId: user.id,
            currentStreak: 1,
            longestStreak: 1,
            lastClaimedAt: now,
          },
        });

        return {
          coinsGranted,
          coinsAfter: updatedUser.coins,
          currentStreak: createdStreak.currentStreak,
          longestStreak: createdStreak.longestStreak,
          lastClaimedAt: createdStreak.lastClaimedAt,
        };
      }

      if (streak.lastClaimedAt && isSameDay(now, streak.lastClaimedAt)) {
        throw new Error("You have already claimed today's reward.");
      }

      let newCurrentStreak: number;
      if (!streak.lastClaimedAt) {
        newCurrentStreak = 1;
      } else {
        const diffDays = dayDiff(now, streak.lastClaimedAt);
        if (diffDays === 1) {
          // consecutive day
          newCurrentStreak = streak.currentStreak + 1;
        } else {
          // missed a day (or more)
          newCurrentStreak = 1;
        }
      }

      const newLongestStreak = Math.max(
        streak.longestStreak,
        newCurrentStreak
      );

      // Reward: simple formula (50 coins * current streak)
      const coinsGranted = 50 * newCurrentStreak;

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          coins: {
            increment: coinsGranted,
          },
        },
      });

      const updatedStreak = await tx.dailyStreak.update({
        where: { userId: user.id },
        data: {
          currentStreak: newCurrentStreak,
          longestStreak: newLongestStreak,
          lastClaimedAt: now,
        },
      });

      return {
        coinsGranted,
        coinsAfter: updatedUser.coins,
        currentStreak: updatedStreak.currentStreak,
        longestStreak: updatedStreak.longestStreak,
        lastClaimedAt: updatedStreak.lastClaimedAt,
      };
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error claiming streak:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to claim daily reward." },
      { status: 400 }
    );
  }
}
