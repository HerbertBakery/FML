// app/api/challenges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/challenges
// Returns all active SBC templates plus this user's completion info.
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const templates =
      await prisma.squadChallengeTemplate.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        include: {
          submissions: {
            where: { userId: user.id },
            select: {
              id: true,
              completedAt: true,
              createdAt: true,
            },
          },
        },
      });

    const data = templates.map((t) => {
      const userSubs = t.submissions;
      const completedCount = userSubs.filter(
        (s) => s.completedAt !== null
      ).length;

      const completedOnce = completedCount > 0;
      const canSubmit =
        t.isRepeatable || !completedOnce;

      return {
        id: t.id,
        code: t.code,
        name: t.name,
        description: t.description,
        minMonsters: t.minMonsters,
        minRarity: t.minRarity,
        requiredPosition: t.requiredPosition,
        requiredClub: t.requiredClub,
        rewardType: t.rewardType,
        rewardValue: t.rewardValue,
        isRepeatable: t.isRepeatable,
        isActive: t.isActive,
        createdAt: t.createdAt,
        completedCount,
        canSubmit,
      };
    });

    return NextResponse.json({ challenges: data });
  } catch (err) {
    console.error("Error fetching challenges:", err);
    return NextResponse.json(
      { error: "Failed to load challenges." },
      { status: 500 }
    );
  }
}
