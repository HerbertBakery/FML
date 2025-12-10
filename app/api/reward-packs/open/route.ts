// app/api/reward-packs/open/route.ts
//
// Opens a *reward* pack (from objectives / sets) for the current user.
// - Does NOT charge coins.
// - Marks the RewardPack as opened (isOpened = true).
// - Logs packOpen + creates UserMonsters same as normal pack.
// - Records objectives progress (OPEN_PACKS_ANY).
//
// Limited editions:
// - Uses the pack definition's limitedEditionChance.
// - Hard cap of 10 LIMITED editions per templateCode *per rarity* (1 of 10, 2 of 10, ...).
// Unique editions:
// - Uses the pack definition's uniqueEditionChance.
// - Hard cap of 1 UNIQUE (1 of 1) per templateCode *per rarity*.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { getPackDefinition, PackId } from "@/lib/packs";

import rawTeams from "@/data/monsters-2025-26.json";
import { recordObjectiveProgress } from "@/lib/objectives/engine";

export const runtime = "nodejs";

// ---- Types matching monsters JSON ----
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

const ALL_PLAYERS: RawPlayer[] = (rawTeams as RawTeam[]).flatMap(
  (team) => team.players || []
);

// ---- Tiering / rarity helpers (same as normal reward packs) ----
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
    if (haystack.includes(key)) return "elite";
  }
  for (const key of CORE_KEYWORDS) {
    if (haystack.includes(key)) return "core";
  }
  return "fringe";
}

function rollRarity(player: RawPlayer, bias: "normal" | "premium"): string {
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

function maybeRollLimitedEdition(chance: number | undefined): boolean {
  if (!chance || chance <= 0) return false;
  return Math.random() < chance;
}

function maybeRollUniqueEdition(chance: number | undefined): boolean {
  if (!chance || chance <= 0) return false;
  return Math.random() < chance;
}

function buildBaseArtPath(player: RawPlayer): string {
  return `/cards/base/${player.code}.png`;
}

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

type Body = {
  rewardPackId?: string;
};

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { rewardPackId } = body;
  if (!rewardPackId) {
    return NextResponse.json(
      { error: "rewardPackId is required." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rewardPack = await tx.rewardPack.findUnique({
        where: { id: rewardPackId },
      });

      if (
        !rewardPack ||
        rewardPack.userId !== user.id ||
        rewardPack.isOpened // << use boolean from schema
      ) {
        throw new Error("Reward pack not available.");
      }

      // Get pack definition
      const packId = rewardPack.packId as PackId;
      const def = getPackDefinition(packId);
      if (!def) {
        throw new Error("Unknown reward pack type.");
      }

      // Mark reward pack as opened (no openedAt field in schema)
      await tx.rewardPack.update({
        where: { id: rewardPack.id },
        data: {
          isOpened: true,
        },
      });

      // Log a PackOpen for stats / objectives
      await tx.packOpen.create({
        data: {
          userId: user.id,
          packType: def.id,
        },
      });

      // Generate players
      const chosen = pickPlayersForPack(def.size, def.rarityBias);
      const createdMonsters = [];

      for (const p of chosen) {
        const rolledUnique = maybeRollUniqueEdition(def.uniqueEditionChance);
        const rolledLimited = maybeRollLimitedEdition(def.limitedEditionChance);

        let editionType: "BASE" | "THEMED" | "LIMITED" = "BASE";
        let serialNumber: number | null = null;
        let editionLabel: string | null = null;
        const setCode = "BASE";

        if (rolledUnique) {
          // UNIQUE 1-of-1 per templateCode+rarity
          const existingUniqueCount = await tx.userMonster.count({
            where: {
              templateCode: String(p.code),
              editionType: "LIMITED",
              rarity: p.rarity,
              editionLabel: "1 of 1",
            },
          });

          if (existingUniqueCount === 0) {
            editionType = "LIMITED";
            serialNumber = 1;
            editionLabel = "1 of 1";
          }
          // If 1-of-1 already exists, we fall through to the 1-of-10 logic.
        }

        if (!editionLabel && rolledLimited) {
          // GOLDEN 1-of-10 per templateCode+rarity (ignoring the 1-of-1)
          const existingLECount = await tx.userMonster.count({
            where: {
              templateCode: String(p.code),
              editionType: "LIMITED",
              rarity: p.rarity,
              NOT: {
                editionLabel: "1 of 1",
              },
            },
          });

          if (existingLECount < 10) {
            editionType = "LIMITED";
            serialNumber = existingLECount + 1;
            editionLabel = `${serialNumber} of 10`;
          }
        }

        const artBasePath = buildBaseArtPath(p);

        const created = await tx.userMonster.create({
          data: {
            userId: user.id,
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
            actorUserId: user.id,
            action: "CREATED",
            description: `Reward pack: ${def.name} (${def.id})${
              created.editionType === "LIMITED" && created.editionLabel
                ? ` [Limited Edition ${created.editionLabel}]`
                : ""
            }`,
          },
        });

        createdMonsters.push(created);
      }

      // Count as "OPEN_PACKS_ANY" for objectives too:
      await recordObjectiveProgress({
        prisma: tx,
        userId: user.id,
        type: "OPEN_PACKS_ANY",
        amount: 1,
      });

      const freshUser = await tx.user.findUnique({
        where: { id: user.id },
        select: { coins: true },
      });

      return {
        coinsAfter: freshUser?.coins ?? user.coins,
        packType: def.id,
        monsters: createdMonsters,
      };
    });

    return NextResponse.json({
      message: "Reward pack opened",
      packType: result.packType,
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
    console.error("Error opening reward pack:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to open reward pack." },
      { status: 400 }
    );
  }
}
