// app/api/admin/chips/grant/route.ts
//
// POST /api/admin/chips/grant
// Body: { userId: string, chipCode: string, count?: number }
//
// Gives `count` copies of the chip (by ChipTemplate.code) to the specified user.
// Used for testing / rewards / shop, etc.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  chipCode?: string;
  count?: number;
};

export async function POST(req: NextRequest) {
  try {
    const caller = await getUserFromRequest(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const { userId, chipCode, count } = body;

    if (!userId || !chipCode) {
      return NextResponse.json(
        { error: "userId and chipCode are required." },
        { status: 400 }
      );
    }

    const n = !count || count < 1 ? 1 : Math.min(count, 50); // hard cap for sanity

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { error: "Target user not found." },
        { status: 404 }
      );
    }

    const template = await prisma.chipTemplate.findUnique({
      where: { code: chipCode },
    });

    if (!template) {
      return NextResponse.json(
        { error: `Chip template with code '${chipCode}' not found.` },
        { status: 404 }
      );
    }

    const created = [];
    for (let i = 0; i < n; i++) {
      const chip = await prisma.userChip.create({
        data: {
          userId: user.id,
          templateId: template.id,
        },
      });
      created.push(chip);
    }

    return NextResponse.json({
      message: `Granted ${n} '${chipCode}' chip(s) to user.`,
      userId: user.id,
      chipCode,
      chips: created,
    });
  } catch (err: any) {
    console.error("Error granting chips:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to grant chips." },
      { status: 500 }
    );
  }
}
