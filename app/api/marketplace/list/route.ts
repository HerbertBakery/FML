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

  const monster = await prisma.userMonster.findFirst({
    where: {
      id: userMonsterId,
      userId: user.id
    }
  });

  if (!monster) {
    return NextResponse.json(
      {
        error:
          "You do not own this monster or it does not exist."
      },
      { status: 404 }
    );
  }

  const existing = await prisma.marketListing.findFirst({
    where: {
      userMonsterId,
      isActive: true
    }
  });

  if (existing) {
    return NextResponse.json(
      { error: "This monster is already listed for sale." },
      { status: 400 }
    );
  }

  const listing = await prisma.marketListing.create({
    data: {
      sellerId: user.id,
      userMonsterId,
      price,
      // 👇 IMPORTANT: do not rely on DB default
      isActive: true
    }
  });

  return NextResponse.json(
    {
      id: listing.id,
      price: listing.price
    },
    { status: 201 }
  );
}
