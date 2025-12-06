//
// Gameweek scoring for Fantasy Monster League.
//
// - Ensures the Gameweek row exists (auto-creates if missing).
// - Pulls official FPL live data for a given gameweek.
// - Uses bootstrap-static to map FPL element id -> code.
// - Maps FPL "code" to our UserMonster.templateCode.
// - Updates per-monster career totals (goals, assists, CS, fantasy points).
// - Aggregates per-user gameweek totals into UserGameweekScore.
// - Applies rarity + evolution multipliers to FPL points.
// - Applies chip-based evolution and blank-based devolution.
//
// Chips now have LIMITED TRIES:
// - Initial tries come from ChipTemplate.maxTries (or default 2 if missing).
// - On success: chip is consumed (isConsumed=true, remainingTries=0).
// - On failure: remainingTries--. If it hits 0, chip is consumed.
//   You can then re-assign the chip between failures; each assignment uses a “life”.
//

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
  minutes: number;
  saves: number;
  pensSaved: number;
};

// ---------- Evo + rarity helpers ----------

// Max evolution levels per rarity:
// COMMON:    max 1
// RARE:      max 2
// EPIC:      max 3
// LEGENDARY: max 4
// MYTHICAL:  fixed (no evo changes for now)
function getMaxEvoForRarity(rarityRaw: string | null | undefined): number {
  const rarity = (rarityRaw || "").toUpperCase().trim();
  switch (rarity) {
    case "COMMON":
      return 1;
    case "RARE":
      return 2;
    case "EPIC":
      return 3;
    case "LEGENDARY":
      return 4;
    case "MYTHICAL":
      return 0; // treated as fixed; multiplier handles their power
    default:
      return 1;
  }
}

/**
 * Evolution multiplier based on rarity + evolution level.
 *
 * These multipliers are applied to the FPL "base points" for the gameweek.
 * Example (Legendary, Evo 4, base 10 pts) => 10 * 2.0 = 20 FML points.
 */
function getEvolutionMultiplier(
  rarityRaw: string | null | undefined,
  evolutionLevelRaw: number | null | undefined
): number {
  const rarity = (rarityRaw || "").toUpperCase().trim();
  const evo = Math.max(0, evolutionLevelRaw ?? 0);
  const maxEvo = getMaxEvoForRarity(rarity);
  const clampedEvo = Math.min(evo, maxEvo);

  // Mythicals: treat as “always juiced”
  if (rarity === "MYTHICAL") {
    // even if evolutionLevel is 0, they get a strong fixed buff
    return 1.8;
  }

  // Base multipliers per rarity and evo
  switch (rarity) {
    case "COMMON": {
      if (clampedEvo === 0) return 1.0;
      // Evo 1
      return 1.15;
    }
    case "RARE": {
      if (clampedEvo === 0) return 1.0;
      if (clampedEvo === 1) return 1.2;
      // Evo 2
      return 1.35;
    }
    case "EPIC": {
      if (clampedEvo === 0) return 1.0;
      if (clampedEvo === 1) return 1.25;
      if (clampedEvo === 2) return 1.45;
      // Evo 3
      return 1.65;
    }
    case "LEGENDARY": {
      if (clampedEvo === 0) return 1.0;
      if (clampedEvo === 1) return 1.3;
      if (clampedEvo === 2) return 1.55;
      if (clampedEvo === 3) return 1.8;
      // Evo 4
      return 2.0;
    }
    default: {
      // Unknown rarity: treat as common-ish
      if (clampedEvo === 0) return 1.0;
      return 1.1;
    }
  }
}

// ---------- Chip helpers ----------

/**
 * Evaluate whether a chip condition succeeds given the player's performance.
 *
 * conditionType comes from ChipTemplate.conditionType, e.g.:
 * "GOAL_SURGE", "PLAYMAKER", "WALL", "HEROIC_HAUL", "STEADY_FORM"
 *
 * This version is more forgiving: it treats several variants / synonyms
 * as the same logical condition, so small differences in admin config
 * (like "GOAL" vs "GOAL_SURGE") still behave as expected.
 */
