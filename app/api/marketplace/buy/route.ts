// app/api/marketplace/buy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { recordObjectiveProgress } from "@/lib/objectives/engine";

export const runtime = "nodejs";

type Body = {
  listingId?: string;
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

  const listingId = body.listingId;
  if (!listingId) {
    return NextResponse.json(
      { error: "listingId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: {
          seller: true,
          userMonster: true,
        },
      });

      if (!listing || !listing.isActive) {
        throw new Error("Listing not available.");
      }

      // ✅ Prevent buying your own listing
      if (listing.sellerId === user.id) {
        throw new Error("You cannot buy your own listing.");
      }

      const buyer = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!buyer) {
        throw new Error("Buyer not found.");
      }

      if (buyer.coins < listing.price) {
        throw new Error(
          "You do not have enough coins to buy this monster."
        );
      }

      // ✅ Deactivate the listing
      await tx.marketListing.update({
        where: { id: listing.id },
        data: {
          isActive: false,
        },
      });

      // ✅ Deduct coins from buyer
      await tx.user.update({
        where: { id: buyer.id },
        data: {
          coins: buyer.coins - listing.price,
        },
      });

      // ✅ Add coins to seller
      await tx.user.update({
        where: { id: listing.sellerId },
        data: {
          coins: listing.seller.coins + listing.price,
        },
      });

      // ✅ Transfer monster ownership
      await tx.userMonster.update({
        where: { id: listing.userMonsterId },
        data: {
          userId: buyer.id,
        },
      });

      // ✅ Log transaction
      await tx.marketTransaction.create({
        data: {
          listingId: listing.id,
          buyerId: buyer.id,
          sellerId: listing.sellerId,
          userMonsterId: listing.userMonsterId,
          price: listing.price,
        },
      });

      // 🔹 History: SOLD (seller perspective)
      await tx.monsterHistoryEvent.create({
        data: {
          userMonsterId: listing.userMonsterId,
          actorUserId: listing.sellerId,
          action: "SOLD",
          description: `Sold for ${listing.price} coins to ${
            buyer.email || "another manager"
          }.`,
        },
      });

      // 🔹 History: BOUGHT (buyer perspective)
      await tx.monsterHistoryEvent.create({
        data: {
          userMonsterId: listing.userMonsterId,
          actorUserId: buyer.id,
          action: "BOUGHT",
          description: `Bought for ${listing.price} coins from ${
            listing.seller.email || "another manager"
          }.`,
        },
      });

      // 🔥 OBJECTIVES: Marketplace path
      // - MARKET_01 & MARKET_03: buyer progress on USE_MARKETPLACE_BUY
      await recordObjectiveProgress({
        prisma: tx,
        userId: buyer.id,
        type: "USE_MARKETPLACE_BUY",
        amount: 1,
      });

      // - MARKET_02 & MARKET_03: seller gets SELL and total-transactions progress
      await recordObjectiveProgress({
        prisma: tx,
        userId: listing.sellerId,
        type: "USE_MARKETPLACE_SELL",
        amount: 1,
      });
      await recordObjectiveProgress({
        prisma: tx,
        userId: listing.sellerId,
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
      message: "Purchase successful.",
      ...result,
    });
  } catch (err: any) {
    console.error("Error buying listing:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to complete purchase.",
      },
      { status: 400 }
    );
  }
}
