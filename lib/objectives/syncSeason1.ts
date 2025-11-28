// lib/objectives/syncSeason1.ts
//
// Central place to recalculate objective progress for a user
// based on current DB state (packs opened, collection size, fantasy
// points, market activity, etc.) for SEASON 1.

import { prisma } from "@/lib/db";
import { recomputeObjectiveSetProgress } from "./engine";
import { SEASON_CODE } from "./season1";

export async function syncObjectivesForUserSeason1(
  userId: string
) {
  // 1) Load all active S1 objectives + existing progress for this user
  const [objectives, existingProgress] = await Promise.all([
    prisma.objectiveTemplate.findMany({
      where: {
        isActive: true,
        seasonCode: SEASON_CODE,
      },
    }),
    prisma.objectiveProgress.findMany({
      where: { userId },
    }),
  ]);

  if (objectives.length === 0) {
    return;
  }

  const progressByObjectiveId = new Map(
    existingProgress.map((p) => [p.objectiveId, p])
  );

  // 2) Precompute all the counts we care about for Season 1
  const [
    packOpenCount,
    collectionSize,
    rareOrBetterCount,
    totalFantasyPoints,
    marketBuysCount,
    marketSellsCount,
    distinctGameweeksWithEntry,
  ] = await Promise.all([
    // total packs opened
    prisma.packOpen.count({
      where: { userId },
    }),

    // current collection size (active monsters only)
    prisma.userMonster.count({
      where: {
        userId,
        isConsumed: false,
      },
    }),

    // monsters of rare or better rarity
    prisma.userMonster.count({
      where: {
        userId,
        isConsumed: false,
        rarity: {
          in: ["RARE", "EPIC", "LEGENDARY"],
        },
      },
    }),

    // sum of fantasy points across gameweeks
    prisma.userGameweekScore
      .aggregate({
        where: { userId },
        _sum: {
          points: true,
        },
      })
      .then((agg) => agg._sum.points ?? 0),

    // total marketplace transactions where this user is the buyer
    prisma.marketTransaction.count({
      where: { buyerId: userId },
    }),

    // total marketplace transactions where this user is the seller
    prisma.marketTransaction.count({
      where: { sellerId: userId },
    }),

    // number of distinct gameweeks where the user has an entry
    prisma.gameweekEntry
      .groupBy({
        by: ["gameweekId"],
        where: { userId },
      })
      .then((rows) => rows.length),
  ]);

  // 3) Map from objective.type -> computed value
  const typeToValue: Record<string, number> = {
    OPEN_PACKS_ANY: packOpenCount,
    OWN_MONSTERS_TOTAL: collectionSize,
    OWN_MONSTERS_RARE_OR_BETTER: rareOrBetterCount,
    EARN_FANTASY_POINTS: totalFantasyPoints,
    SUBMIT_FANTASY_SQUAD: distinctGameweeksWithEntry,
    // For MARKET_03: we treat both buy and sell as progress on USE_MARKETPLACE_BUY
    USE_MARKETPLACE_BUY: marketBuysCount + marketSellsCount,
    USE_MARKETPLACE_SELL: marketSellsCount,
  };

  const updates: Promise<any>[] = [];
  const now = new Date();

  // 4) For each objective, update/create progress using the derived value
  for (const obj of objectives) {
    const currentValue =
      typeToValue[obj.type] !== undefined
        ? typeToValue[obj.type]
        : undefined;

    // If we don't know how to compute this type here (e.g. battles),
    // skip it — those are handled via recordObjectiveProgress.
    if (currentValue === undefined) continue;

    const target = obj.targetValue ?? 1;
    const isNowCompleted = currentValue >= target;

    const existing = progressByObjectiveId.get(obj.id);
    if (existing) {
      const alreadyCompleted = !!existing.completedAt;
      const completedAt =
        !alreadyCompleted && isNowCompleted
          ? now
          : existing.completedAt;

      // Only update if something actually changed
      if (
        existing.currentValue !== currentValue ||
        existing.completedAt?.getTime() !==
          completedAt?.getTime()
      ) {
        updates.push(
          prisma.objectiveProgress.update({
            where: { id: existing.id },
            data: {
              currentValue,
              completedAt,
              // Do NOT touch rewardClaimedAt here
            },
          })
        );
      }
    } else {
      // Create fresh progress row
      updates.push(
        prisma.objectiveProgress.create({
          data: {
            userId,
            objectiveId: obj.id,
            currentValue,
            completedAt: isNowCompleted ? now : null,
          },
        })
      );
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  // 5) Recompute set completion flags as well
  await recomputeObjectiveSetProgress({
    prisma,
    userId,
  });
}
