// app/api/squad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type SaveBody = {
  userMonsterIds?: string[];
};

function positionsSummary(monsters: { position: string }[]) {
  const counts: Record<string, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  };
  for (const m of monsters) {
    if (counts[m.position] !== undefined) {
      counts[m.position]++;
    }
  }
  return counts;
}

// GET: return latest saved squad for the user
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Find all monsters THIS user has actively listed
  const activeListings = await prisma.marketListing.findMany({
    where: {
      sellerId: user.id,
      isActive: true,
    },
    select: {
      userMonsterId: true,
    },
  });
  const listedIds = activeListings.map((l) => l.userMonsterId);

  const squad = await prisma.squad.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      slots: {
        include: { userMonster: true },
        orderBy: { slot: "asc" },
      },
    },
  });

  if (!squad) {
    return NextResponse.json({ squad: null });
  }

  // Filter out any squad slots whose monster is currently listed
  const filteredSlots =
    listedIds.length === 0
      ? squad.slots
      : squad.slots.filter(
          (slot) => !listedIds.includes(slot.userMonsterId)
        );

  const monsters = filteredSlots.map((slot) => ({
    id: slot.userMonster.id,
    templateCode: slot.userMonster.templateCode,
    displayName: slot.userMonster.displayName,
    realPlayerName: slot.userMonster.realPlayerName,
    position: slot.userMonster.position,
    club: slot.userMonster.club,
    rarity: slot.userMonster.rarity,
    baseAttack: slot.userMonster.baseAttack,
    baseMagic: slot.userMonster.baseMagic,
    baseDefense: slot.userMonster.baseDefense,
    evolutionLevel: slot.userMonster.evolutionLevel,

    // edition + art to mirror collection / marketplace
    setCode: slot.userMonster.setCode ?? null,
    editionType: slot.userMonster.editionType ?? null,
    serialNumber: slot.userMonster.serialNumber ?? null,
    editionLabel: slot.userMonster.editionLabel ?? null,
    artBasePath: slot.userMonster.artBasePath ?? null,
  }));

  return NextResponse.json({
    squad: {
      id: squad.id,
      monsters,
    },
  });
}

// POST: save 7-monster “default” squad
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: SaveBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const ids = body.userMonsterIds || [];
  const uniqueIds = Array.from(new Set(ids));

  const maxPlayers = 7;

  if (uniqueIds.length !== maxPlayers) {
    return NextResponse.json(
      { error: "You must select exactly 7 monsters." },
      { status: 400 }
    );
  }

  // Safety: ensure none of the selected monsters are currently listed
  const activeListingsForSelection = await prisma.marketListing.findMany({
    where: {
      isActive: true,
      userMonsterId: {
        in: uniqueIds,
      },
    },
    select: { userMonsterId: true },
  });

  if (activeListingsForSelection.length > 0) {
    return NextResponse.json(
      {
        error:
          "One or more selected monsters are currently listed on the marketplace and cannot be used in a squad.",
      },
      { status: 400 }
    );
  }

  const monsters = await prisma.userMonster.findMany({
    where: {
      id: { in: uniqueIds },
      userId: user.id,
    },
  });

  if (monsters.length !== uniqueIds.length) {
    return NextResponse.json(
      { error: "Invalid monsters selected." },
      { status: 400 }
    );
  }

  const counts = positionsSummary(monsters);

  // Rules:
  // - Exactly 1 GK
  // - At least 1 DEF, 1 MID, 1 FWD
  if (
    counts.GK !== 1 ||
    counts.DEF < 1 ||
    counts.MID < 1 ||
    counts.FWD < 1
  ) {
    return NextResponse.json(
      {
        error:
          "Your squad must contain exactly 1 GK and at least 1 DEF, 1 MID, and 1 FWD.",
      },
      { status: 400 }
    );
  }

  // Overwrite any existing squads
  const existing = await prisma.squad.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  const existingIds = existing.map((s) => s.id);

  const squad = await prisma.$transaction(async (tx) => {
    if (existingIds.length > 0) {
      await tx.squadMonster.deleteMany({
        where: { squadId: { in: existingIds } },
      });
      await tx.squad.deleteMany({
        where: { id: { in: existingIds } },
      });
    }

    const newSquad = await tx.squad.create({
      data: {
        userId: user.id,
      },
    });

    await tx.squadMonster.createMany({
      data: uniqueIds.map((monsterId, index) => ({
        squadId: newSquad.id,
        userMonsterId: monsterId,
        slot: index,
      })),
    });

    return newSquad;
  });

  return NextResponse.json({
    squad: {
      id: squad.id,
    },
  });
}
