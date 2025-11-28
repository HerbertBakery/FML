// app/api/packs/open/route.ts
//
// Opens a pack for the current user.
// - Starter packs ("starter"): free, max 2 per user.
// - Paid packs (bronze/silver/gold): cost coins from user balance.
// - Uses monsters-2025-26.json (teams + players) and generates rarity + base stats on the fly,
//   but with smarter rarity so fringe players are almost always common.
//
// Now also:
// - Prepares for themed / limited editions via pack definition knobs.
// - Stores basic art path + setCode on UserMonster so front-end cards can show images.
// - Updates objectives via the Season 1 sync helper (open packs, collection size, etc.).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getPackDefinition, PackId } from "@/lib/packs";

import rawTeams from "@/data/monsters-2025-26.json";
import { syncObjectivesForUserSeason1 } from "@/lib/objectives/syncSeason1";

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
  "odegaard",
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
  "odegaard",
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
    if (roll < 0.85) return "COMMON";
    return "RARE";
  }

  if (tier === "core") {
    if (bias === "normal") {
      if (roll < 0.6) return "COMMON";
      if (roll < 0.9) return "RARE";
      if (roll < 0.98) return "EPIC";
      return "LEGENDARY";
    } else {
      if (roll < 0.45) return "COMMON";
      if (roll < 0.75) return "RARE";
      if (roll < 0.93) return "EPIC";
      return "LEGENDARY";
    }
  }

  // elite
  if (bias === "normal") {
    if (roll < 0.3) return "COMMON";
    if (roll < 0.65) return "RARE";
    if (roll < 0.9) return "EPIC";
    return "LEGENDARY";
  } else {
    if (roll < 0.15) return "COMMON";
    if (roll < 0.45) return "RARE";
    if (roll < 0.8) return "EPIC";
    return "LEGENDARY";
  }
}

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

function maybeRollLimitedEdition(
  limitedEditionChance: number | undefined
): boolean {
  if (!limitedEditionChance || limitedEditionChance <= 0) return false;
  return Math.random() < limitedEditionChance;
}

function buildBaseArtPath(player: RawPlayer): string {
  return `/cards/base/${player.code}.png`;
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
        if (dbUser.coins < def.cost) {
          throw new Error(
            "Not enough coins to buy this pack."
          );
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

      const chosen = pickPlayersForPack(def.size, def.rarityBias);

      const createdMonsters = [];
      for (const p of chosen) {
        const isLimited = maybeRollLimitedEdition(
          def.limitedEditionChance
        );

        const setCode = "BASE";
        const editionType = isLimited ? "LIMITED" : "BASE";
        const editionLabel = isLimited ? "Limited Edition" : null;

        const artBasePath = buildBaseArtPath(p);

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
            artBasePath,
          },
        });

        await tx.monsterHistoryEvent.create({
          data: {
            userMonsterId: created.id,
            actorUserId: dbUser.id,
            action: "CREATED",
            description: `Found in ${def.name} pack (${def.id})`,
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
