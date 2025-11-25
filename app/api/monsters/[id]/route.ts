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
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const { id } = params;

  try {
    const monster = await prisma.userMonster.findUnique({
      where: { id },
      include: {
        user: true,
        marketListing: {
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
        { error: "Monster not found." },
        { status: 404 }
      );
    }

    const history = monster.historyEvents.map((h) => ({
      id: h.id,
      action: h.action,
      description: h.description,
      createdAt: h.createdAt,
      actor: {
        id: h.actor.id,
        email: h.actor.email,
        username: h.actor.username,
      },
    }));

    const result = {
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
      totalGoals: monster.totalGoals,
      totalAssists: monster.totalAssists,
      totalCleanSheets: monster.totalCleanSheets,
      totalFantasyPoints: monster.totalFantasyPoints,
      isConsumed: monster.isConsumed,
      createdAt: monster.createdAt,
      owner: {
        id: monster.user.id,
        email: monster.user.email,
        username: monster.user.username,
      },
      marketplace: monster.marketListing
        ? {
            isListed: true,
            listingId: monster.marketListing.id,
            price: monster.marketListing.price,
          }
        : {
            isListed: false,
          },
      history,
    };

    return NextResponse.json({ monster: result });
  } catch (err) {
    console.error("Error fetching monster detail:", err);
    return NextResponse.json(
      { error: "Failed to load monster detail." },
      { status: 500 }
    );
  }
}
