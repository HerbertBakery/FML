// lib/objectives/engine.ts
import type { Prisma } from "@prisma/client";

type ObjectiveEnginePrisma = Prisma.TransactionClient | Prisma.PrismaClient;

// Recompute which sets are completed for this user,
// but DO NOT grant rewards here. Rewards are claimed separately.
export async function recomputeObjectiveSetProgress(opts: {
  prisma: ObjectiveEnginePrisma;
  userId: string;
}) {
  const { prisma, userId } = opts;

  const sets = await prisma.objectiveSet.findMany({
    where: { isActive: true },
    include: {
      objectives: {
        include: {
          objective: true,
        },
      },
    },
  });

  for (const set of sets) {
    const objectiveIds = set.objectives.map((o) => o.objectiveId);
    if (objectiveIds.length === 0) continue;

    const progresses = await prisma.objectiveProgress.findMany({
      where: {
        userId,
        objectiveId: { in: objectiveIds },
      },
    });

    const progressMap = new Map(
      progresses.map((p) => [p.objectiveId, p])
    );

    const allCompleted = objectiveIds.every((id) => {
      const p = progressMap.get(id);
      return !!p && p.completedAt !== null;
    });

    const existingSetProgress =
      await prisma.userObjectiveSetProgress.findUnique({
        where: {
          userId_objectiveSetId: {
            userId,
            objectiveSetId: set.id,
          },
        },
      });

    if (allCompleted) {
      // Mark as completed (but don't touch rewardClaimedAt here)
      await prisma.userObjectiveSetProgress.upsert({
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
        },
        update: {
          isCompleted: true,
          completedAt:
            existingSetProgress?.completedAt ?? new Date(),
        },
      });
    } else {
      // Not fully complete yet. Ensure a progress row exists (not completed).
      if (!existingSetProgress) {
        await prisma.userObjectiveSetProgress.create({
          data: {
            userId,
            objectiveSetId: set.id,
            isCompleted: false,
          },
        });
      } else if (existingSetProgress.isCompleted) {
        // If objectives changed and the set wouldn't be complete anymore,
        // we currently KEEP it completed.
      }
    }
  }
}

// Main entry: increment progress for all objectives of a given type.
// NO rewards are granted here; they just become "claimable".
export async function recordObjectiveProgress(opts: {
  prisma: ObjectiveEnginePrisma;
  userId: string;
  type: string; // must match ObjectiveTemplate.type, e.g. "OPEN_PACKS_ANY"
  amount?: number; // default 1
}) {
  const { prisma, userId, type } = opts;
  const amount = opts.amount ?? 1;
  if (amount <= 0) return;

  const objectives = await prisma.objectiveTemplate.findMany({
    where: {
      type,
      isActive: true,
    },
  });

  if (objectives.length === 0) {
    return;
  }

  for (const obj of objectives) {
    const existing =
      await prisma.objectiveProgress.findUnique({
        where: {
          userId_objectiveId: {
            userId,
            objectiveId: obj.id,
          },
        },
      });

    // If already completed, just keep it completed. Reward is claimed separately.
    if (existing?.completedAt) continue;

    const current = existing?.currentValue ?? 0;
    const newValue = Math.min(
      obj.targetValue,
      current + amount
    );
    const justCompleted =
      newValue >= obj.targetValue && !existing?.completedAt;

    await prisma.objectiveProgress.upsert({
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
        completedAt: justCompleted ? new Date() : null,
      },
      update: {
        currentValue: newValue,
        completedAt: justCompleted
          ? new Date()
          : existing?.completedAt ?? null,
        lastUpdatedAt: new Date(),
      },
    });
  }

  // After updating all relevant objectives, recompute set completion.
  await recomputeObjectiveSetProgress({ prisma, userId });
}
