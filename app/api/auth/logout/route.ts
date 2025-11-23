// app/api/auth/logout/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function makeLogoutResponse() {
  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ success: true });

  res.cookies.set("fml_session", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return res;
}

export async function POST(_req: NextRequest) {
  return makeLogoutResponse();
}

export async function GET(_req: NextRequest) {
  return makeLogoutResponse();
}
