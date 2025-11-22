// app/api/packs/open/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  MONSTER_TEMPLATES,
  MonsterTemplate,
  Rarity
} from "@/lib/monsters";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type PackType = "STARTER";

type UserMonsterDTO = {
  id: string;
  templateCode: string;
  displayName: string;
  realPlayerName: string;
  position: string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
};

type OpenPackResponse = {
  packType: PackType;
  monsters: UserMonsterDTO[];
};

const STARTER_RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: "COMMON", weight: 60 },
  { rarity: "RARE", weight: 30 },
  { rarity: "EPIC", weight: 9 },
  { rarity: "LEGENDARY", weight: 1 }
];

function pickRarity(): Rarity {
  const total = STARTER_RARITY_WEIGHTS.reduce(
    (sum, r) => sum + r.weight,
    0
  );
  const roll = Math.random() * total;
  let acc = 0;
  for (const entry of STARTER_RARITY_WEIGHTS) {
    acc += entry.weight;
    if (roll <= acc) return entry.rarity;
  }
  return "COMMON";
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function generatePackTemplates(count: number): MonsterTemplate[] {
  const results: MonsterTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const rarity = pickRarity();
    const candidates = MONSTER_TEMPLATES.filter(
      (t) => t.rarity === rarity
    );
    const pool = candidates.length ? candidates : MONSTER_TEMPLATES;
    const chosen = pool[randomInt(pool.length)];
    results.push(chosen);
  }
  return results;
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  let packType: PackType = "STARTER";

  try {
    const body = await req.json().catch(() => null);
    if (body && body.packType === "STARTER") {
      packType = "STARTER";
    }
  } catch {
    // ignore
  }

  // Enforce starter pack limit server-side
  if (packType === "STARTER") {
    const starterCount = await prisma.packOpen.count({
      where: { userId: user.id, packType: "STARTER" }
    });

    const maxStarterPacks = 2;
    if (starterCount >= maxStarterPacks) {
      return NextResponse.json(
        { error: "No starter packs remaining." },
        { status: 400 }
      );
    }
  }

  await prisma.packOpen.create({
    data: {
      userId: user.id,
      packType
    }
  });

  const templates = generatePackTemplates(6);
  const created: UserMonsterDTO[] = [];

  for (const tmpl of templates) {
    const monster = await prisma.userMonster.create({
      data: {
        userId: user.id,
        templateCode: tmpl.code,
        displayName: tmpl.displayName,
        realPlayerName: tmpl.realPlayerName,
        position: tmpl.position,
        club: tmpl.club,
        rarity: tmpl.rarity,
        baseAttack: tmpl.baseAttack,
        baseMagic: tmpl.baseMagic,
        baseDefense: tmpl.baseDefense
      }
    });

    created.push({
      id: monster.id,
      templateCode: monster.templateCode,
      displayName: monster.displayName,
      realPlayerName: monster.realPlayerName,
      position: monster.position,
      club: monster.club,
      rarity: monster.rarity,
      baseAttack: monster.baseAttack,
      baseMagic: monster.baseMagic,
      baseDefense: monster.baseDefense
    });
  }

  const response: OpenPackResponse = {
    packType,
    monsters: created
  };

  return NextResponse.json(response);
}
