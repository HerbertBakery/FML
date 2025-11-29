// app/api/me/gameweek-squad/route.ts
//
// Returns the locked squad for a specific gameweek for the logged-in user,
// including per-monster gameweek points and a total.
//
// Query param:
//   ?gameweekNumber=NUMBER   (required from the squad page)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const gwNumberParam = url.searchParams.get("gameweekNumber");

  if (!gwNumberParam) {
    return NextResponse.json(
      { error: "Missing gameweekNumber query parameter." },
      { status: 400 }
    );
  }

  const gwNumber = Number(gwNumberParam);
  if (!Number.isInteger(gwNumber) || gwNumber <= 0) {
    return NextResponse.json(
      { error: "Invalid gameweekNumber." },
      { status: 400 }
    );
  }

  try {
    const gameweek = await prisma.gameweek.findFirst({
      where: { number: gwNumber },
    });

    if (!gameweek) {
      return NextResponse.json(
        { error: "Gameweek not found." },
        { status: 404 }
      );
    }

    const entry = await prisma.gameweekEntry.findFirst({
      where: {
        userId: user.id,
        gameweekId: gameweek.id,
      },
      include: {
        monsters: {
          include: {
            userMonster: true,
          },
          orderBy: {
            slot: "asc",
          },
        },
      },
    });

    if (!entry) {
      // User simply had no entry this gameweek
      return NextResponse.json({
        gameweek: {
          id: gameweek.id,
          number: gameweek.number,
          name: gameweek.name,
        },
        totalPoints: 0,
        monsters: [],
      });
    }

    const score = await prisma.userGameweekScore.findUnique({
      where: {
        userId_gameweekId: {
          userId: user.id,
          gameweekId: gameweek.id,
        },
      },
    });

    const totalPoints =
      score?.points ??
      entry.monsters.reduce((sum, m) => sum + (m.points ?? 0), 0);

    const monsters = entry.monsters.map((m) => {
      const um = m.userMonster;
      return {
        id: um.id,
        templateCode: um.templateCode,
        displayName: um.displayName,
        realPlayerName: um.realPlayerName,
        position: um.position,
        club: um.club,
        rarity: um.rarity,
        baseAttack: um.baseAttack,
        baseMagic: um.baseMagic,
        baseDefense: um.baseDefense,
        evolutionLevel: um.evolutionLevel,
        artBasePath: um.artBasePath ?? null,
        setCode: um.setCode ?? null,
        editionType: um.editionType ?? null,
        editionLabel: um.editionLabel ?? null,
        serialNumber: um.serialNumber ?? null,
        isSub: m.isSub,
        gameweekPoints: m.points ?? 0,
      };
    });

    return NextResponse.json({
      gameweek: {
        id: gameweek.id,
        number: gameweek.number,
        name: gameweek.name,
      },
      totalPoints,
      monsters,
    });
  } catch (err) {
    console.error("Error loading gameweek squad:", err);
    return NextResponse.json(
      { error: "Failed to load gameweek squad." },
      { status: 500 }
    );
  }
}
