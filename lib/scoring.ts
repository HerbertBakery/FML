// lib/scoring.ts
import { prisma } from "./db";

export type StatInput = {
  templateCode: string; // maps to UserMonster.templateCode (FPL code)
  goals?: number;
  assists?: number;
  cleanSheet?: boolean;
  minutes?: number;
  saves?: number;
  pensSaved?: number;
};

// Fantasy scoring rules (same as before)
export function computeFantasyPoints(
  position: string,
  perf: StatInput
): number {
  const minutes = perf.minutes ?? 0;
  const goals = perf.goals ?? 0;
  const assists = perf.assists ?? 0;
  const cs = perf.cleanSheet ?? false;
  const saves = perf.saves ?? 0;
  const pensSaved = perf.pensSaved ?? 0;

  let pts = 0;

  // Minutes
  if (minutes >= 60) pts += 2;
  else if (minutes > 0) pts += 1;

  switch (position) {
    case "GK":
      pts += goals * 6;
      pts += assists * 3;
      if (cs && minutes >= 60) pts += 4;
      pts += Math.floor(saves / 3); // +1 per 3 saves
      pts += pensSaved * 5;
      break;
    case "DEF":
      pts += goals * 7;
      pts += assists * 3;
      if (cs && minutes >= 60) pts += 4;
      break;
    case "MID":
      pts += goals * 6;
      pts += assists * 3;
      if (cs && minutes >= 60) pts += 1;
      break;
    case "FWD":
      pts += goals * 5;
      pts += assists * 3;
      break;
    default:
      pts += goals * 5;
      pts += assists * 3;
  }

  return pts;
}

// Evolution rules
export function computeNewEvolutionLevelAndStats(args: {
  position: string;
  rarity: string;
  currentLevel: number;
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets: number;
  perf: StatInput;
}) {
  const {
    position,
    rarity,
    currentLevel,
    totalGoals,
    totalAssists,
    totalCleanSheets,
    perf
  } = args;

  let newLevel = currentLevel;
  const goalsThis = perf.goals ?? 0;
  const assistsThis = perf.assists ?? 0;
  const csThis = perf.cleanSheet ?? false;

  // Forward evolutions
  if (position === "FWD") {
    if (goalsThis >= 3 && newLevel < 1) {
      newLevel = 1;
    }
    if (totalGoals >= 15 && newLevel < 2) {
      newLevel = 2;
    }
  }

  // Midfield evolutions
  if (position === "MID") {
    if (assistsThis >= 2 && newLevel < 1) {
      newLevel = 1;
    }
    if (totalAssists >= 15 && newLevel < 2) {
      newLevel = 2;
    }
  }

  // Defender / GK evolutions based on clean sheets
  if (position === "DEF" || position === "GK") {
    if (totalCleanSheets >= 5 && newLevel < 1) {
      newLevel = 1;
    }
    if (totalCleanSheets >= 12 && newLevel < 2) {
      newLevel = 2;
    }
  }

  // Legendary slight bias
  const r = rarity.toUpperCase();
  if (r === "LEGENDARY" && newLevel < 2) {
    if ((goalsThis > 0 || assistsThis > 0 || csThis) && currentLevel === 0) {
      newLevel = 1;
    }
  }

  return newLevel;
}

// Stat buff per evolution level
export function statBuffPerLevel(position: string) {
  switch (position) {
    case "FWD":
      return { atk: 7, mag: 3, def: 2 };
    case "MID":
      return { atk: 5, mag: 5, def: 3 };
    case "DEF":
      return { atk: 3, mag: 2, def: 6 };
    case "GK":
      return { atk: 2, mag: 6, def: 7 };
    default:
      return { atk: 4, mag: 4, def: 4 };
  }
}

function getPerformanceMap(perfs: StatInput[]) {
  const map = new Map<string, StatInput>();
  for (const p of perfs) {
    map.set(String(p.templateCode), p);
  }
  return map;
}

