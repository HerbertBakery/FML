// app/api/admin/fpl/score-gameweek/route.ts
//
// Fetches real FPL stats for a gameweek and applies scoring + evolution.
//
// - If body includes { gameweekNumber }, uses that.
// - Otherwise, finds the active gameweek in DB and uses its number.
// This can be triggered manually OR by a Vercel cron job.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  applyGameweekPerformances,
  StatInput
} from "@/lib/scoring";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

// Types based on FPL API structure
type FplElement = {
  id: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    saves: number;
    penalties_saved: number;
  };
};

type FplLiveResponse = {
  elements: FplElement[];
};

type FplBootstrapElement = {
  id: number;
  code: number;
};

type FplBootstrapStatic = {
  elements: FplBootstrapElement[];
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  let gameweekNumber: number | undefined;

  try {
    const body = await req.json().catch(() => null);
    if (body && typeof body.gameweekNumber === "number") {
      gameweekNumber = body.gameweekNumber;
    }
  } catch {
    // ignore, we'll fall back to active gameweek
  }

  // If no explicit gameweekNumber was passed, use the active one
  if (!gameweekNumber) {
    const activeGw = await prisma.gameweek.findFirst({
      where: { isActive: true },
      orderBy: { number: "asc" }
    });

    if (!activeGw) {
      return NextResponse.json(
        {
          error:
            "No active gameweek found and no gameweekNumber provided."
        },
        { status: 400 }
      );
    }

    gameweekNumber = activeGw.number;
  }

  try {
    // 1) Fetch bootstrap-static to map FPL element id -> code
    const bootstrapRes = await fetch(
      "https://fantasy.premierleague.com/api/bootstrap-static/"
    );
    if (!bootstrapRes.ok) {
      return NextResponse.json(
        {
          error:
            "Failed to fetch FPL bootstrap-static. Try again later."
        },
        { status: 502 }
      );
    }
    const bootstrap =
      (await bootstrapRes.json()) as FplBootstrapStatic;

    const idToCode = new Map<number, number>();
    for (const el of bootstrap.elements || []) {
      idToCode.set(el.id, el.code);
    }

    // 2) Fetch live stats for that gameweek
    const liveRes = await fetch(
      `https://fantasy.premierleague.com/api/event/${gameweekNumber}/live/`
    );
    if (!liveRes.ok) {
      return NextResponse.json(
        {
          error:
            "Failed to fetch FPL live data for this gameweek. It may not be active yet."
        },
        { status: 502 }
      );
    }
    const live = (await liveRes.json()) as FplLiveResponse;

    const performances: StatInput[] = [];

    for (const el of live.elements || []) {
      const elementId = el.id;
      const stats = el.stats || ({} as FplElement["stats"]);
      const code = idToCode.get(elementId);
      if (!code) continue;

      const perf: StatInput = {
        templateCode: String(code),
        goals: stats.goals_scored ?? 0,
        assists: stats.assists ?? 0,
        cleanSheet: (stats.clean_sheets ?? 0) > 0,
        minutes: stats.minutes ?? 0,
        saves: stats.saves ?? 0,
        pensSaved: stats.penalties_saved ?? 0
      };

      performances.push(perf);
    }

    if (performances.length === 0) {
      return NextResponse.json(
        {
          error:
            "No performances found in FPL live data for this gameweek.",
          gameweekNumber
        },
        { status: 200 }
      );
    }

    const result = await applyGameweekPerformances(
      gameweekNumber,
      performances
    );

    return NextResponse.json({
      message:
        "Fetched FPL data and applied scoring + evolution for this gameweek.",
      gameweekNumber,
      ...result
    });
  } catch (err: any) {
    console.error("Error scoring gameweek from FPL:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "Failed to score gameweek from FPL data."
      },
      { status: 500 }
    );
  }
}
