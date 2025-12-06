// app/api/chips/shop/route.ts
//
// GET /api/chips/shop
// Returns a list of chip templates that are active and marked for sale in the shop,
// shaped exactly for the PacksPage "Evolution Chips" section.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    const templates = await prisma.chipTemplate.findMany({
      where: {
        isActive: true,
        isInShop: true,
        // Only show chips that actually have a positive price
        shopPrice: {
          gt: 0,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const items = templates.map((t) => ({
      // 👇 These keys match ChipShopItem in app/packs/page.tsx
      templateCode: t.code,
      name: t.name,
      description: t.description,
      price: t.shopPrice ?? 0,
      maxTries: t.maxTries ?? 2,
      conditionType: t.conditionType,
    }));

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error("Error loading chip shop items:", err);
    return NextResponse.json(
      {
        error:
          err?.message || "Failed to load evolution chips for the shop.",
        items: [] as any[],
      },
      { status: 500 }
    );
  }
}
