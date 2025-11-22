// app/api/me/gameweeks/route.ts
//
// Returns all gameweek scores for the logged-in manager,
// with gameweek metadata, sorted by gameweek number.

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
    const scores = await prisma.userGameweekScore.findMany({
      where: { userId: user.id },
      include: {
        gameweek: true
      },
      orderBy: {
        gameweek: {
          number: "asc"
        }
      }
    });

    const entries = scores.map((s) => ({
      gameweekId: s.gameweekId,
      number: s.gameweek.number,
      name: s.gameweek.name,
      points: s.points
    }));

    return NextResponse.json({
      entries
    });
  } catch (err) {
    console.error("Error loading manager gameweeks:", err);
    return NextResponse.json(
      {
        error: "Failed to load gameweek history."
      },
      { status: 500 }
    );
  }
}
