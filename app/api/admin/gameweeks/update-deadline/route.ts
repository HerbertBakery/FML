// app/api/admin/gameweeks/update-deadline/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const number = body?.number as number | undefined;
  const deadlineAtRaw = body?.deadlineAt as string | undefined;

  if (typeof number !== "number" || !Number.isInteger(number) || number < 1 || number > 38) {
    return NextResponse.json(
      { error: "Provide a valid gameweek number between 1 and 38." },
      { status: 400 }
    );
  }

  if (!deadlineAtRaw || typeof deadlineAtRaw !== "string") {
    return NextResponse.json(
      { error: "deadlineAt must be a non-empty date string." },
      { status: 400 }
    );
  }

  const deadlineDate = new Date(deadlineAtRaw);
  if (Number.isNaN(deadlineDate.getTime())) {
    return NextResponse.json(
      { error: "deadlineAt must be a valid date string (e.g. ISO or datetime-local value)." },
      { status: 400 }
    );
  }

  try {
    // If the GW doesn't exist yet, create it; otherwise update
    const gameweek = await prisma.gameweek.upsert({
      where: { number },
      update: { deadlineAt: deadlineDate },
      create: {
        number,
        name: `Gameweek ${number}`,
        deadlineAt: deadlineDate,
        isActive: false,
      },
    });

    return NextResponse.json({ gameweek });
  } catch (err) {
    console.error("Error updating gameweek deadline:", err);
    return NextResponse.json(
      { error: "Failed to update gameweek deadline." },
      { status: 500 }
    );
  }
}
