// app/api/squad/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type UserMonsterDTO = {
  id: string;
  templateCode: string;
  displayName: string;
  realPlayerName: string;
  position: string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
};

type SquadResponse = {
  squad: {
    id: string;
    monsters: UserMonsterDTO[];
  } | null;
};

function positionsSummary(monsters: { position: string }[]) {
  const counts: Record<string, number> = {
    GK: 0,
    DEF: 0,
    MID: 0,
    FWD: 0
  };
  for (const m of monsters) {
    if (counts[m.position] !== undefined) {
      counts[m.position]++;
    }
  }
  return counts;
}

// GET: fetch current squad
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const squad = await prisma.squad.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      slots: {
        include: {
          userMonster: true
        },
        orderBy: { slot: "asc" }
      }
    }
  });

  if (!squad) {
    const empty: SquadResponse = { squad: null };
    return NextResponse.json(empty);
  }

  const monsters: UserMonsterDTO[] = squad.slots.map((slot) => ({
    id: slot.userMonster.id,
    templateCode: slot.userMonster.templateCode,
    displayName: slot.userMonster.displayName,
    realPlayerName: slot.userMonster.realPlayerName,
    position: slot.userMonster.position,
    club: slot.userMonster.club,
    rarity: slot.userMonster.rarity,
    baseAttack: slot.userMonster.baseAttack,
    baseMagic: slot.userMonster.baseMagic,
    baseDefense: slot.userMonster.baseDefense
  }));

  const response: SquadResponse = {
    squad: {
      id: squad.id,
      monsters
    }
  };

  return NextResponse.json(response);
}

// POST: save squad (5-a-side, at least 1 in each position)
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: { userMonsterIds?: string[] } = {};
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

  if (uniqueIds.length !== 5) {
    return NextResponse.json(
      { error: "You must select exactly 5 monsters." },
      { status: 400 }
    );
  }

  const monsters = await prisma.userMonster.findMany({
    where: {
      id: { in: uniqueIds },
      userId: user.id
    }
  });

  if (monsters.length !== uniqueIds.length) {
    return NextResponse.json(
      { error: "Invalid monsters selected." },
      { status: 400 }
    );
  }

  const counts = positionsSummary(monsters);

  if (
    counts.GK < 1 ||
    counts.DEF < 1 ||
    counts.MID < 1 ||
    counts.FWD < 1
  ) {
    return NextResponse.json(
      {
        error:
          "Your 5-a-side squad must contain at least 1 GK, 1 DEF, 1 MID, and 1 FWD."
      },
      { status: 400 }
    );
  }

  // Overwrite any existing squads for this user
  const existing = await prisma.squad.findMany({
    where: { userId: user.id },
    select: { id: true }
  });

  const existingIds = existing.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    if (existingIds.length > 0) {
      await tx.squadMonster.deleteMany({
        where: { squadId: { in: existingIds } }
      });
      await tx.squad.deleteMany({
        where: { id: { in: existingIds } }
      });
    }

    const squad = await tx.squad.create({
      data: {
        userId: user.id
      }
    });

    await tx.squadMonster.createMany({
      data: uniqueIds.map((monsterId, index) => ({
        squadId: squad.id,
        userMonsterId: monsterId,
        slot: index
      }))
    });
  });

  // Reload squad with monsters for response
  const savedSquad = await prisma.squad.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      slots: {
        include: {
          userMonster: true
        },
        orderBy: { slot: "asc" }
      }
    }
  });

  if (!savedSquad) {
    return NextResponse.json(
      { error: "Failed to save squad." },
      { status: 500 }
    );
  }

  const monstersDTO: UserMonsterDTO[] = savedSquad.slots.map(
    (slot) => ({
      id: slot.userMonster.id,
      templateCode: slot.userMonster.templateCode,
      displayName: slot.userMonster.displayName,
      realPlayerName: slot.userMonster.realPlayerName,
      position: slot.userMonster.position,
      club: slot.userMonster.club,
      rarity: slot.userMonster.rarity,
      baseAttack: slot.userMonster.baseAttack,
      baseMagic: slot.userMonster.baseMagic,
      baseDefense: slot.userMonster.baseDefense
    })
  );

  const response: SquadResponse = {
    squad: {
      id: savedSquad.id,
      monsters: monstersDTO
    }
  };

  return NextResponse.json(response);
}
