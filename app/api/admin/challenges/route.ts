// app/api/admin/challenges/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// TODO: tighten this to real admin-only if you want
async function requireUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    throw new Error("NOT_AUTH");
  }
  return user;
}

// GET /api/admin/challenges
// Returns all SBC templates (active + inactive)
export async function GET(req: NextRequest) {
  try {
    await requireUser(req);

    const templates =
      await prisma.squadChallengeTemplate.findMany({
        orderBy: { createdAt: "desc" },
      });

    return NextResponse.json({ challenges: templates });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("Admin GET challenges error:", err);
    return NextResponse.json(
      { error: "Failed to fetch challenges." },
      { status: 500 }
    );
  }
}

type CreateBody = {
  code?: string;
  name?: string;
  description?: string;
  minMonsters?: number;
  minRarity?: string | null;
  requiredPosition?: string | null;
  requiredClub?: string | null;
  rewardType?: string;
  rewardValue?: string;
  isRepeatable?: boolean;
  isActive?: boolean;
};

// POST /api/admin/challenges
// Creates a new SBC template
export async function POST(req: NextRequest) {
  try {
    await requireUser(req);

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
    const description =
      (body.description || "").trim();
    const rewardType =
      (body.rewardType || "coins").trim();
    const rewardValue =
      (body.rewardValue || "").trim();
    const minMonsters = Number.isFinite(
      body.minMonsters as any
    )
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

    const template =
      await prisma.squadChallengeTemplate.create({
        data: {
          code,
          name,
          description,
          minMonsters: minMonsters > 0
            ? minMonsters
            : 1,
          minRarity: body.minRarity || null,
          requiredPosition:
            body.requiredPosition || null,
          requiredClub: body.requiredClub || null,
          rewardType,
          rewardValue,
          isRepeatable:
            typeof body.isRepeatable === "boolean"
              ? body.isRepeatable
              : true,
          isActive:
            typeof body.isActive === "boolean"
              ? body.isActive
              : true,
        },
      });

    return NextResponse.json({
      challenge: template,
    });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    console.error(
      "Admin POST challenges error:",
      err
    );

    // Handle unique code violation
    if (err?.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "A challenge with this code already exists.",
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
