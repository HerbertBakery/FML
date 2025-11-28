// lib/objectives/updateObjectives.ts

import { prisma } from "@/lib/db";
import { ObjectiveEvent, ObjectiveEventType } from "./types";

// Map runtime events -> objective requirement codes
const requirementMap: Record<ObjectiveEventType, string[]> = {
  OPEN_PACK: ["OPEN_PACKS_ANY"],
  SUBMIT_FANTASY_SQUAD: ["SUBMIT_FANTASY_SQUAD"],
  FANTASY_POINTS_EARNED: ["EARN_FANTASY_POINTS"],
  BATTLE_PLAYED: ["PLAY_BATTLES"],
  BATTLE_WON: ["WIN_BATTLES"],
  MONSTER_EVOLVED: ["EVOLVE_MONSTERS"],
  MARKET_BUY: ["USE_MARKETPLACE_BUY"],
  MARKET_SELL: ["USE_MARKETPLACE_SELL"],
};

function parseCoinReward(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return 0;
  return Math.floor(n);
}

async function grantObjectiveReward(userId: string, objectiveId: string) {
  const objective = await prisma.objectiveTemplate.findUnique({
    where: { id: objectiveId },
  });
  if (!objective) return;

  const { rewardType, rewardValue } = objective;

  if (rewardType === "coins") {
    const coins = parseCoinReward(rewardValue);
    if (coins > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: coins } },
      });
    }
  } else if (rewardType === "pack") {
    if (rewardValue) {
      await prisma.rewardPack.create({
        data: {
          userId,
          packId: rewardValue,
          sourceType: "objective",
          sourceRef: objective.code,
        },
      });
    }
  } else {
    // "special" or anything else -> you can handle later
  }
}

async function grantObjectiveSetReward(userId: string, setId: string) {
  const set = await prisma.objectiveSet.findUnique({
    where: { id: setId },
  });
  if (!set) return;

  const { rewardType, rewardValue } = set;

  if (rewardType === "coins") {
    const coins = parseCoinReward(rewardValue);
    if (coins > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: { coins: { increment: coins } },
      });
    }
  } else if (rewardType === "pack") {
    if (rewardValue) {
      await prisma.rewardPack.create({
        data: {
          userId,
          packId: rewardValue,
          sourceType: "objective_set",
          sourceRef: set.code,
        },
      });
    }
  } else {
    // "special" or other
  }
}

// Recompute which sets are fully completed for a user and pay rewards
async function recomputeObjectiveSetsForUser(userId: string) {
  const sets = await prisma.objectiveSet.findMany({
    where: { isActive: true },
    include: {
      objectives: true, // ObjectiveSetObjective
    },
  });

  if (!sets.length) return;

  const userSetProgress = await prisma.userObjectiveSetProgress.findMany({
    where: { userId },
  });
  const userSetProgressBySetId = new Map(
    userSetProgress.map((p) => [p.objectiveSetId, p]),
  );

  for (const set of sets) {
    const objectiveIds = set.objectives.map((o) => o.objectiveId);
    if (!objectiveIds.length) continue;

    const completedCount = await prisma.objectiveProgress.count({
      where: {
        userId,
        objectiveId: { in: objectiveIds },
        isCompleted: true,
      },
    });

    const allCompleted = completedCount === objectiveIds.length;
    if (!allCompleted) continue;

    const existing = userSetProgressBySetId.get(set.id);

    if (existing && existing.isCompleted && existing.rewardClaimed) {
      continue;
    }

    // Mark set as completed and grant reward if not already claimed
    const updated = await prisma.userObjectiveSetProgress.upsert({
      where: {
        userId_objectiveSetId: {
          userId,
          objectiveSetId: set.id,
        },
      },
      create: {
        userId,
        objectiveSetId: set.id,
        isCompleted: true,
        completedAt: new Date(),
        rewardClaimed: false,
      },
      update: {
        isCompleted: true,
        completedAt: existing?.completedAt ?? new Date(),
      },
    });

    userSetProgressBySetId.set(set.id, updated);

    if (!existing || !existing.rewardClaimed) {
      await grantObjectiveSetReward(userId, set.id);
      await prisma.userObjectiveSetProgress.update({
        where: { id: updated.id },
        data: { rewardClaimed: true },
      });
    }
  }
}

export async function applyObjectiveEvents(
  userId: string,
  events: ObjectiveEvent[],
) {
  if (!events.length) return;

  const requirementTypes = [
    ...new Set(
      events.flatMap((e) => requirementMap[e.type] ?? []),
    ),
  ];
  if (!requirementTypes.length) return;

  const objectives = await prisma.objectiveTemplate.findMany({
    where: {
      isActive: true,
      type: { in: requirementTypes },
    },
  });
  if (!objectives.length) return;

  // Preload existing progress
  const progress = await prisma.objectiveProgress.findMany({
    where: {
      userId,
      objectiveId: { in: objectives.map((o) => o.id) },
    },
  });

  const progressByObjectiveId = new Map(
    progress.map((p) => [p.objectiveId, p]),
  );

  // Process events sequentially (simple & safe)
  for (const event of events) {
    const reqTypes = requirementMap[event.type] ?? [];
    if (!reqTypes.length) continue;

    const amount = event.amount ?? 1;

    // Filter objectives that care about this event
    const relevantObjectives = objectives.filter((o) =>
      reqTypes.includes(o.type),
    );

    for (const obj of relevantObjectives) {
      const existing = progressByObjectiveId.get(obj.id);
      const current = existing?.currentValue ?? 0;

      if (existing?.isCompleted) {
        // Already fully done
        continue;
      }

      const newValue = Math.min(
        current + amount,
        obj.targetValue,
      );
      const nowCompleted = newValue >= obj.targetValue;

      const updated = await prisma.objectiveProgress.upsert({
        where: {
          userId_objectiveId: {
            userId,
            objectiveId: obj.id,
          },
        },
        create: {
          userId,
          objectiveId: obj.id,
          currentValue: newValue,
          isCompleted: nowCompleted,
          completedAt: nowCompleted ? new Date() : null,
          rewardClaimed: false,
        },
        update: {
          currentValue: newValue,
          isCompleted: nowCompleted,
          completedAt: nowCompleted
            ? existing?.completedAt ?? new Date()
            : existing?.completedAt ?? null,
          lastUpdatedAt: new Date(),
        },
      });

      progressByObjectiveId.set(obj.id, updated);

      // If newly completed and reward not claimed, grant it
      if (
        nowCompleted &&
        !(existing?.rewardClaimed)
      ) {
        await grantObjectiveReward(userId, obj.id);
        await prisma.objectiveProgress.update({
          where: { id: updated.id },
          data: { rewardClaimed: true },
        });
      }
    }
  }

  // After updating individual objectives, re-evaluate sets
  await recomputeObjectiveSetsForUser(userId);
}
