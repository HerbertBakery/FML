// app/api/me/monsters/quick-sell/route.ts
//
// Quick-sell a monster directly from the user's collection.
// Body: { userMonsterId: string }
// Response: { ok, coinsAfter, message, error? }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  userMonsterId?: string;
};

const QUICK_SELL_VALUES: Record<string, number> = {
  COMMON: 25,
  RARE: 50,
  EPIC: 100,
  LEGENDARY: 250,
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { userMonsterId } = body;
  if (!userMonsterId) {
    return NextResponse.json(
      { ok: false, error: "userMonsterId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const monster = await tx.userMonster.findUnique({
        where: { id: userMonsterId },
      });

      if (!monster) {
        throw new Error("Monster not found.");
      }

      if (monster.userId !== user.id) {
        throw new Error("You do not own this monster.");
      }

      if (monster.isConsumed) {
        throw new Error("Monster is already consumed.");
      }

      const rarity = (monster.rarity || "").toUpperCase();
      const sellValue = QUICK_SELL_VALUES[rarity] ?? 25;

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          coins: {
            increment: sellValue,
          },
        },
      });

      // Mark monster as consumed instead of deleting it
      await tx.userMonster.update({
        where: { id: userMonsterId },
        data: {
          isConsumed: true,
        },
      });

      await tx.monsterHistoryEvent.create({
        data: {
          userMonsterId,
          actorUserId: user.id,
          action: "QUICK_SOLD",
          description: `Quick-sold for ${sellValue} coins.`,
        },
      });

      return {
        coinsAfter: updatedUser.coins,
        sellValue,
      };
    });

    return NextResponse.json({
      ok: true,
      coinsAfter: result.coinsAfter,
      message: `Monster quick-sold for ${result.sellValue} coins.`,
    });
  } catch (err: any) {
    console.error("Error quick selling monster:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to quick-sell monster." },
      { status: 400 }
    );
  }
}
