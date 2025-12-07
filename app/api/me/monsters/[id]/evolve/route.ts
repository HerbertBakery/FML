// app/api/me/monsters/[id]/evolve/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/me/monsters/:id/evolve
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const monsterId = params.id;

    const monster = await prisma.userMonster.findFirst({
      where: {
        id: monsterId,
        userId: user.id,
      },
    });

    if (!monster) {
      return NextResponse.json(
        { error: "Monster not found or not owned by you." },
        { status: 404 }
      );
    }

    // We only allow evolution if a pending evolution level exists
    if (
      monster.pendingEvolutionLevel === null ||
      monster.pendingEvolutionLevel === undefined ||
      monster.pendingEvolutionLevel <= monster.evolutionLevel
    ) {
      return NextResponse.json(
        { error: "This monster has no evolution ready to claim." },
        { status: 400 }
      );
    }

    const updated = await prisma.userMonster.update({
      where: { id: monster.id },
      data: {
        evolutionLevel: monster.pendingEvolutionLevel,
        pendingEvolutionLevel: null,
        pendingEvolutionReason: null,
      },
    });

    // Optional: log a history event if you have such a table
    // await prisma.monsterHistoryEvent.create({...})

    return NextResponse.json({
      ok: true,
      monster: {
        id: updated.id,
        evolutionLevel: updated.evolutionLevel,
      },
    });
  } catch (err) {
    console.error("Error evolving monster:", err);
    return NextResponse.json(
      { error: "Failed to evolve monster." },
      { status: 500 }
    );
  }
}
