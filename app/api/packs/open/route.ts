// app/api/packs/open/route.ts
//
// Opens a pack for the current user.
// - Starter packs ("starter"): free, max 2 per user.
// - Paid packs (bronze/silver/gold/mythical): cost coins from user balance.
// - Uses monsters-2025-26.json (teams + players) and generates rarity + base stats on the fly.
//
// NEW IN THIS VERSION:
// - Uses minutesFirst13 from your JSON to decide who can be multi-rarity.
//   * minutesFirst13 < 300  => COMMON-only (true fringe / barely plays)
//   * minutesFirst13 >= 300 => can roll COMMON / RARE / EPIC / LEGENDARY
// - Pack-specific rarity odds for multi-rarity players (starter/bronze/silver/gold/mythical).
// - Tiny chance per card to roll from the 8 Mythical monsters pool,
//   which always have rarity "MYTHICAL" and custom art/stats.
//
// Still also:
// - Handles limited editions via pack definition knobs, with a hard cap
//   of 10 GOLDEN limited editions per base monster (numbered 1/10).
// - Stores artBasePath + setCode on UserMonster.
// - Updates objectives via the Season 1 sync helper.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getPackDefinition, PackId } from "@/lib/packs";

import rawTeams from "@/data/monsters-2025-26.json";
import { syncObjectivesForUserSeason1 } from "@/lib/objectives/syncSeason1";
import { MYTHICAL_MONSTERS } from "@/lib/mythicals";

export const runtime = "nodejs";

// Match your JSON types
type RawPlayer = {
  fplId: number;
  code: number;
  realName: string;
  webName: string;
  monsterName: string;
  position: string; // "GK" | "DEF" | "MID" | "FWD"
  teamId: number;
  teamName: string;
  teamShortName: string;
  photo: string;
  // NEW: minutes from first 13 gameweeks, added by your script
  minutesFirst13?: number;
  // Optional art override (used by Mythicals)
  artBasePath?: string;
};

type RawTeam = {
  teamId: number;
  teamName: string;
  teamShortName: string;
  players: RawPlayer[];
};

// Flatten all players from all teams
const ALL_PLAYERS: RawPlayer[] = (rawTeams as RawTeam[]).flatMap(
  (team) => team.players || []
);

// --- Minutes-based eligibility --------------------------------------

// Below this many minutes, a player is treated as a fringe/no-gametime card
// and will be COMMON-only in packs.
const MINUTES_CUTOFF = 300;

function canRollHigherRarity(player: RawPlayer): boolean {
  const minutes = player.minutesFirst13 ?? 0;
  return minutes >= MINUTES_CUTOFF;
}

// --- Pack rarity profiles for normal players ------------------------

type RarityProfile = {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
};

const PACK_RARITY_PROFILES: Record<PackId, RarityProfile> = {
  starter: {
    common: 0.92,
    rare: 0.07,
    epic: 0.01,
    legendary: 0.0,
  },
  bronze: {
    common: 0.84,
    rare: 0.13,
    epic: 0.03,
    legendary: 0.0,
  },
  silver: {
    common: 0.72,
    rare: 0.18,
    epic: 0.08,
    legendary: 0.02,
  },
  gold: {
    common: 0.55,
    rare: 0.25,
    epic: 0.15,
    legendary: 0.05,
  },
  // 🔥 Mythical pack: very low commons, big legendary odds
  mythical: {
    common: 0.15,
    rare: 0.30,
    epic: 0.30,
    legendary: 0.25,
  },
};

function getRarityProfile(packId: PackId): RarityProfile {
  return PACK_RARITY_PROFILES[packId] ?? PACK_RARITY_PROFILES.starter;
}

function rollBaseRarityForPack(packId: PackId): string {
  const profile = getRarityProfile(packId);
  const r = Math.random();
  let acc = 0;

  acc += profile.common;
  if (r < acc) return "COMMON";

  acc += profile.rare;
  if (r < acc) return "RARE";

  acc += profile.epic;
  if (r < acc) return "EPIC";

  return "LEGENDARY";
}

function rollRarityForPlayer(player: RawPlayer, packId: PackId): string {
  // If they haven't played enough, they're a fringe / no-gametime monster:
  // COMMON-only, regardless of pack.
  if (!canRollHigherRarity(player)) {
    return "COMMON";
  }

  // Otherwise, use the pack's rarity profile.
  return rollBaseRarityForPack(packId);
}

