// app/api/marketplace/price-history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const templateCode = url.searchParams.get("templateCode");
  const userMonsterId = url.searchParams.get("userMonsterId");

  if (!templateCode && !userMonsterId) {
    return NextResponse.json(
      { error: "templateCode or userMonsterId is required." },
      { status: 400 }
    );
  }

  try {
    const whereClause = userMonsterId
      ? { userMonsterId }
      : {
          userMonster: {
            templateCode: templateCode!,
          },
        };

    const transactions = await prisma.marketTransaction.findMany({
      where: whereClause,
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });

    const result = transactions.map((tx) => ({
      id: tx.id,
      price: tx.price,
      createdAt: tx.createdAt,
    }));

    return NextResponse.json({ history: result });
  } catch (err) {
    console.error("Error loading price history:", err);
    return NextResponse.json(
      { error: "Failed to load price history." },
      { status: 500 }
    );
  }
}
