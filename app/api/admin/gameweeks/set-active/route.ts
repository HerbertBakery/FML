// app/api/admin/gameweeks/set-current/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const number = body?.number as number | undefined;

  if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number > 38) {
    return NextResponse.json(
      { error: "Provide a valid gameweek number between 1 and 38." },
      { status: 400 }
    );
  }

  try {
    const gameweek = await prisma.$transaction(async (tx) => {
      // Make sure a row exists for this GW
      await tx.gameweek.upsert({
        where: { number },
        update: {},
        create: {
          number,
          name: `Gameweek ${number}`,
          deadlineAt: new Date(), // placeholder, can be adjusted via update-deadline
          isActive: false,
        },
      });

      // Turn all GWs off
      await tx.gameweek.updateMany({
        data: { isActive: false },
      });

      // Turn this GW on
      return tx.gameweek.update({
        where: { number },
        data: { isActive: true },
      });
    });

    return NextResponse.json({ gameweek });
  } catch (err) {
    console.error("Error setting current gameweek:", err);
    return NextResponse.json(
      { error: "Failed to set current gameweek." },
      { status: 500 }
    );
  }
}
