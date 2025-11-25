// app/api/marketplace/buy/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

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

      // ✅ Deactivate the listing so it no longer shows up
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
