// app/api/admin/challenges/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

async function requireUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    throw new Error("NOT_AUTH");
  }
  return user;
}

// GET /api/admin/challenges/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireUser(req);
    const { id } = params;

    const template =
      await prisma.squadChallengeTemplate.findUnique({
        where: { id },
      });

    if (!template) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ challenge: template });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("Admin GET challenge error:", err);
    return NextResponse.json(
      { error: "Failed to fetch challenge." },
      { status: 500 }
    );
  }
}

type UpdateBody = {
  code?: string;
  name?: string;
  description?: string;
  minMonsters?: number;
  minRarity?: string | null;
  requiredRarity?: string | null;
  requiredPosition?: string | null;
  requiredClub?: string | null;
  rewardType?: string;
  rewardValue?: string;
  isRepeatable?: boolean;
  isActive?: boolean;
};

// PUT /api/admin/challenges/:id
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireUser(req);
    const { id } = params;

    let body: UpdateBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const existing =
      await prisma.squadChallengeTemplate.findUnique({
        where: { id },
      });

    if (!existing) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 }
      );
    }

    const updateData: any = {};

    if (body.code !== undefined) {
      updateData.code = body.code.trim();
    }
    if (body.name !== undefined) {
      updateData.name = body.name.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description.trim();
    }
    if (body.minMonsters !== undefined) {
      const mm = Number(body.minMonsters);
      updateData.minMonsters = mm > 0 ? mm : 1;
    }
    if (body.minRarity !== undefined) {
      updateData.minRarity = body.minRarity || null;
    }
    if (body.requiredRarity !== undefined) {
      updateData.requiredRarity = body.requiredRarity || null;
    }
    if (body.requiredPosition !== undefined) {
      updateData.requiredPosition =
        body.requiredPosition || null;
    }
    if (body.requiredClub !== undefined) {
      updateData.requiredClub = body.requiredClub || null;
    }
    if (body.rewardType !== undefined) {
      updateData.rewardType = body.rewardType.trim();
    }
    if (body.rewardValue !== undefined) {
      updateData.rewardValue = body.rewardValue.trim();
    }
    if (body.isRepeatable !== undefined) {
      updateData.isRepeatable = body.isRepeatable;
    }
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    const updated =
      await prisma.squadChallengeTemplate.update({
        where: { id },
        data: updateData,
      });

    return NextResponse.json({ challenge: updated });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("Admin PUT challenge error:", err);

    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A challenge with this code already exists." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update challenge." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/challenges/:id
// Soft-delete: set isActive = false (keeps history + submissions)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireUser(req);
    const { id } = params;

    const existing =
      await prisma.squadChallengeTemplate.findUnique({
        where: { id },
      });

    if (!existing) {
      return NextResponse.json(
        { error: "Challenge not found." },
        { status: 404 }
      );
    }

    const updated =
      await prisma.squadChallengeTemplate.update({
        where: { id },
        data: { isActive: false },
      });

    return NextResponse.json({
      ok: true,
      challenge: updated,
    });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("Admin DELETE challenge error:", err);
    return NextResponse.json(
      { error: "Failed to deactivate challenge." },
      { status: 500 }
    );
  }
}
