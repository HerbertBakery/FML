import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { recordObjectiveProgress } from "@/lib/objectives/engine";

export const runtime = "nodejs";

type Body = {
  userMonsterId?: string;
  price?: number;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { userMonsterId, price } = body;

  if (!userMonsterId) {
    return NextResponse.json(
      { error: "userMonsterId is required." },
      { status: 400 }
    );
  }

  if (price == null || Number.isNaN(price) || price <= 0) {
    return NextResponse.json(
      { error: "A positive price is required." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Load the monster and verify ownership
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
        throw new Error("This monster has been consumed and cannot be listed.");
      }

      // 2) Ensure there's no active listing for this monster
      const existingActiveListing = await tx.marketListing.findFirst({
        where: {
          userMonsterId: monster.id,
          isActive: true,
        },
      });

      if (existingActiveListing) {
        throw new Error("This monster is already listed for sale.");
      }

      // 3) Create new listing
      const listing = await tx.marketListing.create({
        data: {
          sellerId: user.id,
          userMonsterId: monster.id,
          price: Math.floor(price),
          isActive: true,
        },
      });

      // 4) Remove this monster from ALL of the user's saved squads
      // (so it disappears from "My Squads" once listed)
      await tx.squadMonster.deleteMany({
        where: {
          userMonsterId: monster.id,
          squad: {
            userId: user.id,
          },
        },
      });

      // 5) Log history event
      await tx.monsterHistoryEvent.create({
        data: {
          userMonsterId: monster.id,
          actorUserId: user.id,
          action: "LISTED",
          description: `Listed on marketplace for ${listing.price} coins.`,
        },
      });

      // 6) Objectives: selling counts for SELL + combined MARKET transactions
      await recordObjectiveProgress({
        prisma: tx,
        userId: user.id,
        type: "USE_MARKETPLACE_SELL",
        amount: 1,
      });

      // MARKET_03 uses USE_MARKETPLACE_BUY as "total market transactions" in your config
      await recordObjectiveProgress({
        prisma: tx,
        userId: user.id,
        type: "USE_MARKETPLACE_BUY",
        amount: 1,
      });

      return {
        listingId: listing.id,
        price: listing.price,
      };
    });

    return NextResponse.json({
      ok: true,
      message: "Monster listed on the marketplace.",
      ...result,
    });
  } catch (err: any) {
    console.error("Error listing monster:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to list monster.",
      },
      { status: 400 }
    );
  }
}
