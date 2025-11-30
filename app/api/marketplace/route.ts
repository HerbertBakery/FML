// app/api/marketplace/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
// IMPORTANT: do NOT cache this route – always hit the DB.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const now = new Date();

    const listings = await prisma.marketListing.findMany({
      where: {
        isActive: true,
        OR: [
          // no expiry set
          { expiresAt: null },
          // or expiry is still in the future
          { expiresAt: { gt: now } },
        ],
      },
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
      expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
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
