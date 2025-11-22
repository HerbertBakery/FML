// app/api/leagues/[id]/leaderboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const leagueId = context.params.id;

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: {
      memberships: {
        include: {
          user: true
        }
      }
    }
  });

  if (!league) {
    return NextResponse.json(
      { error: "League not found." },
      { status: 404 }
    );
  }

  // Ensure current user is in the league
  const isMember = league.memberships.some(
    (m) => m.userId === user.id
  );
  if (!isMember) {
    return NextResponse.json(
      { error: "You are not a member of this league." },
      { status: 403 }
    );
  }

  // Find the latest gameweek that has scores (or active)
  const latestGw = await prisma.gameweek.findFirst({
    where: {
      scores: {
        some: {}
      }
    },
    orderBy: { number: "desc" }
  });

  if (!latestGw) {
    return NextResponse.json(
      {
        league: {
          id: league.id,
          name: league.name,
          code: league.code
        },
        gameweek: null,
        scores: []
      },
      { status: 200 }
    );
  }

  const userIds = league.memberships.map((m) => m.userId);

  const scores = await prisma.userGameweekScore.findMany({
    where: {
      gameweekId: latestGw.id,
      userId: { in: userIds }
    },
    include: {
      user: true
    },
    orderBy: {
      points: "desc"
    }
  });

  const result = scores.map((s) => ({
    userId: s.userId,
    email: s.user.email,
    points: s.points
  }));

  return NextResponse.json({
    league: {
      id: league.id,
      name: league.name,
      code: league.code,
      ownerEmail: league.memberships.find(
        (m) => m.userId === league.ownerId
      )?.user.email
    },
    gameweek: {
      id: latestGw.id,
      number: latestGw.number,
      name: latestGw.name,
      deadlineAt: latestGw.deadlineAt
    },
    scores: result
  });
}