// --- Stat generation for normal players -----------------------------

function generateBaseStats(position: string, rarity: string) {
  let baseAtk = 40;
  let baseMag = 40;
  let baseDef = 40;

  const pos = position.toUpperCase();
  if (pos === "GK") {
    baseAtk = 20;
    baseMag = 40;
    baseDef = 60;
  } else if (pos === "DEF") {
    baseAtk = 30;
    baseMag = 30;
    baseDef = 60;
  } else if (pos === "MID") {
    baseAtk = 45;
    baseMag = 45;
    baseDef = 40;
  } else if (pos === "FWD") {
    baseAtk = 60;
    baseMag = 30;
    baseDef = 30;
  }

  let bonus = 0;
  const r = rarity.toUpperCase();
  if (r === "RARE") bonus = 10;
  else if (r === "EPIC") bonus = 20;
  else if (r === "LEGENDARY") bonus = 30;

  const rand = () => Math.floor(Math.random() * 6); // 0–5

  return {
    baseAttack: baseAtk + bonus + rand(),
    baseMagic: baseMag + bonus + rand(),
    baseDefense: baseDef + bonus + rand(),
  };
}

// --- Limited editions ------------------------------------------------

function maybeRollLimitedEdition(
  limitedEditionChance: number | undefined
): boolean {
  if (!limitedEditionChance || limitedEditionChance <= 0) return false;
  return Math.random() < limitedEditionChance;
}

function buildBaseArtPath(player: RawPlayer): string {
  return `/cards/base/${player.code}.png`;
}

// --- Mythical roll helper -------------------------------------------

function rollMythical(
  mythicalChancePerCard: number | undefined
): (RawPlayer & {
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
}) | null {
  if (!mythicalChancePerCard || mythicalChancePerCard <= 0) {
    return null;
  }

  const r = Math.random();
  if (r >= mythicalChancePerCard) return null;

  if (MYTHICAL_MONSTERS.length === 0) return null;

  const myth =
    MYTHICAL_MONSTERS[
      Math.floor(Math.random() * MYTHICAL_MONSTERS.length)
    ];

  // Shape it like a normal pack monster but with rarity "MYTHICAL"
  return {
    fplId: myth.fplId,
    code: myth.code,
    realName: myth.realName,
    webName: myth.webName,
    monsterName: myth.monsterName,
    position: myth.position,
    teamId: myth.teamId,
    teamName: myth.teamName,
    teamShortName: myth.teamShortName,
    photo: myth.photo,
    artBasePath: myth.artBasePath,
    rarity: "MYTHICAL",
    baseAttack: myth.baseAttack,
    baseMagic: myth.baseMagic,
    baseDefense: myth.baseDefense,
  };
}

// Pick N monsters for a pack, mixing:
// - Mythicals (tiny chance, from MYTHICAL_MONSTERS)
// - Normal players (minutes + rarity profile)
function pickPlayersForPack(
  size: number,
  packId: PackId,
  mythicalChancePerCard: number | undefined
): (RawPlayer & {
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
})[] {
  if (ALL_PLAYERS.length === 0) {
    throw new Error("No monster templates available.");
  }

  const result: (RawPlayer & {
    rarity: string;
    baseAttack: number;
    baseMagic: number;
    baseDefense: number;
  })[] = [];

  for (let i = 0; i < size; i++) {
    // 1) Try Mythical roll first
    const myth = rollMythical(mythicalChancePerCard);
    if (myth) {
      result.push(myth);
      continue;
    }

    // 2) Otherwise, pick a normal player from the JSON
    const raw =
      ALL_PLAYERS[Math.floor(Math.random() * ALL_PLAYERS.length)];
    const rarity = rollRarityForPlayer(raw, packId);
    const stats = generateBaseStats(raw.position, rarity);

    result.push({
      ...raw,
      rarity,
      ...stats,
    });
  }

  return result;
}

