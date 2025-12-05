// app/api/admin/chips/index/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

// GET /api/admin/chips/index
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    await getUserFromRequest(req); // keep your existing auth
    const chips = await prisma.chipTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ chips });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.error("Error loading chips:", err);
    return NextResponse.json(
      { error: "Failed to load chips." },
      { status: 500 }
    );
  }
}
