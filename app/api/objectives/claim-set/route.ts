// app/api/objectives/claim-set/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { syncObjectivesForUserSeason1 } from "@/lib/objectives/syncSeason1";

export const runtime = "nodejs";

type Body = {
  objectiveSetId?: string;
  objectiveSetCode?: string;
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
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400 }
    );
  }

  const { objectiveSetId, objectiveSetCode } = body;
  if (!objectiveSetId && !objectiveSetCode) {
    return NextResponse.json(
      { error: "objectiveSetId or objectiveSetCode is required." },
      { status: 400 }
    );
  }

  try {
    // 🔥 Make sure all objective + set progress is up-to-date before claiming
    await syncObjectivesForUserSeason1(user.id);

    const result = await prisma.$transaction(async (tx) => {
      const set = objectiveSetId
        ? await tx.objectiveSet.findUnique({
            where: { id: objectiveSetId },
          })
        : await tx.objectiveSet.findUnique({
            where: { code: objectiveSetCode! },
          });

      if (!set) {
        throw new Error("Objective set not found.");
      }

      const progress = await tx.userObjectiveSetProgress.findUnique({
        where: {
          userId_objectiveSetId: {
            userId: user.id,
            objectiveSetId: set.id,
          },
        },
      });

      if (!progress || !progress.isCompleted || !progress.completedAt) {
        throw new Error("Set is not completed yet.");
      }

      if (progress.rewardClaimedAt) {
        throw new Error("Set reward already claimed.");
      }

      let coinsDelta = 0;
      let createdRewardPackId: string | null = null;

      if (set.rewardType === "coins") {
        const coins = parseInt(set.rewardValue || "0", 10);
        if (!Number.isNaN(coins) && coins > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              coins: { increment: coins },
            },
          });
          coinsDelta = coins;
        }
      } else if (set.rewardType === "pack") {
        if (set.rewardValue) {
          const pack = await tx.rewardPack.create({
            data: {
              userId: user.id,
              packId: set.rewardValue,
              sourceType: "objective_set",
              sourceRef: set.code,
            },
          });
          createdRewardPackId = pack.id;
        }
      } else {
        // "special" or unknown -> no-op for now
      }

      await tx.userObjectiveSetProgress.update({
        where: {
          userId_objectiveSetId: {
            userId: user.id,
            objectiveSetId: set.id,
          },
        },
        data: {
          rewardClaimedAt: new Date(),
        },
      });

      return {
        objectiveSetId: set.id,
        objectiveSetCode: set.code,
        rewardType: set.rewardType,
        rewardValue: set.rewardValue,
        coinsDelta,
        createdRewardPackId,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error claiming set reward:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to claim set reward." },
      { status: 400 }
    );
  }
}
