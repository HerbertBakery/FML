// app/api/admin/chips/grant/route.ts
//
// POST /api/admin/chips/grant
// Body: { userId: string, chipCode: string, count?: number }
//
// Gives `count` copies of the chip (by ChipTemplate.code) to the specified user.
// Used for testing / rewards / shop, etc.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminSecret } from "@/lib/adminAuth";
import { grantChipsToUser } from "@/lib/chips";

export const runtime = "nodejs";

type Body = {
  userId?: string;
  chipCode?: string;
  count?: number;
};

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const { userId, chipCode, count } = body;

    if (!userId || !chipCode) {
      return NextResponse.json(
        { error: "userId and chipCode are required." },
        { status: 400 }
      );
    }

    const n = !count || count < 1 ? 1 : Math.min(count, 50); // hard cap for sanity

    // Use the shared helper so remainingTries respects template.maxTries
    const created = await grantChipsToUser({
      userId,
      chipCode,
      count: n,
    });

    return NextResponse.json({
      message: `Granted ${n} '${chipCode}' chip(s) to user.`,
      userId,
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
