// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);

  if (!user) {
    return NextResponse.json(
      { user: null },
      { status: 401 }
    );
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      coins: user.coins
    }
  });
}
