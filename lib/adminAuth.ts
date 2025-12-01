// lib/adminAuth.ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "./auth";

const ADMIN_SECRET = process.env.ADMIN_TOOLS_SECRET;

type AdminCheckResult =
  | { ok: true; user: { id: string; email: string } }
  | { ok: false; response: NextResponse };

export async function requireAdminSecret(
  req: NextRequest
): Promise<AdminCheckResult> {
  const user = await getUserFromRequest(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      ),
    };
  }

  if (!ADMIN_SECRET) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Admin tools misconfigured. ADMIN_TOOLS_SECRET is not set on the server.",
        },
        { status: 500 }
      ),
    };
  }

  const headerSecret = req.headers.get("x-admin-secret");
  const bodySecret =
    !headerSecret && req.headers.get("content-type")?.includes("application/json")
      ? await tryReadSecretFromBody(req)
      : null;

  const provided = headerSecret || bodySecret;

  if (!provided) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin secret required." },
        { status: 403 }
      ),
    };
  }

  if (!timingSafeEqual(ADMIN_SECRET, provided)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid admin credentials." },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}

async function tryReadSecretFromBody(req: NextRequest): Promise<string | null> {
  try {
    const clone = req.clone();
    const body = (await clone.json().catch(() => null)) as
      | { adminSecret?: string }
      | null;
    if (!body || typeof body.adminSecret !== "string") return null;
    return body.adminSecret;
  } catch {
    return null;
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