// Core: apply performances to one gameweek (used by both ingest-stats + FPL)
export async function applyGameweekPerformances(
  gameweekNumber: number,
  performances: StatInput[]
) {
  const gw = await prisma.gameweek.findFirst({
    where: { number: gameweekNumber }
  });

  if (!gw) {
    throw new Error(`Gameweek ${gameweekNumber} not found.`);
  }

  const perfMap = getPerformanceMap(performances);

  const entries = await prisma.gameweekEntry.findMany({
    where: { gameweekId: gw.id },
    include: {
      monsters: {
        include: {
          userMonster: true
        },
        orderBy: { slot: "asc" }
      }
    }
  });

  if (entries.length === 0) {
    return {
      gameweekId: gw.id,
      gameweekNumber,
      entriesProcessed: 0,
      monstersUpdated: 0
    };
  }

  let totalMonsterUpdates = 0;

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      let totalPointsForUser = 0;

      for (const m of entry.monsters) {
        const um = m.userMonster;

        const perf =
          perfMap.get(String(um.templateCode)) || {
            templateCode: String(um.templateCode)
          };

        const basePoints = computeFantasyPoints(
          um.position,
          perf
        );
        const factor = m.isSub ? 0.5 : 1.0;
        const points = Math.round(basePoints * factor);
        totalPointsForUser += points;

        const goalsThis = perf.goals ?? 0;
        const assistsThis = perf.assists ?? 0;
        const csThis = perf.cleanSheet ?? false;

        const newTotals = {
          totalGoals: um.totalGoals + goalsThis,
          totalAssists: um.totalAssists + assistsThis,
          totalCleanSheets: um.totalCleanSheets + (csThis ? 1 : 0),
          totalFantasyPoints: um.totalFantasyPoints + points
        };

        const newLevel = computeNewEvolutionLevelAndStats({
          position: um.position,
          rarity: um.rarity,
          currentLevel: um.evolutionLevel,
          totalGoals: newTotals.totalGoals,
          totalAssists: newTotals.totalAssists,
          totalCleanSheets: newTotals.totalCleanSheets,
          perf
        });

        const levelChanged = newLevel !== um.evolutionLevel;

        let newAttack = um.baseAttack;
        let newMagic = um.baseMagic;
        let newDefense = um.baseDefense;

        if (levelChanged) {
          const diffLevels = newLevel - um.evolutionLevel;
          if (diffLevels > 0) {
            const buff = statBuffPerLevel(um.position);
            newAttack = um.baseAttack + buff.atk * diffLevels;
            newMagic = um.baseMagic + buff.mag * diffLevels;
            newDefense = um.baseDefense + buff.def * diffLevels;
          }
        }

        await tx.userMonster.update({
          where: { id: um.id },
          data: {
            evolutionLevel: newLevel,
            totalGoals: newTotals.totalGoals,
            totalAssists: newTotals.totalAssists,
            totalCleanSheets: newTotals.totalCleanSheets,
            totalFantasyPoints: newTotals.totalFantasyPoints,
            baseAttack: newAttack,
            baseMagic: newMagic,
            baseDefense: newDefense
          }
        });

        totalMonsterUpdates++;

        if (levelChanged) {
          await tx.evolutionEvent.create({
            data: {
              userMonsterId: um.id,
              gameweekId: gw.id,
              reason: "Performance-based evolution",
              oldLevel: um.evolutionLevel,
              newLevel
            }
          });
        }
      }

      await tx.userGameweekScore.upsert({
        where: {
          userId_gameweekId: {
            userId: entry.userId,
            gameweekId: gw.id
          }
        },
        update: {
          points: totalPointsForUser
        },
        create: {
          userId: entry.userId,
          gameweekId: gw.id,
          points: totalPointsForUser
        }
      });
    }
  });

  return {
    gameweekId: gw.id,
    gameweekNumber,
    entriesProcessed: entries.length,
    monstersUpdated: totalMonsterUpdates
  };
}
