// lib/auth.ts
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "./db";

const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";

type SessionPayload = {
  userId: string;
  email: string;
};

export function createSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, AUTH_SECRET, {
    expiresIn: "30d",
  });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as SessionPayload;
    if (!decoded || typeof decoded.userId !== "string") return null;
    return decoded;
  } catch {
    return null;
  }
}

// Note: we keep the NextRequest argument for compatibility,
// but we no longer use req.cookies – we use cookies() instead.
export async function getUserFromRequest(_req?: NextRequest) {
  const cookieStore = cookies();
  const cookie = cookieStore.get("fml_session");
  if (!cookie?.value) {
    return null;
  }

  const payload = verifySessionToken(cookie.value);
  if (!payload) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  return user;
}
