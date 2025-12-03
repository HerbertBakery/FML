    // app/api/me/monsters-lite/route.ts
//
// GET /api/me/monsters-lite
// Returns a simple list of the current user's monsters (not consumed),
// with just enough info for a picker.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const monsters = await prisma.userMonster.findMany({
      where: {
        userId: user.id,
        isConsumed: false,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        displayName: true,
        realPlayerName: true,
        club: true,
        position: true,
        rarity: true,
        evolutionLevel: true,
        artBasePath: true,
      },
    });

    return NextResponse.json({ monsters });
  } catch (err: any) {
    console.error("Error loading user monsters:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to load monsters." },
      { status: 500 }
    );
  }
}
