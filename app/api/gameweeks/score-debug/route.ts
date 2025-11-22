// app/api/gameweeks/score-debug/route.ts
// Debug scoring endpoint: assigns fake performance-based points
// to each user's gameweek entry and updates the leaderboard.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateCurrentGameweek } from "@/lib/gameweeks";

export const runtime = "nodejs";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function basePointsForPosition(position: string): number {
  switch (position) {
    case "GK":
      return randomInt(0, 6); // clean sheet / saves vibes
    case "DEF":
      return randomInt(1, 7); // tackles, CS, etc.
    case "MID":
      return randomInt(2, 8); // goals + assists
    case "FWD":
      return randomInt(3, 10); // goals
    default:
      return randomInt(1, 5);
  }
}

function rarityBonus(rarity: string): number {
  const r = rarity.toUpperCase();
  if (r === "LEGENDARY") return randomInt(8, 12);
  if (r === "EPIC") return randomInt(5, 8);
  if (r === "RARE") return randomInt(2, 5);
  return randomInt(0, 2); // COMMON
}

export async function POST(req: NextRequest) {
  // For now: no auth guard so it's easy to trigger in dev.
  // Later, you can restrict this to admin.

  const gw = await getOrCreateCurrentGameweek();

  // Get all entries for this gameweek with monsters + users
  const entries = await prisma.gameweekEntry.findMany({
    where: { gameweekId: gw.id },
    include: {
      user: true,
      monsters: {
        include: {
          userMonster: true
        },
        orderBy: { slot: "asc" }
      }
    }
  });

  if (entries.length === 0) {
    return NextResponse.json(
      { message: "No entries for this gameweek yet." },
      { status: 200 }
    );
  }

  // For each entry, compute a fake score and write to UserGameweekScore
  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      let totalPoints = 0;

      for (const m of entry.monsters) {
        const um = m.userMonster;

        const base = basePointsForPosition(um.position);
        const rarity = rarityBonus(um.rarity || "COMMON");

        // If it's a sub, we can reduce impact slightly
        const subFactor = m.isSub ? 0.5 : 1.0;

        const pointsForThisMonster = Math.round(
          (base + rarity) * subFactor
        );

        totalPoints += pointsForThisMonster;
      }

      // Upsert the user's gameweek score
      await tx.userGameweekScore.upsert({
        where: {
          // composite: userId + gameweekId isn't declared, so we use an artificial unique.
          // We'll find any existing row first:
          id: (
            await tx.userGameweekScore.findFirst({
              where: {
                userId: entry.userId,
                gameweekId: gw.id
              },
              select: { id: true }
            })
          )?.id || `temp-${entry.userId}-${gw.id}` // placeholder
        },
        update: {
          points: totalPoints
        },
        create: {
          userId: entry.userId,
          gameweekId: gw.id,
          points: totalPoints
        }
      });
    }
  });

  return NextResponse.json({
    message:
      "Debug scoring complete. Leaderboard updated for current gameweek.",
    gameweekId: gw.id
  });
}
