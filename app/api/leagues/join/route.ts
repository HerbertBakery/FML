// app/api/leagues/join/route.ts
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

  let body: { code?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const code = (body.code || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json(
      { error: "League code is required." },
      { status: 400 }
    );
  }

  const league = await prisma.league.findUnique({
    where: { code }
  });

  if (!league) {
    return NextResponse.json(
      { error: "League not found for that code." },
      { status: 404 }
    );
  }

  // upsert membership
  await prisma.leagueMember.upsert({
    where: {
      leagueId_userId: {
        leagueId: league.id,
        userId: user.id
      }
    },
    update: {},
    create: {
      leagueId: league.id,
      userId: user.id
    }
  });

  return NextResponse.json({
    id: league.id,
    name: league.name,
    code: league.code
  });
}
