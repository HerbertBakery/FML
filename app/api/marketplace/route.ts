// app/api/marketplace/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
// IMPORTANT: do NOT cache this route – always hit the DB.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const listings = await prisma.marketListing.findMany({
      where: { isActive: true }, // only active listings
      include: {
        seller: true,
        userMonster: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const result = listings.map((l) => ({
      id: l.id,
      price: l.price,
      sellerId: l.sellerId,
      sellerEmail: l.seller.email,
      userMonster: {
        id: l.userMonster.id,
        templateCode: l.userMonster.templateCode,
        displayName: l.userMonster.displayName,
        realPlayerName: l.userMonster.realPlayerName,
        position: l.userMonster.position,
        club: l.userMonster.club,
        rarity: l.userMonster.rarity,
        baseAttack: l.userMonster.baseAttack,
        baseMagic: l.userMonster.baseMagic,
        baseDefense: l.userMonster.baseDefense,
        evolutionLevel: l.userMonster.evolutionLevel,

        // NEW: pass through edition + art info to the frontend
        setCode: l.userMonster.setCode,
        editionType: l.userMonster.editionType,
        editionLabel: l.userMonster.editionLabel,
        serialNumber: l.userMonster.serialNumber,
        artBasePath: l.userMonster.artBasePath,
      },
    }));

    return NextResponse.json({ listings: result });
  } catch (err) {
    console.error("Error loading marketplace listings:", err);
    return NextResponse.json(
      { error: "Failed to load marketplace." },
      { status: 500 }
    );
  }
}
