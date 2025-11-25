// app/api/marketplace/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

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

  const userMonsterId = body.userMonsterId;
  const price = body.price ?? 0;

  if (!userMonsterId) {
    return NextResponse.json(
      { error: "userMonsterId is required." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "Price must be a positive number." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const monster = await tx.userMonster.findFirst({
        where: {
          id: userMonsterId,
          userId: user.id,
          isConsumed: false,
        },
      });

      if (!monster) {
        throw new Error(
          "You do not own this monster, it does not exist, or it has been consumed."
        );
      }

      const existing = await tx.marketListing.findFirst({
        where: {
          userMonsterId,
          isActive: true,
        },
      });

      if (existing) {
        throw new Error(
          "This monster is already listed for sale."
        );
      }

      const listing = await tx.marketListing.create({
        data: {
          sellerId: user.id,
          userMonsterId,
          price,
          isActive: true,
        },
      });

      // 🔹 History: LISTED
      await tx.monsterHistoryEvent.create({
        data: {
          userMonsterId: monster.id,
          actorUserId: user.id,
          action: "LISTED",
          description: `Listed for ${price} coins on the marketplace.`,
        },
      });

      return listing;
    });

    return NextResponse.json(
      {
        id: result.id,
        price: result.price,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Error listing monster:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to list monster for sale.",
      },
      { status: 400 }
    );
  }
}
