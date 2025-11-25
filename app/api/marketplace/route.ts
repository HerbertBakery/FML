// app/api/marketplace/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const listings = await prisma.marketListing.findMany({
      where: { isActive: true }, // ✅ ONLY active listings
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
      },
    }));

    return NextResponse.json({
      listings: result,
      apiVersion: "marketplace-2025-11-23-a", // small debug marker
    });
  } catch (err) {
    console.error("Error loading marketplace listings:", err);
    return NextResponse.json(
      { error: "Failed to load marketplace listings." },
      { status: 500 }
    );
  }
}