// NOTE: frontend sends { packId }, not { packType }
type Body = {
  packId?: PackId | string;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const packId = (body.packId as PackId) ?? "starter";
  const def = getPackDefinition(packId);

  if (!def) {
    return NextResponse.json(
      { error: "Unknown pack type." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const dbUser = await tx.user.findUnique({
        where: { id: user.id },
      });

      if (!dbUser) {
        throw new Error("User not found.");
      }

      // Starter pack: max 2 opens per user
      if (def.id === "starter") {
        const openedStarterCount = await tx.packOpen.count({
          where: {
            userId: dbUser.id,
            packType: "starter",
          },
        });

        if (openedStarterCount >= 2) {
          throw new Error(
            "You have already opened your 2 free starter packs."
          );
        }
      } else {
        // Paid packs: check coin balance
        if (dbUser.coins < def.cost) {
          throw new Error("Not enough coins to buy this pack.");
        }
      }

      let newCoinBalance = dbUser.coins;
      if (def.cost > 0) {
        newCoinBalance = dbUser.coins - def.cost;
        await tx.user.update({
          where: { id: dbUser.id },
          data: { coins: newCoinBalance },
        });
      }

      await tx.packOpen.create({
        data: {
          userId: dbUser.id,
          packType: def.id,
        },
      });

      const chosen = pickPlayersForPack(
        def.size,
        def.id,
        def.mythicalChancePerCard
      );

      const createdMonsters = [];
      for (const p of chosen) {
        const isMythical = p.rarity === "MYTHICAL";

        // Decide if this roll *wants* to be a limited edition
        const rolledLimited =
          !isMythical &&
          maybeRollLimitedEdition(def.limitedEditionChance);

        // Default edition values
        let editionType: "BASE" | "THEMED" | "LIMITED" = "BASE";
        let serialNumber: number | null = null;
        let editionLabel: string | null = null;

        // Set code defaults
        let setCode = isMythical ? "MYTHICAL" : "BASE";

        if (isMythical) {
          // Mythicals are their own thing, not "Limited"
          editionLabel = "Mythical";
        } else if (rolledLimited) {
          // Hard cap: at most 10 limited editions per templateCode
          const existingLECount = await tx.userMonster.count({
            where: {
              templateCode: String(p.code),
              editionType: "LIMITED",
            },
          });

          if (existingLECount < 10) {
            editionType = "LIMITED";
            serialNumber = existingLECount + 1;
            editionLabel = `${serialNumber} of 10`;
          }
          // If >= 10, we silently fall back to a normal BASE card
        }

        const artBasePath =
          p.artBasePath && isMythical
            ? p.artBasePath
            : buildBaseArtPath(p);

        const created = await tx.userMonster.create({
          data: {
            userId: dbUser.id,
            templateCode: String(p.code),
            displayName: p.monsterName,
            realPlayerName: p.realName,
            position: p.position,
            club: p.teamShortName || p.teamName,
            rarity: p.rarity,
            baseAttack: p.baseAttack,
            baseMagic: p.baseMagic,
            baseDefense: p.baseDefense,

            setCode,
            editionType,
            editionLabel: editionLabel ?? undefined,
            serialNumber: serialNumber ?? undefined,
            artBasePath,
          },
        });

        await tx.monsterHistoryEvent.create({
          data: {
            userMonsterId: created.id,
            actorUserId: dbUser.id,
            action: "CREATED",
            description: `Found in ${def.name} pack (${def.id})${
              isMythical ? " [MYTHICAL]" : ""
            }${
              created.editionType === "LIMITED" && created.serialNumber
                ? ` [Limited Edition #${created.serialNumber}/10]`
                : ""
            }`,
          },
        });

        createdMonsters.push(created);
      }

      return {
        coinsAfter: newCoinBalance,
        monsters: createdMonsters,
      };
    });

    // 🔥 Sync all Season 1 objectives (open_packs, collection_size, etc.)
    await syncObjectivesForUserSeason1(user.id);

    return NextResponse.json({
      message: `Opened ${def.name}`,
      packType: def.id,
      coinsAfter: result.coinsAfter,
      monsters: result.monsters.map((m) => ({
        id: m.id,
        templateCode: m.templateCode,
        displayName: m.displayName,
        realPlayerName: m.realPlayerName,
        position: m.position,
        club: m.club,
        rarity: m.rarity,
        baseAttack: m.baseAttack,
        baseMagic: m.baseMagic,
        baseDefense: m.baseDefense,
        evolutionLevel: m.evolutionLevel,
        artBasePath: m.artBasePath,
        setCode: m.setCode,
        editionType: m.editionType,
        editionLabel: m.editionLabel,
        serialNumber: m.serialNumber,
      })),
    });
  } catch (err: any) {
    console.error("Error opening pack:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to open pack." },
      { status: 400 }
    );
  }
}
