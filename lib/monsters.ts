// lib/monsters.ts
//
// This file loads the monsterized Premier League data generated from FPL
// (data/monsters-2025-26.json) and turns it into MonsterTemplate objects
// with rarity + attack/magic/defense stats.
//

import monstersData from "@/data/monsters-2025-26.json";

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type MonsterTemplate = {
  code: string; // stable code per player (from FPL)
  displayName: string; // monster name
  realPlayerName: string;
  position: Position;
  club: string;
  teamShortName: string;
  rarity: Rarity;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
};

// Types for the raw JSON structure (teams -> players)
type RawTeam = {
  teamId: number;
  teamName: string;
  teamShortName: string;
  players: RawPlayer[];
};

type RawPlayer = {
  fplId: number;
  code: number;
  realName: string;
  webName: string;
  monsterName: string;
  position: string;
  teamId: number;
  teamName: string;
  teamShortName: string;
  photo?: string;
};

const rawTeams = monstersData as RawTeam[];

// Simple helper to clamp numbers into a range
function clamp(x: number, min: number, max: number): number {
  if (x < min) return min;
  if (x > max) return max;
  return x;
}

// Deterministic rarity from fplId so it’s stable across runs
function computeRarity(fplId: number): Rarity {
  const roll = fplId % 100; // 0–99

  if (roll < 3) return "LEGENDARY"; // ~3%
  if (roll < 12) return "EPIC"; // next ~9%
  if (roll < 35) return "RARE"; // next ~23%
  return "COMMON"; // rest
}

// Deterministic base stats from position + rarity + seed
function computeStats(
  position: Position,
  rarity: Rarity,
  seed: number
): { attack: number; magic: number; defense: number } {
  // Small deterministic offset from the seed
  const offset1 = seed % 10; // 0–9
  const offset2 = Math.floor(seed / 10) % 10; // 0–9
  const offset3 = Math.floor(seed / 100) % 10; // 0–9

  // Base ranges by position + rarity
  const baseRanges: Record<
    Position,
    Record<
      Rarity,
      { atk: [number, number]; mag: [number, number]; def: [number, number] }
    >
  > = {
    GK: {
      COMMON: { atk: [20, 35], mag: [60, 75], def: [70, 82] },
      RARE: { atk: [25, 40], mag: [68, 82], def: [78, 90] },
      EPIC: { atk: [30, 45], mag: [75, 88], def: [84, 94] },
      LEGENDARY: { atk: [35, 50], mag: [82, 92], def: [90, 99] }
    },
    DEF: {
      COMMON: { atk: [55, 68], mag: [55, 70], def: [70, 82] },
      RARE: { atk: [60, 73], mag: [60, 75], def: [78, 90] },
      EPIC: { atk: [65, 78], mag: [65, 80], def: [84, 94] },
      LEGENDARY: { atk: [70, 82], mag: [70, 85], def: [90, 99] }
    },
    MID: {
      COMMON: { atk: [68, 78], mag: [68, 80], def: [55, 70] },
      RARE: { atk: [72, 82], mag: [72, 84], def: [60, 75] },
      EPIC: { atk: [78, 88], mag: [78, 90], def: [65, 80] },
      LEGENDARY: { atk: [84, 94], mag: [84, 96], def: [70, 85] }
    },
    FWD: {
      COMMON: { atk: [78, 86], mag: [60, 75], def: [45, 60] },
      RARE: { atk: [82, 90], mag: [62, 78], def: [48, 63] },
      EPIC: { atk: [86, 94], mag: [65, 82], def: [50, 65] },
      LEGENDARY: { atk: [90, 99], mag: [70, 86], def: [52, 68] }
    }
  };

  const ranges = baseRanges[position][rarity];

  const atk =
    ranges.atk[0] + ((offset1 + offset2) % (ranges.atk[1] - ranges.atk[0] + 1));
  const mag =
    ranges.mag[0] + ((offset2 + offset3) % (ranges.mag[1] - ranges.mag[0] + 1));
  const def =
    ranges.def[0] + ((offset3 + offset1) % (ranges.def[1] - ranges.def[0] + 1));

  return {
    attack: clamp(atk, ranges.atk[0], ranges.atk[1]),
    magic: clamp(mag, ranges.mag[0], ranges.mag[1]),
    defense: clamp(def, ranges.def[0], ranges.def[1])
  };
}

// Flatten teams -> players into our MonsterTemplate array
const templates: MonsterTemplate[] = rawTeams.flatMap((team) =>
  team.players.map((p) => {
    // Normalize position
    const pos = (p.position as Position) || "MID";
    const rarity = computeRarity(p.fplId);
    const stats = computeStats(pos, rarity, p.fplId);

    return {
      code: String(p.code ?? p.fplId),
      displayName: p.monsterName,
      realPlayerName: p.realName,
      position: pos,
      club: p.teamName,
      teamShortName: p.teamShortName,
      rarity,
      baseAttack: stats.attack,
      baseMagic: stats.magic,
      baseDefense: stats.defense
    };
  })
);

// This is what the rest of the game uses (packs, etc.)
export const MONSTER_TEMPLATES: MonsterTemplate[] = templates;
