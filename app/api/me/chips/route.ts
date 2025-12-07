// app/api/me/chips/route.ts
//
// GET /api/me/chips
// Returns all chips owned by the current user, with template info,
// remaining tries, and any gameweek assignments.
//
// This is used by the "My Chips" UI so players can see what they have.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const chips = await prisma.userChip.findMany({
      where: { userId: user.id },
      include: {
        template: true,
        assignments: {
          include: {
            gameweek: true,
            userMonster: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const dto = chips.map((chip) => ({
      id: chip.id,
      isConsumed: chip.isConsumed,
      // 🔥 expose how many lives this instance has left
      remainingTries: chip.remainingTries,
      // 🔥 expose max tries from the template for UI display
      maxTries: chip.template.maxTries,
      createdAt: chip.createdAt,
      consumedAt: chip.consumedAt,
      template: {
        id: chip.template.id,
        code: chip.template.code,
        name: chip.template.name,
        description: chip.template.description,
        conditionType: chip.template.conditionType,
        minRarity: chip.template.minRarity,
        maxRarity: chip.template.maxRarity,
        allowedPositions: chip.template.allowedPositions,
        // also expose here in case UI prefers template-based access
        maxTries: chip.template.maxTries,
      },
      assignments: chip.assignments.map((asgn) => ({
        id: asgn.id,
        gameweekId: asgn.gameweekId,
        gameweekNumber: asgn.gameweek.number,
        userMonsterId: asgn.userMonsterId,
        monsterName: asgn.userMonster.displayName,
        monsterRealPlayerName: asgn.userMonster.realPlayerName,
        createdAt: asgn.createdAt,
        resolvedAt: asgn.resolvedAt,
        wasSuccessful: asgn.wasSuccessful,
      })),
    }));

    return NextResponse.json({ chips: dto });
  } catch (err: any) {
    console.error("Error loading user chips:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to load chips." },
      { status: 500 }
    );
  }
}
