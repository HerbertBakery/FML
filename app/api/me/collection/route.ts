// app/api/me/collection/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

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
  evolutionLevel: number;
};

type CollectionResponse = {
  monsters: UserMonsterDTO[];
  starterPacksOpened: number;
};

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const [monsters, starterPacksOpened] = await Promise.all([
    prisma.userMonster.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.packOpen.count({
      where: {
        userId: user.id,
        // IMPORTANT: must match what PackOpen stores:
        // def.id === "starter"
        packType: "starter",
      },
    }),
  ]);

  const result: CollectionResponse = {
    monsters: monsters.map((m) => ({
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
    })),
    starterPacksOpened,
  };

  return NextResponse.json(result);
}