function checkChipSuccess(
  conditionTypeRaw: string,
  perf: PlayerPerformance,
  basePoints: number,
  parameterInt?: number | null
): boolean {
  const t = (conditionTypeRaw || "").toUpperCase().trim();

  // Normalised helpers
  const goals = perf.goals ?? 0;
  const assists = perf.assists ?? 0;
  const returns = goals + assists;
  const minutes = perf.minutes ?? 0;
  const cleanSheets = perf.cleanSheets ?? 0;

  // If parameterInt is set, use it as the threshold where sensible.
  const goalThreshold = parameterInt && parameterInt > 0 ? parameterInt : 1;
  const returnsThreshold = parameterInt && parameterInt > 0 ? parameterInt : 2;

  // Convenience predicates
  const nameIncludes = (kw: string) => t.includes(kw);

  // --- GOAL-BASED CHIPS ---
  if (
    t === "GOAL_SURGE" ||
    t === "GOAL" ||
    t === "SCORE_GOAL" ||
    t === "GOAL_CHIP" ||
    nameIncludes("GOAL")
  ) {
    return goals >= goalThreshold;
  }

  if (t === "BRACE" || nameIncludes("BRACE")) {
    return goals >= 2;
  }

  if (t === "HAT_TRICK" || nameIncludes("HATRICK") || nameIncludes("HAT-TRICK")) {
    return goals >= 3;
  }

  // --- GOAL OR ASSIST ---
  if (
    t === "GOAL_OR_ASSIST" ||
    nameIncludes("G+A") ||
    nameIncludes("GOAL_OR_ASSIST")
  ) {
    return returns >= 1;
  }

  // --- PLAYMAKER / DOUBLE RETURN ---
  if (t === "PLAYMAKER" || nameIncludes("PLAYMAKER")) {
    return returns >= returnsThreshold;
  }

  // --- WALL / CLEAN SHEET ---
  if (t === "WALL" || nameIncludes("WALL") || nameIncludes("CLEAN_SHEET")) {
    return cleanSheets > 0 && minutes >= 60;
  }

  // --- BIG HAUL ---
  if (t === "HEROIC_HAUL" || nameIncludes("HAUL")) {
    return basePoints >= (parameterInt && parameterInt > 0 ? parameterInt : 12);
  }

  // --- STEADY FORM / SOLID SCORE ---
  if (t === "STEADY_FORM" || nameIncludes("STEADY") || nameIncludes("FORM")) {
    return basePoints >= (parameterInt && parameterInt > 0 ? parameterInt : 5);
  }

  // Unknown condition: safe default is "never auto-succeed"
  return false;
}

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
      totalPoints: el.stats.total_points ?? 0,
      minutes: el.stats.minutes ?? 0,
      saves: el.stats.saves ?? 0,
      pensSaved: el.stats.penalties_saved ?? 0,
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
 *  4. For this gameweek, find all GameweekEntry rows + their 7 monsters.
 *  5. For each entry, compute per-monster GW points and per-user total.
 *  6. Update monster career totals and GameweekEntryMonster.points.
 *  7. Upsert UserGameweekScore per user (sum of all selected monsters).
 *
 * Now also:
 *  - Applies rarity + evolution multipliers to the FPL base points.
 *  - Classifies blanks (basePoints <= 2) and tracks blankStreak.
 *  - Applies chip-based evolution with limited tries.
 *  - Applies blank/disaster devolution.
 */
