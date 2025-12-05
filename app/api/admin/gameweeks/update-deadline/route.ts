// app/api/admin/gameweeks/update-deadline/route.ts
// or src/app/api/admin/gameweeks/update-deadline/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { requireAdminSecret } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const adminCheck = await requireAdminSecret(req);
  if (!adminCheck.ok) {
    return adminCheck.response;
  }

  try {
    const user = await getUserFromRequest(req);

    // tighten if you have roles
    // if (!user || user.role !== "ADMIN") ...
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    // Allow multiple shapes:
    // { id, deadlineAt }
    // { id, deadline }
    // { number, deadlineAt }
    // { number, deadline }
    const { id, number } = body as {
      id?: string;
      number?: number;
    };

    const rawDeadline: string | undefined =
      body.deadlineAt ?? body.deadline;

    if (!id && typeof number !== "number") {
      return NextResponse.json(
        {
          error:
            "You must provide either 'id' (string) or 'number' (number) in the request body.",
        },
        { status: 400 }
      );
    }

    if (!rawDeadline || typeof rawDeadline !== "string") {
      return NextResponse.json(
        {
          error:
            "Missing or invalid deadline. Provide 'deadline' or 'deadlineAt' as an ISO date string.",
        },
        { status: 400 }
      );
    }

    const deadlineDate = new Date(rawDeadline);
    if (isNaN(deadlineDate.getTime())) {
      return NextResponse.json(
        {
          error: `Invalid date format for deadline: '${rawDeadline}'. Expected a valid ISO date string, e.g. '2025-12-31T18:30:00.000Z'.`,
        },
        { status: 400 }
      );
    }

    let updatedCount = 0;

    if (id) {
      // Use unique id when provided
      const updated = await prisma.gameweek.update({
        where: { id },
        data: { deadlineAt: deadlineDate },
      });
      updatedCount = updated ? 1 : 0;
    } else if (typeof number === "number") {
      // Fallback: update all gameweeks with this number
      const result = await prisma.gameweek.updateMany({
        where: { number },
        data: { deadlineAt: deadlineDate },
      });
      updatedCount = result.count;
    }

    if (updatedCount === 0) {
      return NextResponse.json(
        {
          error: id
            ? `No gameweek found with id '${id}'.`
            : `No gameweek found with number ${number}.`,
        },
        { status: 404 }
      );
    }

    // Fetch one updated gameweek (for UI)
    const gameweek = await prisma.gameweek.findFirst({
      where: id ? { id } : { number },
    });

    return NextResponse.json({
      success: true,
      gameweek,
    });
  } catch (err) {
    console.error("Error in /api/admin/gameweeks/update-deadline:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
