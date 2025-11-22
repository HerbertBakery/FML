// app/api/gameweeks/current/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateCurrentGameweek } from "@/lib/gameweeks";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gw = await getOrCreateCurrentGameweek();

  return NextResponse.json({
    gameweek: {
      id: gw.id,
      number: gw.number,
      name: gw.name,
      deadlineAt: gw.deadlineAt,
      isActive: gw.isActive
    }
  });
}
