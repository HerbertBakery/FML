// app/api/users/[id]/gameweeks/route.ts
//
// Returns all gameweek scores for a specific user,
// with gameweek metadata, sorted by gameweek number.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const viewer = await getUserFromRequest(req);
  if (!viewer) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const userId = context.params.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const scores = await prisma.userGameweekScore.findMany({
      where: { userId },
      include: {
        gameweek: true,
      },
      orderBy: {
        gameweek: {
          number: "asc",
        },
      },
    });

    const entries = scores.map((s) => ({
      gameweekId: s.gameweekId,
      number: s.gameweek.number,
      name: s.gameweek.name,
      points: s.points,
    }));

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      entries,
    });
  } catch (err) {
    console.error("Error loading user gameweeks:", err);
    return NextResponse.json(
      { error: "Failed to load gameweek history." },
      { status: 500 }
    );
  }
}
