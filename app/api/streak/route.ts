// app/api/streak/route.ts
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

// GET /api/streak
// Returns the user's current streak status and whether they can claim today.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    const streak = await prisma.dailyStreak.findUnique({
      where: { userId: user.id },
    });

    // No streak row yet: treat as fresh, 0 days, fully claimable
    if (!streak) {
      return NextResponse.json({
        streak: {
          currentStreak: 0,
          longestStreak: 0,
          lastClaimedAt: null,
          canClaim: true,
        },
      });
    }

    let canClaim = false;
    if (!streak.lastClaimedAt) {
      canClaim = true;
    } else if (!isSameDay(now, streak.lastClaimedAt)) {
      canClaim = true;
    }

    return NextResponse.json({
      streak: {
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastClaimedAt: streak.lastClaimedAt,
        canClaim,
      },
    });
  } catch (err) {
    console.error("Error fetching streak:", err);
    return NextResponse.json(
      { error: "Failed to load streak." },
      { status: 500 }
    );
  }
}