export async function applyGameweekPerformances(
  gameweekNumber: number
): Promise<void> {
  if (!Number.isInteger(gameweekNumber) || gameweekNumber <= 0) {
    throw new Error(`Invalid gameweekNumber: ${gameweekNumber}`);
  }

  // 1) Ensure Gameweek exists in our DB
  let gw = await prisma.gameweek.findFirst({
    where: { number: gameweekNumber },
  });

  if (!gw) {
    // Auto-create a shell gameweek if not found.
    gw = await prisma.gameweek.create({
      data: {
        number: gameweekNumber,
        name: `Gameweek ${gameweekNumber}`,
        // This date is just metadata for FML; scoring is keyed by gameweekNumber.
        deadlineAt: new Date(),
        isActive: true,
      },
    });
  }

  // 2) Fetch FPL stats (with code)
  const performances = await fetchFplGameweekLiveWithCode(gameweekNumber);

  if (performances.length === 0) {
    console.warn(`No FPL performances found for gameweek ${gameweekNumber}.`);
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

  // 4) Load all locked entries for this gameweek, each with its monsters
  const entries = await prisma.gameweekEntry.findMany({
    where: {
      gameweekId: gw.id,
    },
    include: {
      monsters: {
        include: {
          userMonster: true,
        },
        orderBy: {
          slot: "asc",
        },
      },
    },
  });

  if (entries.length === 0) {
    console.warn(
      `No GameweekEntry rows found for gameweek ${gameweekNumber}.`
    );
    return;
  }

  // Preload all *active* chip assignments (not yet resolved) for this gameweek.
  const chipAssignments = await prisma.monsterChipAssignment.findMany({
    where: {
      gameweekId: gw.id,
      resolvedAt: null,
    },
    include: {
      userChip: {
        include: {
          template: true,
        },
      },
    },
  });

  const chipByMonsterId = new Map<
    string,
    (typeof chipAssignments)[number]
  >();
  for (const ca of chipAssignments) {
    chipByMonsterId.set(ca.userMonsterId, ca);
  }

  // 5 & 6) For each entry, compute monster GW points and user total
  const userTotals = new Map<string, number>(); // userId -> total GW points

  for (const entry of entries) {
    let entryTotal = 0;

    for (const em of entry.monsters) {
      const monster = em.userMonster;
      const perf = perfByCode.get(monster.templateCode);

      // FPL base points for this player in this gameweek
      const basePoints = perf?.totalPoints ?? 0;

      // Blank definition: anything 2 points and lower (before our multipliers)
      const isBlank = basePoints <= 2;
      const isBigFail = basePoints <= 0; // e.g. red, OG, etc.

      const rarity = (monster.rarity || "").toUpperCase().trim();
      const evoLevel = (monster as any).evolutionLevel ?? 0;
      const currentBlankStreak = (monster as any).blankStreak ?? 0;

      // Track blank streak
      let newBlankStreak = isBlank ? currentBlankStreak + 1 : 0;

      let newEvoLevel = evoLevel;
      let evoChanged = false;
      let evoReason: string | null = null;

      // ---------- Devolution from blanks / disasters (non-Mythical only) ----------
      if (rarity !== "MYTHICAL" && evoLevel > 0) {
        // First: big disaster (<= 0 points) => immediate delevel by 1
        if (isBigFail) {
          newEvoLevel = Math.max(0, newEvoLevel - 1);
          evoChanged = true;
          evoReason =
            evoReason ??
            `Devolved after disastrous performance (${basePoints} base points).`;
          // reset streak so they don't get double-punished
          newBlankStreak = 0;
        } else if (newBlankStreak >= 3) {
          // 3 blanks in a row (<= 2 points)
          newEvoLevel = Math.max(0, newEvoLevel - 1);
          evoChanged = true;
          evoReason =
            evoReason ??
            "Devolved after 3 consecutive blanks (base points ≤ 2).";
          newBlankStreak = 0;
        }
      }

      // ---------- Chip-based evolution with limited tries ----------
      const chipAssignment = chipByMonsterId.get(monster.id);

      if (chipAssignment) {
        const chipTemplate = chipAssignment.userChip.template;
        const chip = chipAssignment.userChip;

        const maxTriesFromTemplate =
          typeof chipTemplate.maxTries === "number" &&
          chipTemplate.maxTries > 0
            ? chipTemplate.maxTries
            : 2;

        // Use remainingTries if present, otherwise derive from template
        const currentTries =
          typeof chip.remainingTries === "number"
            ? chip.remainingTries
            : maxTriesFromTemplate;

        // If the player didn't play / has no perf, treat as a failed attempt
        const chipSuccess =
          !!perf &&
          checkChipSuccess(
            chipTemplate.conditionType,
            perf,
            basePoints,
            chipTemplate.parameterInt
          );

        let nextTries = currentTries;

        if (chipSuccess) {
          // SUCCESS CASE:
          // - Always mark the assignment as successful.
          // - Always consume the chip (no more lives).
          // - If not MYTHICAL and under cap, also evolve the monster.

          if (rarity !== "MYTHICAL") {
            const maxEvo = getMaxEvoForRarity(rarity);
            if (newEvoLevel < maxEvo) {
              const before = newEvoLevel;
              newEvoLevel = newEvoLevel + 1;
              evoChanged = true;
              const chipReason = `Evolved via chip "${chipTemplate.code}" in GW ${gameweekNumber} (Evo ${before} → ${newEvoLevel}).`;
              evoReason = evoReason
                ? `${evoReason} ${chipReason}`
                : chipReason;
            }
          }

          // Success consumes the chip outright
          nextTries = 0;

          await prisma.userChip.update({
            where: { id: chip.id },
            data: {
              isConsumed: true,
              remainingTries: 0,
              consumedAt: new Date(),
            },
          });

          await prisma.monsterChipAssignment.update({
            where: { id: chipAssignment.id },
            data: {
              resolvedAt: new Date(),
              wasSuccessful: true,
            },
          });
        } else {
          // FAILURE CASE (including "didn't play"):
          // - Lose one life
          // - If lives hit 0, chip is consumed
          // - Mark assignment as failed

          nextTries = Math.max(0, currentTries - 1);
          const shouldConsume = nextTries <= 0;

          await prisma.userChip.update({
            where: { id: chip.id },
            data: {
              remainingTries: nextTries,
              ...(shouldConsume
                ? {
                    isConsumed: true,
                    consumedAt: new Date(),
                  }
                : {}),
            },
          });

          await prisma.monsterChipAssignment.update({
            where: { id: chipAssignment.id },
            data: {
              resolvedAt: new Date(),
              wasSuccessful: false,
            },
          });
        }

        // IMPORTANT:
        // - We do NOT leave any unresolved assignment after scoring.
        //   The chip can be re-assigned later (if remainingTries > 0)
        //   by creating a NEW MonsterChipAssignment row for a future gameweek.
      }

      // ---------- Evolution multiplier ----------
      const multiplier = getEvolutionMultiplier(rarity, newEvoLevel);
      const finalPoints = Math.round(basePoints * multiplier);

      // Build update payload for this monster
      const monsterUpdateData: any = {
        blankStreak: newBlankStreak,
      };

      if (perf) {
        monsterUpdateData.totalGoals = {
          increment: perf.goals,
        };
        monsterUpdateData.totalAssists = {
          increment: perf.assists,
        };
        monsterUpdateData.totalCleanSheets = {
          increment: perf.cleanSheets,
        };
        monsterUpdateData.totalFantasyPoints = {
          // IMPORTANT: track the *boosted* FML points, not just raw FPL points
          increment: finalPoints,
        };
      }

      if (newEvoLevel !== evoLevel) {
        monsterUpdateData.evolutionLevel = newEvoLevel;
      }

      // Update career totals + streak + evo
      await prisma.userMonster.update({
        where: { id: monster.id },
        data: monsterUpdateData,
      });

      // Log evolution / devolution if it happened
      if (newEvoLevel !== evoLevel) {
        await prisma.evolutionEvent.create({
          data: {
            userMonsterId: monster.id,
            gameweekId: gw.id,
            reason:
              evoReason ??
              `Evolution level changed from ${evoLevel} to ${newEvoLevel}.`,
            oldLevel: evoLevel,
            newLevel: newEvoLevel,
          },
        });
      }

      // Store per-monster GW FML points on the entry record
      await prisma.gameweekEntryMonster.update({
        where: { id: em.id },
        data: { points: finalPoints },
      });

      entryTotal += finalPoints;
    }

    const prev = userTotals.get(entry.userId) ?? 0;
    userTotals.set(entry.userId, prev + entryTotal);
  }

  // 7) Upsert UserGameweekScore per user (sum of *their locked monsters*)
  const entriesArray = Array.from(userTotals.entries()); // [userId, points]

  for (const [userId, points] of entriesArray) {
    await prisma.userGameweekScore.upsert({
      where: {
        userId_gameweekId: {
          userId,
          gameweekId: gw.id,
        },
      },
      update: {
        points,
      },
      create: {
        userId,
        gameweekId: gw.id,
        points,
      },
    });
  }

  console.log(
    `Scored gameweek ${gameweekNumber} for ${entriesArray.length} users (with evo multipliers + chips (limited tries) + blanks).`
  );
}
