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
        include: { owner: true }
      }
    },
    orderBy: { createdAt: "asc" }
  });

  const leagues = memberships.map((m) => ({
    id: m.league.id,
    name: m.league.name,
    code: m.league.code,
    ownerEmail: m.league.owner.email
  }));

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
