// app/api/leaderboard/global/route.ts
//
// Global leaderboards:
// - mode=gameweek (default): latest gameweek with scores
// - mode=overall: sum of all gameweeks per user

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const modeParam = url.searchParams.get("mode");
  const mode: "gameweek" | "overall" =
    modeParam === "overall" ? "overall" : "gameweek";

  try {
    if (mode === "gameweek") {
      // Find latest gameweek that actually has scores
      const latest = await prisma.gameweek.findFirst({
        where: {
          scores: {
            some: {}
          }
        },
        orderBy: {
          number: "desc"
        }
      });

      if (!latest) {
        return NextResponse.json({
          mode: "gameweek",
          gameweek: null,
          entries: []
        });
      }

      const scores = await prisma.userGameweekScore.findMany({
        where: { gameweekId: latest.id },
        include: {
          user: true
        },
        orderBy: {
          points: "desc"
        }
      });

      const entries = scores.map((s) => ({
        userId: s.userId,
        email: s.user.email,
        points: s.points
      }));

      return NextResponse.json({
        mode: "gameweek",
        gameweek: {
          id: latest.id,
          number: latest.number,
          name: latest.name,
          deadlineAt: latest.deadlineAt
        },
        entries
      });
    }

    // mode === "overall"
    const grouped = await prisma.userGameweekScore.groupBy({
      by: ["userId"],
      _sum: {
        points: true
      },
      orderBy: {
        _sum: {
          points: "desc"
        }
      }
    });

    if (grouped.length === 0) {
      return NextResponse.json({
        mode: "overall",
        gameweek: null,
        entries: []
      });
    }

    const userIds = grouped.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds }
      }
    });

    const userMap = new Map(
      users.map((u) => [u.id, u.email] as [string, string])
    );

    const entries = grouped.map((g) => ({
      userId: g.userId,
      email: userMap.get(g.userId) ?? "Unknown manager",
      points: g._sum.points ?? 0
    }));

    return NextResponse.json({
      mode: "overall",
      gameweek: null,
      entries
    });
  } catch (err: any) {
    console.error("Error loading leaderboard:", err);
    return NextResponse.json(
      { error: "Failed to load leaderboard." },
      { status: 500 }
    );
  }
}
