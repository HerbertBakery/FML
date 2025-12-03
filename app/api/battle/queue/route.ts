// app/api/battle/queue/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

async function requireUser(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    throw new Error("NOT_AUTH");
  }
  return user;
}

// Helper: find an active match for this user (WAITING or IN_PROGRESS)
async function findActiveMatchForUser(userId: string) {
  return prisma.battleMatch.findFirst({
    where: {
      status: { in: ["WAITING", "IN_PROGRESS"] },
      OR: [{ player1Id: userId }, { player2Id: userId }],
    },
    orderBy: { createdAt: "desc" },
  });
}

// POST = join queue (and potentially immediately match)
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);

    // 1) If user already has an active match, just return it
    const existingMatch = await findActiveMatchForUser(user.id);
    if (existingMatch) {
      return NextResponse.json({
        status: "MATCHED",
        matchId: existingMatch.id,
      });
    }

    // 2) Try to find someone else waiting in the queue
    const opponentQueue = await prisma.battleQueueEntry.findFirst({
      where: {
        userId: { not: user.id },
      },
      orderBy: { createdAt: "asc" },
    });

    if (opponentQueue) {
      // Pair them up in a single transaction
      const match = await prisma.$transaction(async (tx) => {
        // Double-check opponent doesn't already have an active match
        const opponentActive = await findActiveMatchForUser(
          opponentQueue.userId
        );
        if (opponentActive) {
          // Clean their queue entry and just return their match
          await tx.battleQueueEntry.delete({
            where: { id: opponentQueue.id },
          });
          return opponentActive;
        }

        const created = await tx.battleMatch.create({
          data: {
            player1Id: opponentQueue.userId,
            player2Id: user.id,
            status: "WAITING",
          },
        });

        // Remove both from queue (if present)
        await tx.battleQueueEntry.deleteMany({
          where: {
            userId: { in: [user.id, opponentQueue.userId] },
          },
        });

        return created;
      });

      return NextResponse.json({
        status: "MATCHED",
        matchId: match.id,
      });
    }

    // 3) Otherwise, put this user into the queue (or refresh their row)
    await prisma.battleQueueEntry.upsert({
      where: { userId: user.id },
      update: { createdAt: new Date() },
      create: { userId: user.id },
    });

    return NextResponse.json({
      status: "QUEUED",
    });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("Error in /api/battle/queue POST:", err);
    return NextResponse.json(
      { error: "Failed to join queue" },
      { status: 500 }
    );
  }
}

// GET = poll queue status (used while "Searching for opponent...")
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);

    // If they have an active match, report as matched
    const existingMatch = await findActiveMatchForUser(user.id);
    if (existingMatch) {
      return NextResponse.json({
        status: "MATCHED",
        matchId: existingMatch.id,
      });
    }

    // Otherwise, see if they are currently queued
    const queueEntry = await prisma.battleQueueEntry.findUnique({
      where: { userId: user.id },
    });

    if (queueEntry) {
      return NextResponse.json({
        status: "QUEUED",
      });
    }

    // Not queued and no match => idle
    return NextResponse.json({
      status: "IDLE",
    });
  } catch (err: any) {
    if (err?.message === "NOT_AUTH") {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }
    console.error("Error in /api/battle/queue GET:", err);
    return NextResponse.json(
      { error: "Failed to check queue" },
      { status: 500 }
    );
  }
}
