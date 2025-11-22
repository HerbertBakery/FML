// app/api/gameweeks/ingest-stats/route.ts
//
// Admin / debug endpoint to ingest real (or test) stats for a gameweek,
// compute fantasy points for each entry, and apply monster evolution.

import { NextRequest, NextResponse } from "next/server";
import {
  applyGameweekPerformances,
  StatInput
} from "@/lib/scoring";

export const runtime = "nodejs";

type Body = {
  gameweekNumber: number;
  performances: StatInput[];
};

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { gameweekNumber, performances } = body;

  if (!gameweekNumber || !Array.isArray(performances)) {
    return NextResponse.json(
      {
        error:
          "Body must include gameweekNumber and performances array."
      },
      { status: 400 }
    );
  }

  try {
    const result = await applyGameweekPerformances(
      gameweekNumber,
      performances
    );

    return NextResponse.json({
      message:
        "Stats ingested, scores updated, and evolutions applied for this gameweek.",
      ...result
    });
  } catch (err: any) {
    console.error("Error in ingest-stats:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to apply performances to this gameweek."
      },
      { status: 500 }
    );
  }
}
