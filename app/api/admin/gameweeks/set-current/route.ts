// app/api/admin/gameweeks/set-current/route.ts
// or src/app/... depending on your project

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);

    // Lock down if you have roles
    // if (!user || user.role !== "ADMIN")
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { number } = body;

    if (typeof number !== "number") {
      return NextResponse.json(
        { error: "Missing or invalid 'number' in body" },
        { status: 400 }
      );
    }

    // 1) Clear any existing current gameweek
    await prisma.gameweek.updateMany({
      data: { isActive: false },
    });

    // 2) Mark this one as current (uses updateMany, not update)
    const result = await prisma.gameweek.updateMany({
      where: { number },
      data: { isActive: true },
    });

    if (result.count === 0) {
      // No gameweek with that number
      return NextResponse.json(
        { error: `No gameweek found with number ${number}` },
        { status: 404 }
      );
    }

    // 3) Fetch the now-current gameweek to return it
    const gameweek = await prisma.gameweek.findFirst({
      where: { number, isActive: true },
    });

    return NextResponse.json({
      success: true,
      gameweek,
    });
  } catch (err) {
    console.error("Error in /api/admin/gameweeks/set-current:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
