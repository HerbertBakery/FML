// app/api/users/[id]/gameweek-squad/route.ts
//
// Returns the locked squad for a specific gameweek for a given user,
// including per-monster gameweek points and a total.
//
// Query params (one of):
//   ?gameweekId=ID            (preferred)
//   ?gameweekNumber=NUMBER    (fallback)

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
  const url = new URL(req.url);
  const gwIdParam = url.searchParams.get("gameweekId");
  const gwNumberParam = url.searchParams.get("gameweekNumber");

  if (!gwIdParam && !gwNumberParam) {
    return NextResponse.json(
      { error: "Missing gameweekId or gameweekNumber query parameter." },
      { status: 400 }
    );
  }

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

    // --- Resolve gameweek by id or by number ---
    let gameweek = null as null | { id: string; number: number; name: string | null };

    if (gwIdParam) {
      const gw = await prisma.gameweek.findUnique({
        where: { id: gwIdParam },
      });
      if (!gw) {
        return NextResponse.json(
          { error: "Gameweek not found." },
          { status: 404 }
        );
      }
      gameweek = {
        id: gw.id,
        number: gw.number,
        name: gw.name,
      };
    } else if (gwNumberParam) {
      const gwNumber = Number(gwNumberParam);
      if (!Number.isInteger(gwNumber) || gwNumber <= 0) {
        return NextResponse.json(
          { error: "Invalid gameweekNumber." },
          { status: 400 }
        );
      }

      const gw = await prisma.gameweek.findFirst({
        where: { number: gwNumber },
      });

      if (!gw) {
        return NextResponse.json(
          { error: "Gameweek not found." },
          { status: 404 }
        );
      }

      gameweek = {
        id: gw.id,
        number: gw.number,
        name: gw.name,
      };
    }

    // --- Fetch score (totals) and entry (breakdown) separately ---
    const [score, entry] = await Promise.all([
      prisma.userGameweekScore.findUnique({
        where: {
          userId_gameweekId: {
            userId,
            gameweekId: gameweek!.id,
          },
        },
      }),
      prisma.gameweekEntry.findFirst({
        where: {
          userId,
          gameweekId: gameweek!.id,
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
      }),
    ]);

    // If there is NO entry, we *can* still return the total score,
    // but we can't return a monster breakdown.
    if (!entry) {
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        gameweek,
        totalPoints: score?.points ?? 0,
        monsters: [],
      });
    }

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
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
      },
      gameweek,
      totalPoints,
      monsters,
    });
  } catch (err) {
    console.error("Error loading user gameweek squad:", err);
    return NextResponse.json(
      { error: "Failed to load gameweek squad." },
      { status: 500 }
    );
  }
}
