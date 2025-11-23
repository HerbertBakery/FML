// app/api/packs/open/route.ts
//
// Opens a pack for the current user.
// - Starter packs ("starter"): free, max 2 per user.
// - Paid packs (bronze/silver/gold): cost coins from user balance.
// - Uses monsters-2025-26.json (teams + players) and generates rarity + base stats on the fly,
//   but with smarter rarity so fringe players are almost always common.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  getPackDefinition,
  PackId
} from "@/lib/packs";

import rawTeams from "@/data/monsters-2025-26.json";

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

// --- Tiering logic --------------------------------------------------

// Very rough: we use keyword matches on names to classify.
// You can tweak this list any time without touching DB.

const ELITE_KEYWORDS = [
  "haaland",
  "salah",
  "odegaard",
  "saka",
  "bruno fernandes",
  "rashford",
  "de bruyne",
  "foden",
  "son",
  "palmer",
  "trent",
  "alexander-arnold",
  "van dijk",
  "allison",
  "alisson",
  "rodri",
  "martinelli",
  "sterling",
  "nunez",
  "gordon",
  "isak",
  "odegaard"
];

const CORE_KEYWORDS = [
  "martinez",
  "raya",
  "ramsdale",
  "gabriel",
  "white",
  "saliba",
  "rice",
  "havertz",
  "anthony",
  "antony",
  "casemiro",
  "shaw",
  "dalot",
  "stones",
  "walker",
  "dias",
  "grealish",
  "bernardo",
  "jota",
  "gakpo",
  "robertson",
  "chilwell",
  "reese james",
  "reese-james",
  "madueke",
  "martial",
  "odegaard" // (appears twice, doesn't matter)
];

type PlayerTier = "elite" | "core" | "fringe";

function normalize(s: string | undefined | null): string {
  return (s || "").toLowerCase();
}

function getPlayerTier(player: RawPlayer): PlayerTier {
  const rn = normalize(player.realName);
  const wn = normalize(player.webName);
  const mn = normalize(player.monsterName);

  const haystack = `${rn} ${wn} ${mn}`;

  for (const key of ELITE_KEYWORDS) {
    if (haystack.includes(key)) {
      return "elite";
    }
  }

  for (const key of CORE_KEYWORDS) {
    if (haystack.includes(key)) {
      return "core";
    }
  }

  // Everyone else = fringe squad / bench / rotation
  return "fringe";
}

// --- Rarity + stats generation --------------------------------------

function rollRarity(
  player: RawPlayer,
  bias: "normal" | "premium"
): string {
  const tier = getPlayerTier(player);
  const roll = Math.random();

  if (tier === "fringe") {
    // Bench guys: hard cap at rare
    // 85% common, 15% rare, 0 epic/legendary
    if (roll < 0.85) return "COMMON";
    return "RARE";
  }

  if (tier === "core") {
    if (bias === "normal") {
      // 60% C, 30% R, 8% E, 2% L
      if (roll < 0.6) return "COMMON";
      if (roll < 0.9) return "RARE";
      if (roll < 0.98) return "EPIC";
      return "LEGENDARY";
    } else {
      // premium bias:
      // 45% C, 30% R, 18% E, 7% L
      if (roll < 0.45) return "COMMON";
      if (roll < 0.75) return "RARE";
      if (roll < 0.93) return "EPIC";
      return "LEGENDARY";
    }
  }

  // tier === "elite"
  if (bias === "normal") {
    // 30% C, 35% R, 25% E, 10% L
    if (roll < 0.3) return "COMMON";
    if (roll < 0.65) return "RARE";
    if (roll < 0.9) return "EPIC";
    return "LEGENDARY";
  } else {
    // premium bias on elite:
    // 15% C, 30% R, 35% E, 20% L
    if (roll < 0.15) return "COMMON";
    if (roll < 0.45) return "RARE";
    if (roll < 0.8) return "EPIC";
    return "LEGENDARY";
  }
}

function generateBaseStats(position: string, rarity: string) {
  // Baseline per position
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

  // Rarity bonus
  let bonus = 0;
  const r = rarity.toUpperCase();
  if (r === "RARE") bonus = 10;
  else if (r === "EPIC") bonus = 20;
  else if (r === "LEGENDARY") bonus = 30;

  // Tiny random variation to make stats feel less copy/paste
  const rand = () => Math.floor(Math.random() * 6); // 0–5

  return {
    baseAttack: baseAtk + bonus + rand(),
    baseMagic: baseMag + bonus + rand(),
    baseDefense: baseDef + bonus + rand()
  };
}

// Pick N random players for a pack, with tier-aware rarity
function pickPlayersForPack(
  size: number,
  rarityBias: "normal" | "premium"
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
    const raw =
      ALL_PLAYERS[Math.floor(Math.random() * ALL_PLAYERS.length)];
    const rarity = rollRarity(raw, rarityBias);
    const stats = generateBaseStats(raw.position, rarity);

    result.push({
      ...raw,
      rarity,
      ...stats
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
      // Reload user for latest coins
      const dbUser = await tx.user.findUnique({
        where: { id: user.id }
      });

      if (!dbUser) {
        throw new Error("User not found.");
      }

      // Starter pack limit: max 2 total per user
      if (def.id === "starter") {
        const openedStarterCount = await tx.packOpen.count({
          where: {
            userId: dbUser.id,
            packType: "starter"
          }
        });

        if (openedStarterCount >= 2) {
          throw new Error(
            "You have already opened your 2 free starter packs."
          );
        }
      } else {
        // Paid pack: check coins (unlimited as long as you can afford)
        if (dbUser.coins < def.cost) {
          throw new Error(
            "Not enough coins to buy this pack."
          );
        }
      }

      // Deduct coins if needed
      let newCoinBalance = dbUser.coins;
      if (def.cost > 0) {
        newCoinBalance = dbUser.coins - def.cost;
        await tx.user.update({
          where: { id: dbUser.id },
          data: { coins: newCoinBalance }
        });
      }

      // Record pack open
      await tx.packOpen.create({
        data: {
          userId: dbUser.id,
          packType: def.id
        }
      });

      // Choose players and create UserMonster entries
      const chosen = pickPlayersForPack(
        def.size,
        def.rarityBias
      );

      const createdMonsters = [];
      for (const p of chosen) {
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
            baseDefense: p.baseDefense
          }
        });

        // NEW: log monster history — who found it, and from which pack
        await tx.monsterHistoryEvent.create({
          data: {
            userMonsterId: created.id,
            actorUserId: dbUser.id,
            action: "CREATED",
            description: `Found in ${def.name} pack (${def.id})`
          }
        });

        createdMonsters.push(created);
      }

      return {
        coinsAfter: newCoinBalance,
        monsters: createdMonsters
      };
    });

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
        evolutionLevel: m.evolutionLevel
      }))
    });
  } catch (err: any) {
    console.error("Error opening pack:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to open pack." },
      { status: 400 }
    );
  }
}
