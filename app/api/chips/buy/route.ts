// app/api/chips/buy/route.ts
//
// POST /api/chips/buy
// Body: { templateCode: string }
//
// Buys a chip from the shop for coins:
// - Validates user auth
// - Validates the chip template exists AND isInShop AND shopPrice set
// - Checks coins >= shopPrice
// - Deducts coins, creates UserChip with remainingTries = template.maxTries
// - Returns updated coin balance

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  templateCode?: string;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const templateCode = body.templateCode;
  if (!templateCode) {
    return NextResponse.json(
      { error: "Missing templateCode." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dbUser = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        throw new Error("User not found.");
      }

      const template = await tx.chipTemplate.findUnique({
        where: { code: templateCode },
      });

      if (!template || !template.isActive) {
        throw new Error("Chip template not available.");
      }

      if (!template.isInShop || template.shopPrice == null) {
        throw new Error("This chip is not sold in the shop.");
      }

      const price = template.shopPrice;
      if (dbUser.coins < price) {
        throw new Error("Not enough coins to buy this chip.");
      }

      const newCoinBalance = dbUser.coins - price;

      // Deduct coins
      await tx.user.update({
        where: { id: dbUser.id },
        data: {
          coins: newCoinBalance,
        },
      });

      // Create UserChip with remainingTries derived from template.maxTries
      const tries =
        typeof template.maxTries === "number" && template.maxTries > 0
          ? template.maxTries
          : 2;

      const userChip = await tx.userChip.create({
        data: {
          userId: dbUser.id,
          templateId: template.id,
          remainingTries: tries,
        },
      });

      return {
        coinsAfter: newCoinBalance,
        chip: userChip,
        chipTemplateName: template.name,
        price,
      };
    });

    return NextResponse.json({
      ok: true,
      message: `Purchased ${result.chipTemplateName} chip for ${result.price} coins.`,
      coinsAfter: result.coinsAfter,
      chipId: result.chip.id,
    });
  } catch (err: any) {
    console.error("Error buying chip:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to buy chip." },
      { status: 400 }
    );
  }
}
