// app/api/monsters/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/monsters/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const monsterId = params.id;

    const monster = await prisma.userMonster.findUnique({
      where: { id: monsterId },
      include: {
        user: true, // current owner
        // IMPORTANT: use plural relation name, and filter active listings
        marketListings: {
          where: { isActive: true },
        },
        historyEvents: {
          include: {
            actor: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!monster) {
      return NextResponse.json(
        { error: "Monster not found" },
        { status: 404 }
      );
    }

    // Pick the (single) active listing if it exists
    const activeListing =
      monster.marketListings && monster.marketListings.length > 0
        ? monster.marketListings[0]
        : null;

    const dto = {
      id: monster.id,
      templateCode: monster.templateCode,
      displayName: monster.displayName,
      realPlayerName: monster.realPlayerName,
      position: monster.position,
      club: monster.club,
      rarity: monster.rarity,
      baseAttack: monster.baseAttack,
      baseMagic: monster.baseMagic,
      baseDefense: monster.baseDefense,
      evolutionLevel: monster.evolutionLevel,

      setCode: monster.setCode ?? null,
      editionType: monster.editionType ?? null,
      serialNumber: monster.serialNumber ?? null,
      editionLabel: monster.editionLabel ?? null,
      artBasePath: monster.artBasePath ?? null,
      artHoverPath: monster.artHoverPath ?? null,
      traitsJson: monster.traitsJson ?? null,

      createdAt: monster.createdAt,
      totalGoals: monster.totalGoals,
      totalAssists: monster.totalAssists,
      totalCleanSheets: monster.totalCleanSheets,
      totalFantasyPoints: monster.totalFantasyPoints,
      isConsumed: monster.isConsumed,

      owner: {
        id: monster.user.id,
        email: monster.user.email,
        username: monster.user.username,
      },

      marketplace: {
        isListed: !!activeListing,
        listingId: activeListing?.id ?? null,
        price: activeListing?.price ?? null,
      },

      history: monster.historyEvents.map((ev) => ({
        id: ev.id,
        action: ev.action,
        description: ev.description,
        createdAt: ev.createdAt,
        actor: {
          id: ev.actor.id,
          email: ev.actor.email,
          username: ev.actor.username,
        },
      })),
    };

    return NextResponse.json({ monster: dto });
  } catch (err) {
    console.error("Error fetching monster detail:", err);
    return NextResponse.json(
      { error: "Failed to load monster detail" },
      { status: 500 }
    );
  }
}
