// app/api/admin/chips/seed/route.ts
//
// POST /api/admin/chips/seed
// Seeds some default ChipTemplate rows (idempotent).
// You can call this once after resetting DB (e.g. via Thunderclient / Postman).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

const DEFAULT_CHIPS = [
  {
    code: "GOAL_SURGE",
    name: "Goal Surge",
    description:
      "Attach to an attacker. If they score at least 1 goal this gameweek, they evolve by 1.",
    conditionType: "GOAL_SURGE",
    minRarity: "COMMON",
    maxRarity: "LEGENDARY",
    allowedPositions: "MID,FWD",
  },
  {
    code: "PLAYMAKER",
    name: "Playmaker",
    description:
      "Attach to a creative player. If they get 2+ attacking returns (goals + assists), they evolve by 1.",
    conditionType: "PLAYMAKER",
    minRarity: "COMMON",
    maxRarity: "LEGENDARY",
    allowedPositions: "MID,FWD",
  },
  {
    code: "WALL",
    name: "Wall",
    description:
      "Attach to a defender or keeper. If they keep a clean sheet and play 60+ minutes, they evolve by 1.",
    conditionType: "WALL",
    minRarity: "COMMON",
    maxRarity: "LEGENDARY",
    allowedPositions: "GK,DEF",
  },
  {
    code: "HEROIC_HAUL",
    name: "Heroic Haul",
    description:
      "Attach to any player. If they hit a huge FPL haul (12+ points), they evolve by 1.",
    conditionType: "HEROIC_HAUL",
    minRarity: "RARE",
    maxRarity: "LEGENDARY",
    allowedPositions: null,
  },
  {
    code: "STEADY_FORM",
    name: "Steady Form",
    description:
      "Attach to any player. If they score 5+ FPL points, they evolve by 1.",
    conditionType: "STEADY_FORM",
    minRarity: "COMMON",
    maxRarity: "EPIC",
    allowedPositions: null,
  },
];

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // OPTIONAL: if you eventually add an isAdmin flag, check it here.

    const createdOrExisting = [];

    for (const def of DEFAULT_CHIPS) {
      const existing = await prisma.chipTemplate.findUnique({
        where: { code: def.code },
      });

      if (existing) {
        createdOrExisting.push(existing);
        continue;
      }

      const created = await prisma.chipTemplate.create({
        data: {
          code: def.code,
          name: def.name,
          description: def.description,
          conditionType: def.conditionType,
          minRarity: def.minRarity ?? undefined,
          maxRarity: def.maxRarity ?? undefined,
          allowedPositions: def.allowedPositions ?? undefined,
        },
      });

      createdOrExisting.push(created);
    }

    return NextResponse.json({
      message: "Chip templates seeded.",
      chips: createdOrExisting,
    });
  } catch (err: any) {
    console.error("Error seeding chip templates:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to seed chip templates." },
      { status: 500 }
    );
  }
}
