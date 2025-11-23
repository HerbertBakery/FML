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

  // Latest gameweek that has *any* scores recorded (global)
  const latestGw = await prisma.gameweek.findFirst({
    where: {
      scores: {
        some: {}
      }
    },
    orderBy: {
      number: "desc"
    }
  });

  const memberIds = league.memberships.map((m) => m.userId);
  let scoreByUser = new Map<string, number>();

  if (latestGw && memberIds.length > 0) {
    const scores = await prisma.userGameweekScore.findMany({
      where: {
        gameweekId: latestGw.id,
        userId: { in: memberIds }
      }
    });

    for (const s of scores) {
      scoreByUser.set(s.userId, s.points);
    }
  }

  const result = league.memberships
    .map((m) => ({
      userId: m.userId,
      email: m.user.email,
      points: scoreByUser.get(m.userId) ?? 0
    }))
    .sort((a, b) => b.points - a.points);

  const ownerMembership = league.memberships.find(
    (m) => m.userId === league.ownerId
  );

  return NextResponse.json({
    league: {
      id: league.id,
      name: league.name,
      code: league.code,
      ownerEmail: ownerMembership?.user.email
    },
    gameweek: latestGw
      ? {
        id: latestGw.id,
        number: latestGw.number,
        name: latestGw.name ?? null,
        deadlineAt: latestGw.deadlineAt
      }
      : null,
    scores: result
  });
}
