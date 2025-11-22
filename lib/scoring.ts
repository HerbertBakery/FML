// lib/scoring.ts
//
// Gameweek scoring for Fantasy Monster League.
//
// - Ensures the Gameweek row exists (auto-creates if missing).
// - Pulls official FPL live data for a given gameweek.
// - Uses bootstrap-static to map FPL element id -> code.
// - Maps FPL "code" to our UserMonster.templateCode.
// - Updates per-monster career totals (goals, assists, CS, fantasy points).
// - Aggregates per-user gameweek totals into UserGameweekScore.
//
// IMPORTANT: This assumes your UserMonster.templateCode is the FPL "code" field,
// which is exactly how we set it when opening packs (templateCode: String(p.code)).

import { prisma } from "@/lib/db";

// ---------- Types for FPL API ----------

type FplElementLive = {
  id: number; // FPL element id
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    total_points: number;
  };
};

type FplLiveEventResponse = {
  elements: FplElementLive[];
};

type FplBootstrapElement = {
  id: number; // FPL element id
  code: number; // FPL code
};

type FplBootstrapResponse = {
  elements: FplBootstrapElement[];
};

export type PlayerPerformance = {
  fplId: number; // element id
  code: number | null; // FPL code (used to match templateCode)
  goals: number;
  assists: number;
  cleanSheets: number;
  totalPoints: number;
};

// ---------- Fetch helpers ----------

/**
 * Fetch bootstrap-static once, to get a mapping from element id -> code.
 */
async function fetchIdToCodeMap(): Promise<Map<number, number>> {
  const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
  const res = await fetch(url, { cache: "force-cache" });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch FPL bootstrap-static (status ${res.status})`
    );
  }

  const data = (await res.json()) as FplBootstrapResponse;

  if (!data.elements || !Array.isArray(data.elements)) {
    throw new Error("Unexpected bootstrap-static response shape");
  }

  const map = new Map<number, number>();
  for (const el of data.elements) {
    if (typeof el.id === "number" && typeof el.code === "number") {
      map.set(el.id, el.code);
    }
  }
  return map;
}

/**
 * Fetch live FPL stats for a given gameweek and attach FPL "code"
 * (so we can match your monsters via templateCode = code).
 */
async function fetchFplGameweekLiveWithCode(
  gameweekNumber: number
): Promise<PlayerPerformance[]> {
  // First get id -> code map
  const idToCode = await fetchIdToCodeMap();

  // Then get the live event data
  const url = `https://fantasy.premierleague.com/api/event/${gameweekNumber}/live/`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch FPL data for gameweek ${gameweekNumber} (status ${res.status})`
    );
  }

  const data = (await res.json()) as FplLiveEventResponse;

  if (!data.elements || !Array.isArray(data.elements)) {
    throw new Error(
      `Unexpected FPL live response shape for gameweek ${gameweekNumber}`
    );
  }

  return data.elements.map((el) => {
    const code = idToCode.get(el.id) ?? null;
    return {
      fplId: el.id,
      code,
      goals: el.stats.goals_scored ?? 0,
      assists: el.stats.assists ?? 0,
      cleanSheets: el.stats.clean_sheets ?? 0,
      totalPoints: el.stats.total_points ?? 0
    };
  });
}

// ---------- Main scoring function ----------

/**
 * Main scoring function, called by the admin scoring route.
 *
 * Steps:
 *  1. Ensure Gameweek row exists (create if missing).
 *  2. Fetch FPL stats (live + bootstrap mapping).
 *  3. Build a map from FPL "code" -> performance.
 *  4. Find UserMonsters whose templateCode matches that code.
 *  5. Update monster career totals.
 *  6. Aggregate and upsert UserGameweekScore per user.
 */
export async function applyGameweekPerformances(
  gameweekNumber: number
): Promise<void> {
  if (!Number.isInteger(gameweekNumber) || gameweekNumber <= 0) {
    throw new Error(
      `Invalid gameweekNumber: ${gameweekNumber}`
    );
  }

  // 1) Ensure Gameweek exists in our DB
  let gw = await prisma.gameweek.findFirst({
    where: { number: gameweekNumber }
  });

  if (!gw) {
    // Auto-create a shell gameweek if not found.
    gw = await prisma.gameweek.create({
      data: {
        number: gameweekNumber,
        name: `Gameweek ${gameweekNumber}`,
        // This date is just metadata for FML; scoring is keyed by gameweekNumber.
        deadlineAt: new Date(),
        isActive: true
      }
    });
  }

  // 2) Fetch FPL stats (with code)
  const performances = await fetchFplGameweekLiveWithCode(
    gameweekNumber
  );

  if (performances.length === 0) {
    console.warn(
      `No FPL performances found for gameweek ${gameweekNumber}.`
    );
    return;
  }

  // 3) Build a lookup map by FPL "code" as string
  const perfByCode = new Map<string, PlayerPerformance>();
  for (const p of performances) {
    if (p.code == null) continue;
    perfByCode.set(String(p.code), p);
  }

  if (perfByCode.size === 0) {
    console.warn(
      `No FPL codes available to map for gameweek ${gameweekNumber}.`
    );
    return;
  }

  const matchingTemplateCodes = Array.from(perfByCode.keys());

  // 4) Find all UserMonsters whose templateCode matches any of those codes.
  const monsters = await prisma.userMonster.findMany({
    where: {
      templateCode: {
        in: matchingTemplateCodes
      }
    }
  });

  if (monsters.length === 0) {
    console.warn(
      `No UserMonster entries matched FPL codes for gameweek ${gameweekNumber}.`
    );
    return;
  }

  // 5) Update monster totals & aggregate per-user gameweek totals
  const userTotals = new Map<string, number>();

  for (const monster of monsters) {
    const perf = perfByCode.get(monster.templateCode);
    if (!perf) continue;

    // Update career totals
    await prisma.userMonster.update({
      where: { id: monster.id },
      data: {
        totalGoals: {
          increment: perf.goals
        },
        totalAssists: {
          increment: perf.assists
        },
        totalCleanSheets: {
          increment: perf.cleanSheets
        },
        totalFantasyPoints: {
          increment: perf.totalPoints
        }
      }
    });

    // Aggregate per-user gameweek total
    const prev = userTotals.get(monster.userId) ?? 0;
    userTotals.set(monster.userId, prev + perf.totalPoints);
  }

  // 6) Upsert UserGameweekScore per user
  const entries = Array.from(userTotals.entries()); // [userId, points]

  for (const [userId, points] of entries) {
    await prisma.userGameweekScore.upsert({
      where: {
        userId_gameweekId: {
          userId,
          gameweekId: gw.id
        }
      },
      update: {
        points
      },
      create: {
        userId,
        gameweekId: gw.id,
        points
      }
    });
  }

  console.log(
    `Scored gameweek ${gameweekNumber} for ${entries.length} users.`
  );
}
