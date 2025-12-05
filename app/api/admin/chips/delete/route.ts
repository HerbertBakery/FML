// app/api/admin/chips/delete/route.ts
//
// POST /api/admin/chips/delete
// Deletes a chip template by id (hard delete).
// If the chip is referenced by user chips or assignments, an error will be thrown.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // OPTIONAL: admin check later
    // if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Chip template id is required." },
        { status: 400 }
      );
    }

    // Confirm chip exists
    const template = await prisma.chipTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Chip template not found." },
        { status: 404 }
      );
    }

    // Check if chip is currently in use — avoid foreign key explosions
    const usedCount = await prisma.userChip.count({
      where: { templateId: id },
    });

    if (usedCount > 0) {
      return NextResponse.json(
        {
          error:
            "This chip is already owned by players and cannot be deleted. Consider setting isActive = false.",
        },
        { status: 400 }
      );
    }

    await prisma.chipTemplate.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Chip template deleted.",
      id,
    });
  } catch (err: any) {
    console.error("Error deleting chip template:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to delete chip template." },
      { status: 500 }
    );
  }
}
