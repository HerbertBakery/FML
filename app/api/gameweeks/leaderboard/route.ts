// app/api/gameweeks/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentGameweek } from "@/lib/gameweeks";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gw = await getOrCreateCurrentGameweek();

  const scores = await prisma.userGameweekScore.findMany({
    where: { gameweekId: gw.id },
    include: { user: true },
    orderBy: { points: "desc" }
  });

  return NextResponse.json({
    gameweek: {
      id: gw.id,
      number: gw.number,
      name: gw.name,
      deadlineAt: gw.deadlineAt
    },
    scores: scores.map((s) => ({
      userId: s.userId,
      email: s.user.email,
      points: s.points
    }))
  });
}
