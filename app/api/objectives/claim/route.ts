// app/api/objectives/claim/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { syncObjectivesForUserSeason1 } from "@/lib/objectives/syncSeason1";

export const runtime = "nodejs";

type Body = {
  objectiveId?: string;
  objectiveCode?: string;
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

  const { objectiveId, objectiveCode } = body;
  if (!objectiveId && !objectiveCode) {
    return NextResponse.json(
      { error: "objectiveId or objectiveCode is required." },
      { status: 400 }
    );
  }

  try {
    // 🔥 Make sure objective progress is up-to-date before claiming
    await syncObjectivesForUserSeason1(user.id);

    const result = await prisma.$transaction(async (tx) => {
      // Resolve objective by id or code
      const objective = objectiveId
        ? await tx.objectiveTemplate.findUnique({
            where: { id: objectiveId },
          })
        : await tx.objectiveTemplate.findUnique({
            where: { code: objectiveCode! },
          });

      if (!objective) {
        throw new Error("Objective not found.");
      }

      const progress = await tx.objectiveProgress.findUnique({
        where: {
          userId_objectiveId: {
            userId: user.id,
            objectiveId: objective.id,
          },
        },
      });

      if (!progress || !progress.completedAt) {
        throw new Error("Objective not completed yet.");
      }

      if (progress.rewardClaimedAt) {
        throw new Error("Reward already claimed.");
      }

      // Grant reward based on objective.rewardType / rewardValue
      let coinsDelta = 0;
      let createdRewardPackId: string | null = null;

      if (objective.rewardType === "coins") {
        const coins = parseInt(objective.rewardValue || "0", 10);
        if (!Number.isNaN(coins) && coins > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: {
              coins: { increment: coins },
            },
          });
          coinsDelta = coins;
        }
      } else if (objective.rewardType === "pack") {
        if (objective.rewardValue) {
          const pack = await tx.rewardPack.create({
            data: {
              userId: user.id,
              packId: objective.rewardValue, // e.g. "starter", "silver", "gold"
              sourceType: "objective",
              sourceRef: objective.code,
            },
          });
          createdRewardPackId = pack.id;
        }
      } else {
        // "special" or unknown → no-op for now
      }

      // Mark as claimed
      await tx.objectiveProgress.update({
        where: {
          userId_objectiveId: {
            userId: user.id,
            objectiveId: objective.id,
          },
        },
        data: {
          rewardClaimedAt: new Date(),
        },
      });

      return {
        objectiveId: objective.id,
        objectiveCode: objective.code,
        rewardType: objective.rewardType,
        rewardValue: objective.rewardValue,
        coinsDelta,
        createdRewardPackId,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Error claiming objective reward:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to claim reward." },
      { status: 400 }
    );
  }
}
