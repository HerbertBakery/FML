// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hash } from "bcryptjs";
import { createSessionToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    password?: string;
    username?: string;
  } = {};

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
  const usernameRaw = (body.username || "").trim();

  if (!email || !password || password.length < 6 || !usernameRaw) {
    return NextResponse.json(
      {
        error:
          "Email, username, and password (min 6 chars) are required.",
      },
      { status: 400 }
    );
  }

  // Simple username rules: 3–20 chars, letters/numbers/underscore
  const username = usernameRaw.toLowerCase();
  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    return NextResponse.json(
      {
        error:
          "Username must be 3–20 characters and use only letters, numbers, and underscores.",
      },
      { status: 400 }
    );
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  const existingByUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (
    existingByUsername &&
    (!existingByEmail ||
      existingByUsername.id !== existingByEmail.id)
  ) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 400 }
    );
  }

  if (existingByEmail && existingByEmail.passwordHash) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 400 }
    );
  }

  const passwordHash = await hash(password, 10);

  const user =
    existingByEmail && !existingByEmail.passwordHash
      ? await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            passwordHash,
            username:
              existingByEmail.username ?? username,
          },
        })
      : await prisma.user.create({
          data: { email, passwordHash, username },
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
      username: user.username,
    },
  });

  res.cookies.set("fml_session", token, {
    httpOnly: true,
    secure: isProd, // only secure in production
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
