// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  const res = NextResponse.json({ ok: true });

  // Clear the cookie
  res.cookies.set("fml_session", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });

  return res;
}
