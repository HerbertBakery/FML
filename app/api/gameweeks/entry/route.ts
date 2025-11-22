// app/api/gameweeks/entry/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getOrCreateCurrentGameweek } from "@/lib/gameweeks";

export const runtime = "nodejs";

type SaveBody = {
  userMonsterIds?: string[];
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

// POST: lock the 6-monster squad as the entry for the current gameweek
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const gameweek = await getOrCreateCurrentGameweek();

  // Check deadline
  const now = new Date();
  if (now > gameweek.deadlineAt) {
    return NextResponse.json(
      { error: "Deadline has passed for the current gameweek." },
      { status: 400 }
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
  const maxPlayers = 6;

  if (uniqueIds.length !== maxPlayers) {
    return NextResponse.json(
      { error: "You must select exactly 6 monsters." },
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

  if (counts.GK !== 1 || counts.DEF < 1 || counts.MID < 1 || counts.FWD < 1) {
    return NextResponse.json(
      {
        error:
          "Your gameweek squad must contain exactly 1 GK and at least 1 DEF, 1 MID, and 1 FWD."
      },
      { status: 400 }
    );
  }

  // Save entry + attach 6 monsters.
  // We'll treat the last 2 as "subs" for now (slot >= 4 => isSub = true)
  const entry = await prisma.$transaction(async (tx) => {
    // Find existing entry for this user+gameweek
    const existingEntry = await tx.gameweekEntry.findFirst({
      where: {
        userId: user.id,
        gameweekId: gameweek.id
      },
      select: { id: true }
    });

    let entryId: string;

    if (existingEntry) {
      entryId = existingEntry.id;
      await tx.gameweekEntryMonster.deleteMany({
        where: { entryId }
      });
    } else {
      const created = await tx.gameweekEntry.create({
        data: {
          userId: user.id,
          gameweekId: gameweek.id
        }
      });
      entryId = created.id;
    }

    await tx.gameweekEntryMonster.createMany({
      data: uniqueIds.map((monsterId, index) => ({
        entryId,
        userMonsterId: monsterId,
        slot: index,
        isSub: index >= 4 // first 4 = starters, last 2 = subs
      }))
    });

    // Ensure a score record exists (0 points initially)
    const existingScore = await tx.userGameweekScore.findFirst({
      where: {
        userId: user.id,
        gameweekId: gameweek.id
      }
    });

    if (!existingScore) {
      await tx.userGameweekScore.create({
        data: {
          userId: user.id,
          gameweekId: gameweek.id,
          points: 0
        }
      });
    }

    return tx.gameweekEntry.findUnique({
      where: { id: entryId },
      include: {
        monsters: {
          include: { userMonster: true },
          orderBy: { slot: "asc" }
        }
      }
    });
  });

  if (!entry) {
    return NextResponse.json(
      { error: "Failed to save gameweek entry." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    entry: {
      id: entry.id,
      gameweekId: entry.gameweekId,
      monsters: entry.monsters.map((m) => ({
        id: m.userMonster.id,
        displayName: m.userMonster.displayName,
        realPlayerName: m.userMonster.realPlayerName,
        position: m.userMonster.position,
        club: m.userMonster.club,
        rarity: m.userMonster.rarity,
        baseAttack: m.userMonster.baseAttack,
        baseMagic: m.userMonster.baseMagic,
        baseDefense: m.userMonster.baseDefense,
        isSub: m.isSub
      }))
    }
  });
}
