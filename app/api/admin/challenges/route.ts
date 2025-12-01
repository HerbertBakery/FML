// app/api/admin/challenges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

type CreateBody = {
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

// GET /api/admin/challenges
// Returns all SBC templates (active + inactive)
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const templates = await prisma.squadChallengeTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ challenges: templates });
  } catch (err: any) {
    console.error("Admin GET challenges error:", err);
    return NextResponse.json(
      { error: "Failed to fetch challenges." },
      { status: 500 }
    );
  }
}

// POST /api/admin/challenges
// Creates a new SBC template
export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    let body: CreateBody = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const code = (body.code || "").trim();
    const name = (body.name || "").trim();
    const description = (body.description || "").trim();
    const rewardType = (body.rewardType || "coins").trim();
    const rewardValue = (body.rewardValue || "").trim();
    const minMonsters = Number.isFinite(body.minMonsters as any)
      ? Number(body.minMonsters)
      : 3;

    if (!code || !name || !rewardType || !rewardValue) {
      return NextResponse.json(
        {
          error:
            "code, name, rewardType, and rewardValue are required.",
        },
        { status: 400 }
      );
    }

    const template = await prisma.squadChallengeTemplate.create({
      data: {
        code,
        name,
        description,
        minMonsters: minMonsters > 0 ? minMonsters : 1,
        minRarity: body.minRarity || null,
        requiredRarity: body.requiredRarity || null,
        requiredPosition: body.requiredPosition || null,
        requiredClub: body.requiredClub || null,
        rewardType,
        rewardValue,
        isRepeatable:
          typeof body.isRepeatable === "boolean" ? body.isRepeatable : true,
        isActive:
          typeof body.isActive === "boolean" ? body.isActive : true,
      },
    });

    return NextResponse.json({
      challenge: template,
    });
  } catch (err: any) {
    console.error("Admin POST challenges error:", err);

    if (err?.code === "P2002") {
      return NextResponse.json(
        {
          error: "A challenge with this code already exists.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create challenge." },
      { status: 500 }
    );
  }
}
