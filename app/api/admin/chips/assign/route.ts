// app/api/admin/chips/assign/route.ts
//
// POST /api/admin/chips/assign
// Body: { userMonsterId: string, userChipId: string, gameweekNumber: number }
//
// Attaches a chip to a monster for a specific gameweek.
// During scoring, lib/scoring.ts will read MonsterChipAssignment,
// evaluate the condition, evolve if successful, then consume chip + delete assignment.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  userMonsterId?: string;
  userChipId?: string;
  gameweekNumber?: number;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const { userMonsterId, userChipId, gameweekNumber } = body;

    if (!userMonsterId || !userChipId || !gameweekNumber) {
      return NextResponse.json(
        {
          error:
            "userMonsterId, userChipId and gameweekNumber are all required.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(gameweekNumber) || gameweekNumber <= 0) {
      return NextResponse.json(
        { error: "Invalid gameweekNumber." },
        { status: 400 }
      );
    }

    // Load chip and validate ownership
    const userChip = await prisma.userChip.findUnique({
      where: { id: userChipId },
      include: {
        template: true,
      },
    });

    if (!userChip) {
      return NextResponse.json(
        { error: "UserChip not found." },
        { status: 404 }
      );
    }

    if (userChip.userId !== user.id) {
      return NextResponse.json(
        { error: "You do not own this chip." },
        { status: 403 }
      );
    }

    if (userChip.isConsumed) {
      return NextResponse.json(
        { error: "This chip has already been consumed." },
        { status: 400 }
      );
    }

    // Load monster and validate ownership
    const userMonster = await prisma.userMonster.findUnique({
      where: { id: userMonsterId },
    });

    if (!userMonster) {
      return NextResponse.json(
        { error: "UserMonster not found." },
        { status: 404 }
      );
    }

    if (userMonster.userId !== user.id) {
      return NextResponse.json(
        { error: "You do not own this monster." },
        { status: 403 }
      );
    }

    // Ensure gameweek exists
    let gw = await prisma.gameweek.findFirst({
      where: { number: gameweekNumber },
    });

    if (!gw) {
      // You may or may not want auto-create here; I’ll keep it consistent with scoring:
      gw = await prisma.gameweek.create({
        data: {
          number: gameweekNumber,
          name: `Gameweek ${gameweekNumber}`,
          deadlineAt: new Date(),
          isActive: false,
        },
      });
    }

    // Optional: prevent multiple chips on the same monster+GW
    const existing = await prisma.monsterChipAssignment.findFirst({
      where: {
        userMonsterId: userMonster.id,
        gameweekId: gw.id,
      },
    });

    if (existing) {
      // Either block or replace. Let's block for now:
      return NextResponse.json(
        {
          error:
            "This monster already has a chip assigned for that gameweek.",
        },
        { status: 400 }
      );
    }

    const assignment = await prisma.monsterChipAssignment.create({
      data: {
        userMonsterId: userMonster.id,
        userChipId: userChip.id,
        gameweekId: gw.id,
      },
      include: {
        userChip: {
          include: {
            template: true,
          },
        },
        userMonster: true,
        gameweek: true,
      },
    });

    return NextResponse.json({
      message: "Chip assigned to monster for this gameweek.",
      assignment,
    });
  } catch (err: any) {
    console.error("Error assigning chip:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to assign chip." },
      { status: 500 }
    );
  }
}
