// app/api/admin/chips/list/route.ts
//
// GET /api/admin/chips/list
// Returns all ChipTemplate rows for admin management.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
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

    // 👇 OPTIONAL: Add isAdmin field check later
    // if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const templates = await prisma.chipTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates });
  } catch (err: any) {
    console.error("Error listing chip templates:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to load chip templates." },
      { status: 500 }
    );
  }
}
