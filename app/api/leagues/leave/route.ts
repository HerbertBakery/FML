// app/api/leagues/leave/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: { leagueId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const leagueId = (body.leagueId || "").trim();
  if (!leagueId) {
    return NextResponse.json(
      { error: "League ID is required." },
      { status: 400 }
    );
  }

  const league = await prisma.league.findUnique({
    where: { id: leagueId }
  });

  if (!league) {
    return NextResponse.json(
      { error: "League not found." },
      { status: 404 }
    );
  }

  if (league.ownerId === user.id) {
    return NextResponse.json(
      {
        error:
          "League owners cannot leave their own league. (You can remove other members or stop using the league instead.)"
      },
      { status: 400 }
    );
  }

  const membership = await prisma.leagueMember.findUnique({
    where: {
      leagueId_userId: {
        leagueId,
        userId: user.id
      }
    }
  });

  if (!membership) {
    return NextResponse.json(
      { error: "You are not a member of this league." },
      { status: 400 }
    );
  }

  await prisma.leagueMember.delete({
    where: { id: membership.id }
  });

  return NextResponse.json({ success: true });
}
