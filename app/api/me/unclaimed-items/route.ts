// app/api/me/unclaimed-items/route.ts
//
// GET:
//   - Cleans up old resolved listings (to avoid unique constraint clashes).
//   - Marks any of the current user's active listings whose expiresAt has passed
//     as EXPIRED_PENDING.
//   - Returns all EXPIRED_PENDING listings + their monsters.
//
// POST:
//   - Body: { listingId, action: "RETURN" | "QUICK_SELL" | "RELIST" }
//   - RETURN: mark as EXPIRED_RETURNED.
//   - QUICK_SELL: pay half the average market sale price for that template,
//                 consume the monster.
//   - RELIST: create a new active listing with the same price and a fresh expiry.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// TTL for relisted items (in days)
const RELIST_TTL_DAYS = 3;

type ResolveBody = {
  listingId?: string;
  action?: "RETURN" | "QUICK_SELL" | "RELIST";
};

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const listings = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // 0) CLEANUP:
      // Delete any of this user's *resolved* inactive listings so we don't
      // collide with the unique constraint on (userMonsterId, isActive)
      // when we expire a new active listing for the same monster.
      await tx.marketListing.deleteMany({
        where: {
          sellerId: user.id,
          isActive: false,
          resolutionStatus: {
            in: [
              "EXPIRED_RETURNED",
              "EXPIRED_QUICK_SOLD",
              "EXPIRED_RELISTED",
            ],
          },
        },
      });

      // 1) Any active listings whose expiresAt has passed become EXPIRED_PENDING
      await tx.marketListing.updateMany({
        where: {
          sellerId: user.id,
          isActive: true,
          expiresAt: {
            not: null,
            lte: now,
          },
        },
        data: {
          isActive: false,
          resolutionStatus: "EXPIRED_PENDING",
        },
      });

      // 2) Return all EXPIRED_PENDING listings for this user
      const pending = await tx.marketListing.findMany({
        where: {
          sellerId: user.id,
          isActive: false,
          resolutionStatus: "EXPIRED_PENDING",
        },
        include: {
          userMonster: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return pending;
    });

    // Defensive: filter out any orphan listings with no attached monster
    const validListings = listings.filter((l) => {
      if (!l.userMonster) {
        console.warn(
          "[unclaimed-items] Skipping listing with no userMonster relation:",
          l.id
        );
        return false;
      }
      return true;
    });

    const items = validListings.map((l) => ({
      listingId: l.id,
      createdAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
      userMonster: {
        id: l.userMonster!.id,
        templateCode: l.userMonster!.templateCode,
        displayName: l.userMonster!.displayName,
        realPlayerName: l.userMonster!.realPlayerName,
        position: l.userMonster!.position,
        club: l.userMonster!.club,
        rarity: l.userMonster!.rarity,
        baseAttack: l.userMonster!.baseAttack,
        baseMagic: l.userMonster!.baseMagic,
        baseDefense: l.userMonster!.baseDefense,
        evolutionLevel: l.userMonster!.evolutionLevel,
        artBasePath: l.userMonster!.artBasePath,
      },
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error("Error loading unclaimed items:", err);
    return NextResponse.json(
      { error: "Failed to load items that didn't sell." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: ResolveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { listingId, action } = body;

  if (!listingId || !action) {
    return NextResponse.json(
      { error: "listingId and action are required." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const listing = await tx.marketListing.findUnique({
        where: { id: listingId },
        include: {
          userMonster: true,
        },
      });

      if (!listing) {
        throw new Error("Listing not found.");
      }

      if (listing.sellerId !== user.id) {
        throw new Error("You do not own this listing.");
      }

      if (listing.isActive) {
        throw new Error("Listing is still active.");
      }

      if (
        listing.resolutionStatus &&
        listing.resolutionStatus !== "EXPIRED_PENDING"
      ) {
        throw new Error("This listing has already been handled.");
      }

      const now = new Date();

      if (action === "RETURN") {
        await tx.marketListing.update({
          where: { id: listing.id },
          data: {
            resolutionStatus: "EXPIRED_RETURNED",
            resolvedAt: now,
          },
        });

        await tx.monsterHistoryEvent.create({
          data: {
            userMonsterId: listing.userMonsterId,
            actorUserId: user.id,
            action: "LISTING_EXPIRED_RETURNED",
            description:
              "Marketplace listing expired and the monster was returned to the manager's collection.",
          },
        });

        return {
          coinsAfter: undefined,
          message: "Monster returned to your collection.",
        };
      }

      if (action === "QUICK_SELL") {
        // Use half of the average sale price for this templateCode
        const templateCode = listing.userMonster!.templateCode;

        const agg = await tx.marketTransaction.aggregate({
          where: {
            userMonster: {
              templateCode,
            },
          },
          _avg: {
            price: true,
          },
        });

        const avgPrice = agg._avg.price ?? 0;

        if (!avgPrice || avgPrice <= 0) {
          throw new Error(
            "Quick-sell is unavailable for this card because it has no previous market sales."
          );
        }

        const quickSellPrice = Math.floor(avgPrice / 2);

        const updatedUser = await tx.user.update({
          where: { id: user.id },
          data: {
            coins: {
              increment: quickSellPrice,
            },
          },
        });

        await tx.userMonster.update({
          where: { id: listing.userMonsterId },
          data: {
            isConsumed: true,
          },
        });

        await tx.marketListing.update({
          where: { id: listing.id },
          data: {
            resolutionStatus: "EXPIRED_QUICK_SOLD",
            resolvedAt: now,
          },
        });

        await tx.monsterHistoryEvent.create({
          data: {
            userMonsterId: listing.userMonsterId,
            actorUserId: user.id,
            action: "QUICK_SOLD_EXPIRED",
            description: `Quick-sold for ${quickSellPrice} coins after listing expired.`,
          },
        });

        return {
          coinsAfter: updatedUser.coins,
          message: `Monster quick-sold for ${quickSellPrice} coins.`,
        };
      }

      if (action === "RELIST") {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + RELIST_TTL_DAYS);

        const newListing = await tx.marketListing.create({
          data: {
            sellerId: user.id,
            userMonsterId: listing.userMonsterId,
            price: listing.price,
            isActive: true,
            expiresAt,
          },
        });

        await tx.marketListing.update({
          where: { id: listing.id },
          data: {
            resolutionStatus: "EXPIRED_RELISTED",
            resolvedAt: now,
          },
        });

        await tx.monsterHistoryEvent.create({
          data: {
            userMonsterId: listing.userMonsterId,
            actorUserId: user.id,
            action: "RELISTED_AFTER_EXPIRE",
            description: `Relisted on the marketplace for ${newListing.price} coins after a previous listing expired.`,
          },
        });

        return {
          coinsAfter: undefined,
          message: "Monster relisted on the marketplace.",
        };
      }

      throw new Error("Unsupported action.");
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error resolving unclaimed item:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to handle item that didn't sell.",
      },
      { status: 400 }
    );
  }
}
