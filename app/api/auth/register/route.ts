// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!email || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Email and password (min 6 chars) are required." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing && existing.passwordHash) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);

  const user =
    existing && !existing.passwordHash
      ? await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash },
        })
      : await prisma.user.create({
          data: { email, passwordHash },
        });

  const token = createSessionToken({
    userId: user.id,
    email: user.email,
  });

  const isProd = process.env.NODE_ENV === "production";

  const res = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
    },
  });

  res.cookies.set("fml_session", token, {
    httpOnly: true,
    secure: isProd, // ⬅️ only secure in production (so dev on http works)
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
