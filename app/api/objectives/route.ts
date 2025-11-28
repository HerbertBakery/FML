// app/api/objectives/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { syncObjectivesForUserSeason1 } from "@/lib/objectives/syncSeason1";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    // 🔄 Ensure Season 1 objectives are in sync with current DB state
    await syncObjectivesForUserSeason1(user.id);

    const [templates, progresses, sets, setProgresses] =
      await Promise.all([
        prisma.objectiveTemplate.findMany({
          where: { isActive: true },
          orderBy: [
            { category: "asc" },
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        }),
        prisma.objectiveProgress.findMany({
          where: { userId: user.id },
        }),
        prisma.objectiveSet.findMany({
          where: { isActive: true },
          include: {
            objectives: {
              include: {
                objective: true,
              },
            },
          },
          orderBy: [
            { sortOrder: "asc" },
            { createdAt: "asc" },
          ],
        }),
        prisma.userObjectiveSetProgress.findMany({
          where: { userId: user.id },
        }),
      ]);

    const progressMap = new Map(
      progresses.map((p) => [
        p.objectiveId,
        {
          currentValue: p.currentValue,
          completedAt: p.completedAt,
          // If you've added rewardClaimedAt in Prisma, this will be present:
          // @ts-ignore – depends on your schema
          rewardClaimedAt: (p as any).rewardClaimedAt ?? null,
        },
      ])
    );

    const setProgressMap = new Map(
      setProgresses.map((sp) => [
        sp.objectiveSetId,
        {
          isCompleted: sp.isCompleted,
          completedAt: sp.completedAt,
          // @ts-ignore – depends on your schema
          rewardClaimedAt: (sp as any).rewardClaimedAt ?? null,
        },
      ])
    );

    const objectiveDTOs = templates.map((t) => {
      const p = progressMap.get(t.id);
      return {
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        category: t.category,
        seasonCode: t.seasonCode,
        period: t.period,
        type: t.type,
        sortOrder: t.sortOrder,
        targetValue: t.targetValue,
        rewardType: t.rewardType,
        rewardValue: t.rewardValue,
        currentValue: p?.currentValue ?? 0,
        completedAt: p?.completedAt ?? null,
        rewardClaimedAt: p?.rewardClaimedAt ?? null,
      };
    });

    const objectiveById = new Map(
      objectiveDTOs.map((o) => [o.id, o])
    );

    const setDTOs = sets.map((s) => {
      const sp = setProgressMap.get(s.id);
      const setObjectives = s.objectives
        .map((link) => objectiveById.get(link.objectiveId))
        .filter(Boolean);

      return {
        id: s.id,
        code: s.code,
        title: s.title,
        description: s.description,
        seasonCode: s.seasonCode,
        sortOrder: s.sortOrder,
        rewardType: s.rewardType,
        rewardValue: s.rewardValue,
        isActive: s.isActive,
        isCompleted: sp?.isCompleted ?? false,
        completedAt: sp?.completedAt ?? null,
        rewardClaimedAt: sp?.rewardClaimedAt ?? null,
        objectives: setObjectives,
      };
    });

    return NextResponse.json({
      objectives: objectiveDTOs,
      sets: setDTOs,
    });
  } catch (err: any) {
    console.error("Error loading objectives:", err);
    return NextResponse.json(
      { error: "Failed to load objectives." },
      { status: 500 }
    );
  }
}
