// app/api/me/summary/route.ts
//
// Returns a summary for the logged-in manager:
// - basic user info
// - coins
// - total monsters owned
// - latest gameweek score (if any)
// - total season points (sum of all gameweeks)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        coins: true,
        createdAt: true
      }
    });

    if (!dbUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const [monsterCount, latestScore, seasonTotals] =
      await Promise.all([
        prisma.userMonster.count({
          where: { userId: dbUser.id }
        }),
        prisma.userGameweekScore.findFirst({
          where: { userId: dbUser.id },
          include: {
            gameweek: true
          },
          orderBy: {
            gameweek: {
              number: "desc"
            }
          }
        }),
        prisma.userGameweekScore.aggregate({
          _sum: {
            points: true
          },
          where: {
            userId: dbUser.id
          }
        })
      ]);

    const seasonTotalPoints =
      seasonTotals._sum.points ?? 0;

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        coins: dbUser.coins,
        createdAt: dbUser.createdAt
      },
      monsters: {
        totalOwned: monsterCount
      },
      latestGameweek: latestScore
        ? {
            gameweekId: latestScore.gameweekId,
            number: latestScore.gameweek.number,
            name: latestScore.gameweek.name,
            points: latestScore.points
          }
        : null,
      season: {
        totalPoints: seasonTotalPoints
      }
    });
  } catch (err) {
    console.error("Error loading manager summary:", err);
    return NextResponse.json(
      {
        error: "Failed to load manager summary."
      },
      { status: 500 }
    );
  }
}
