// app/api/leagues/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

function generateLeagueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// GET: list leagues current user belongs to
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: user.id },
    include: {
      league: {
        include: {
          owner: true,
          memberships: true,
          _count: {
            select: { memberships: true }
          }
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  if (memberships.length === 0) {
    return NextResponse.json({ leagues: [] });
  }

  // Find latest gameweek that has any scores at all (same logic as other leaderboards)
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

  let scoreByUser = new Map<string, number>();

  if (latestGw) {
    // All userIds that appear in any of the leagues this user is in
    const allUserIds = Array.from(
      new Set(
        memberships.flatMap((m) =>
          m.league.memberships.map((lm) => lm.userId)
        )
      )
    );

    if (allUserIds.length > 0) {
      const scores = await prisma.userGameweekScore.findMany({
        where: {
          gameweekId: latestGw.id,
          userId: { in: allUserIds }
        }
      });

      for (const s of scores) {
        scoreByUser.set(s.userId, s.points);
      }
    }
  }

  const leagues = memberships.map((m) => {
    const league = m.league;
    const memberIds = league.memberships.map((lm) => lm.userId);

    let myRank: number | null = null;

    if (latestGw && memberIds.length > 0) {
      const ranking = memberIds
        .map((userId) => ({
          userId,
          points: scoreByUser.get(userId) ?? 0
        }))
        .sort((a, b) => b.points - a.points);

      const idx = ranking.findIndex(
        (row) => row.userId === user.id
      );
      if (idx !== -1) {
        myRank = idx + 1;
      }
    }

    const memberCount =
      league._count?.memberships ?? league.memberships.length;

    return {
      id: league.id,
      name: league.name,
      code: league.code,
      ownerEmail: league.owner.email,
      isOwner: league.ownerId === user.id,
      memberCount,
      myRank
    };
  });

  return NextResponse.json({ leagues });
}

// POST: create a league
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // ignore, name might be missing
  }

  const name = (body.name || "").trim();
  if (!name) {
    return NextResponse.json(
      { error: "League name is required." },
      { status: 400 }
    );
  }

  // generate unique code
  let code: string;
  let attempts = 0;
  while (true) {
    attempts++;
    if (attempts > 10) {
      return NextResponse.json(
        {
          error:
            "Failed to generate unique league code. Please try again."
        },
        { status: 500 }
      );
    }
    const candidate = generateLeagueCode();
    const existing = await prisma.league.findUnique({
      where: { code: candidate }
    });
    if (!existing) {
      code = candidate;
      break;
    }
  }

  const league = await prisma.league.create({
    data: {
      name,
      code,
      ownerId: user.id,
      memberships: {
        create: {
          userId: user.id
        }
      }
    },
    include: {
      memberships: true
    }
  });

  return NextResponse.json(
    {
      id: league.id,
      name: league.name,
      code: league.code
    },
    { status: 201 }
  );
}
