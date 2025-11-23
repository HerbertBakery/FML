// app/api/challenges/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// GET /api/challenges/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const { id } = params;

  try {
    const t = await prisma.squadChallengeTemplate.findUnique({
      where: { id },
      include: {
        submissions: {
          where: { userId: user.id },
          select: { id: true, completedAt: true, createdAt: true }
        }
      }
    });

    if (!t || !t.isActive) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 }
      );
    }

    const completedCount = t.submissions.filter(
      (s) => s.completedAt !== null
    ).length;

    return NextResponse.json({
      challenge: {
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
        isActive: t.isActive,
        createdAt: t.createdAt,
        completedCount
      }
    });
  } catch (err) {
    console.error("Error fetching challenge:", err);
    return NextResponse.json(
      { error: "Failed to load challenge." },
      { status: 500 }
    );
  }
}
