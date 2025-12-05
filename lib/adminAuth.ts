// lib/adminAuth.ts
import { NextRequest, NextResponse } from "next/server";

/**
 * Read the admin secret from environment.
 * This MUST be set in:
 *  - .env.local  (for local dev)
 *  - Vercel Project → Environment Variables → ADMIN_SECRET
 */
const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";

if (!ADMIN_SECRET) {
  console.warn(
    "[adminAuth] ADMIN_SECRET is NOT set. All admin routes will reject with 500."
  );
}

type AdminCheckOk = { ok: true };
type AdminCheckFail = { ok: false; response: NextResponse };

/**
 * Extracts whatever the client is sending as "the admin password".
 * We support a few places so you can call from Thunder Client, browser, etc.:
 *
 *  1) Header:  x-admin-secret: <secret>
 *  2) Header:  Authorization: Bearer <secret>
 *  3) Cookie:  adminSecret=<secret>
 *  4) Query:   ?adminSecret=<secret>
 */
function extractProvidedSecret(req: NextRequest): string {
  // 1) Custom header
  const headerSecret = req.headers.get("x-admin-secret");
  if (headerSecret && headerSecret.trim().length > 0) {
    return headerSecret.trim();
  }

  // 2) Bearer token in Authorization header
  const auth = req.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice("bearer ".length).trim();
    if (token.length > 0) return token;
  }

  // 3) Cookie
  const cookieSecret = req.cookies.get("adminSecret")?.value;
  if (cookieSecret && cookieSecret.trim().length > 0) {
    return cookieSecret.trim();
  }

  // 4) Query param
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("adminSecret");
  if (querySecret && querySecret.trim().length > 0) {
    return querySecret.trim();
  }

  return "";
}

/**
 * Core guard for all admin API routes.
 *
 * Usage in a route:
 *   const adminCheck = await requireAdminSecret(req);
 *   if (!adminCheck.ok) return adminCheck.response;
 */
export async function requireAdminSecret(
  req: NextRequest
): Promise<AdminCheckOk | AdminCheckFail> {
  if (!ADMIN_SECRET) {
    // Misconfigured server: better to fail closed than let anything through
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Admin secret is not configured on the server. Contact the owner.",
        },
        { status: 500 }
      ),
    };
  }

  const provided = extractProvidedSecret(req);

  // IMPORTANT: This is where the bug usually is.
  // We must compare the *actual value* against ADMIN_SECRET.
  // Not just "is it present", not "== true", etc.
  if (!provided || provided !== ADMIN_SECRET) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid admin secret." },
        { status: 401 }
      ),
    };
  }

  return { ok: true };
}

/**
 * Optional helper if you ever want a boolean-only check
 * (e.g. inside server components or RSC loaders).
 */
export async function isAdminRequestAuthorized(
  req: NextRequest
): Promise<boolean> {
  const result = await requireAdminSecret(req);
  return result.ok;
}
