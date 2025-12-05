// app/api/admin/chips/create/route.ts
//
// POST /api/admin/chips/create
// Creates a new ChipTemplate for your FML evolution system.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Admin password gate only (no user session required)
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const body = await req.json();

    const {
      code,
      name,
      description,
      conditionType,
      minRarity,
      maxRarity,
      allowedPositions,
      parameterInt,
      maxTries,
      isActive,
    } = body || {};

    if (!code || !name || !description || !conditionType) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // Ensure the code is unique
    const existing = await prisma.chipTemplate.findUnique({
      where: { code },
    });
    if (existing) {
      return NextResponse.json(
        { error: `Chip with code "${code}" already exists.` },
        { status: 409 }
      );
    }

    const created = await prisma.chipTemplate.create({
      data: {
        code,
        name,
        description,
        conditionType,
        minRarity: minRarity ?? null,
        maxRarity: maxRarity ?? null,
        allowedPositions: allowedPositions ?? null,
        // optional flex field
        parameterInt:
          typeof parameterInt === "number" ? parameterInt : null,
        // NEW: configurable maxTries for this chip template
        maxTries:
          typeof maxTries === "number" && maxTries > 0 ? maxTries : 2,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });

    return NextResponse.json({
      message: "Chip template created.",
      chip: created,
    });
  } catch (err: any) {
    console.error("Error creating chip template:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create template." },
      { status: 500 }
    );
  }
}
