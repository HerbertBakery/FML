// app/api/admin/chips/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

async function requireUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    throw new Error("NOT_AUTH");
  }
  return user;
}

// GET /api/admin/chips/:id  -> load a single chip template
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    await requireUser(req);
    const { id } = params;

    const chip = await prisma.chipTemplate.findUnique({
      where: { id },
    });

    if (!chip) {
      return NextResponse.json(
        { error: "Chip not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ chip });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("Error loading chip:", err);
    return NextResponse.json(
      { error: "Failed to load chip." },
      { status: 500 }
    );
  }
}

// PUT /api/admin/chips/:id  -> update a chip template
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    await requireUser(req);
    const { id } = params;
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
      isActive,
      maxTries,
    } = body || {};

    // basic validation
    if (!code || !name || !conditionType) {
      return NextResponse.json(
        { error: "code, name and conditionType are required." },
        { status: 400 }
      );
    }

    let safeMaxTries: number | undefined;
    if (typeof maxTries === "number" && Number.isFinite(maxTries)) {
      if (maxTries >= 1 && maxTries <= 99) {
        safeMaxTries = Math.floor(maxTries);
      }
    }

    const updated = await prisma.chipTemplate.update({
      where: { id },
      data: {
        code,
        name,
        description: description ?? "",
        conditionType,
        minRarity: minRarity || null,
        maxRarity: maxRarity || null,
        allowedPositions: allowedPositions || null,
        // parameterInt is optional & nullable in schema
        parameterInt:
          typeof parameterInt === "number" ? parameterInt : null,
        isActive: typeof isActive === "boolean" ? isActive : true,
        ...(safeMaxTries !== undefined ? { maxTries: safeMaxTries } : {}),
      },
    });

    return NextResponse.json({ chip: updated });
  } catch (err: any) {
    if (err?.code === "P2002") {
      // unique constraint (e.g. duplicate code)
      return NextResponse.json(
        { error: "A chip with that code already exists." },
        { status: 400 }
      );
    }
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("Error updating chip:", err);
    return NextResponse.json(
      { error: "Failed to update chip." },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/chips/:id  -> soft-deactivate (keep history)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    await requireUser(req);
    const { id } = params;

    const chip = await prisma.chipTemplate.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({ ok: true, chip });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("Error deactivating chip:", err);
    return NextResponse.json(
      { error: "Failed to deactivate chip." },
      { status: 500 }
    );
  }
}
