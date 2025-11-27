// app/api/me/collection/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Only return active (not consumed) monsters
  const monsters = await prisma.userMonster.findMany({
    where: {
      userId: user.id,
      isConsumed: false,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Count how many starter packs were opened (optional, matches your HomePage)
  const starterPacksOpened = await prisma.packOpen.count({
    where: {
      userId: user.id,
      packType: "starter",
    },
  });

  const result = monsters.map((m) => ({
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

    // NEW: edition + art fields, mirroring what Prisma has
    setCode: m.setCode ?? null,
    editionType: m.editionType ?? null,
    serialNumber: m.serialNumber ?? null,
    editionLabel: m.editionLabel ?? null,
    artBasePath: m.artBasePath ?? null,
  }));

  return NextResponse.json({
    monsters: result,
    starterPacksOpened,
  });
}
