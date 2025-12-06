// app/api/battle/matches/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import {
  createInitialBattleForMatch,
  applyAttack,
  playCardFromHand,
  advanceTurn,
  useHeroPower,
  type BattleState,
} from "@/lib/battleEngineServer";

export const runtime = "nodejs";

type ActionBody =
  | { action: "INIT" }
  | { action: "PLAY_CARD"; handIndex: number }
  | { action: "ATTACK_HERO"; attackerIndex: number }
  | {
      action: "ATTACK_MINION";
      attackerIndex: number;
      targetIndex: number;
    }
  | { action: "END_TURN" }
  | { action: "HERO_POWER" };

// Small helper to shape response
function serializeMatch(
  match: any,
  userId: string
): {
  id: string;
  status: string;
  createdAt: string;
  player1Id: string;
  player2Id: string | null;
  currentTurnPlayerId: string | null;
  winnerUserId: string | null;
  battleState: BattleState | null;
  youArePlayer1: boolean;
} {
  return {
    id: match.id,
    status: match.status,
    createdAt:
      typeof match.createdAt === "string"
        ? match.createdAt
        : match.createdAt.toISOString?.() ?? String(match.createdAt),
    player1Id: match.player1Id,
    player2Id: match.player2Id,
    currentTurnPlayerId: match.currentTurnPlayerId,
    winnerUserId: match.winnerUserId ?? null,
    battleState: (match.battleState as BattleState | null) ?? null,
    youArePlayer1: match.player1Id === userId,
  };
}

async function getMatchForUser(matchId: string, userId: string) {
  const match = await prisma.battleMatch.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    return { error: "Match not found", status: 404 as const, match: null };
  }

  if (match.player1Id !== userId && match.player2Id !== userId) {
    return {
      error: "You are not a participant in this match",
      status: 403 as const,
      match: null,
    };
  }

  return { match, error: null, status: 200 as const };
}

/**
 * Ensure the battleState is created once both players are present.
 * This makes the backend robust even if the front-end INIT effect glitches.
 */
async function ensureBattleInitialized(match: any, userId: string) {
  // Already initialized or completed? Just return as-is.
  if (
    match.battleState &&
    match.status !== "WAITING" &&
    match.status !== "PENDING"
  ) {
    return serializeMatch(match, userId);
  }

  // Need both players before we can initialize.
  if (!match.player1Id || !match.player2Id || match.status === "COMPLETED") {
    return serializeMatch(match, userId);
  }

  // If we *already* have a battleState (but status still says WAITING),
  // treat that as initialized as well.
  if (match.battleState) {
    if (match.status !== "COMPLETED" && match.currentTurnPlayerId == null) {
      // Optionally bump status to IN_PROGRESS here, but keep it simple:
      const updated = await prisma.battleMatch.update({
        where: { id: match.id },
        data: {
          status: "IN_PROGRESS",
          currentTurnPlayerId: match.player1Id,
          lastUpdatedAt: new Date(),
        },
      });
      return serializeMatch(updated, userId);
    }
    return serializeMatch(match, userId);
  }

  // No battleState yet + both players are present → create one now.
  try {
    const initialState = await createInitialBattleForMatch({
      player1Id: match.player1Id,
      player2Id: match.player2Id,
    });

    const updated = await prisma.battleMatch.update({
      where: { id: match.id },
      data: {
        status: "IN_PROGRESS",
        battleState: initialState,
        currentTurnPlayerId: match.player1Id,
        lastUpdatedAt: new Date(),
      },
    });

    return serializeMatch(updated, userId);
  } catch (err) {
    console.error("Error initializing battle for match", match.id, err);
    // Fall back to the raw match so the UI doesn't explode;
    // this will still show WAITING + null battleState.
    return serializeMatch(match, userId);
  }
}

// -------- GET: read match state --------

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const { match, error, status } = await getMatchForUser(
    params.id,
    user.id
  );

  if (!match) {
    return NextResponse.json({ error }, { status });
  }

  // 🔑 NEW: auto-init battle on read when both players are present
  const payload = await ensureBattleInitialized(match, user.id);
  return NextResponse.json(payload);
}

// -------- POST: apply an action to the battle --------

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as ActionBody | null;
  if (!body || !("action" in body)) {
    return NextResponse.json(
      { error: "Missing or invalid action body" },
      { status: 400 }
    );
  }

  const { match, error, status } = await getMatchForUser(
    params.id,
    user.id
  );
  if (!match) {
    return NextResponse.json({ error }, { status });
  }

  // Ensure both players are present for anything beyond INIT
  if (
    body.action !== "INIT" &&
    (!match.player1Id || !match.player2Id)
  ) {
    return NextResponse.json(
      { error: "Match is not ready. Waiting for both players." },
      { status: 400 }
    );
  }

  // ---- INIT: create battleState if missing ----
  if (body.action === "INIT") {
    // This is now just a friendly wrapper around ensureBattleInitialized.
    const payload = await ensureBattleInitialized(match, user.id);
    return NextResponse.json(payload);
  }

  // From here on, we require an existing battleState
  if (!match.battleState) {
    return NextResponse.json(
      { error: "Battle not initialized for this match yet." },
      { status: 400 }
    );
  }

  let state = match.battleState as BattleState;

  // Determine which side this user controls
  const youArePlayer1 = match.player1Id === user.id;
  const yourSide: "player" | "opponent" = youArePlayer1
    ? "player"
    : "opponent";

  // Enforce turn ownership
  if (
    match.status === "IN_PROGRESS" &&
    match.currentTurnPlayerId &&
    match.currentTurnPlayerId !== user.id
  ) {
    return NextResponse.json(
      { error: "It is not your turn." },
      { status: 400 }
    );
  }

  if (state.winner) {
    return NextResponse.json(
      { error: "Match is already completed." },
      { status: 400 }
    );
  }

  if (state.active !== yourSide && body.action !== "END_TURN") {
    // For safety, also block non-active from playing even if DB currentTurn loses sync
    return NextResponse.json(
      { error: "It is not your turn in the battle state." },
      { status: 400 }
    );
  }

  // ---- Apply the requested action ----
  switch (body.action) {
    case "PLAY_CARD": {
      if (typeof body.handIndex !== "number") {
        return NextResponse.json(
          { error: "handIndex is required for PLAY_CARD" },
          { status: 400 }
        );
      }
      state = playCardFromHand(state, yourSide, body.handIndex);
      break;
    }

    case "ATTACK_HERO": {
      if (typeof body.attackerIndex !== "number") {
        return NextResponse.json(
          { error: "attackerIndex is required for ATTACK_HERO" },
          { status: 400 }
        );
      }
      state = applyAttack(
        state,
        yourSide,
        body.attackerIndex,
        "HERO"
      );
      break;
    }

    case "ATTACK_MINION": {
      if (
        typeof body.attackerIndex !== "number" ||
        typeof body.targetIndex !== "number"
      ) {
        return NextResponse.json(
          {
            error:
              "attackerIndex and targetIndex are required for ATTACK_MINION",
          },
          { status: 400 }
        );
      }
      state = applyAttack(
        state,
        yourSide,
        body.attackerIndex,
        "MINION",
        body.targetIndex
      );
      break;
    }

    case "END_TURN": {
      // Only the active side can end their turn
      if (state.active !== yourSide) {
        return NextResponse.json(
          { error: "You cannot end the other player's turn." },
          { status: 400 }
        );
      }
      state = advanceTurn(state);
      break;
    }

    case "HERO_POWER": {
      // Hero Power uses shared engine logic (draw 2 for 3 mana)
      state = useHeroPower(state, yourSide);
      break;
    }

    default:
      return NextResponse.json(
        { error: "Unknown action." },
        { status: 400 }
      );
  }

  // ---- Derive new DB fields from updated state ----
  let newStatus = match.status;
  let newWinnerUserId: string | null = match.winnerUserId;

  if (state.winner) {
    newStatus = "COMPLETED";
    if (state.winner === "player") {
      newWinnerUserId = match.player1Id;
    } else if (state.winner === "opponent") {
      newWinnerUserId = match.player2Id;
    } else {
      newWinnerUserId = null; // DRAW
    }
  }

  const newCurrentTurnPlayerId =
    !state.winner && match.player1Id && match.player2Id
      ? state.active === "player"
        ? match.player1Id
        : match.player2Id
      : null;

  const updated = await prisma.battleMatch.update({
    where: { id: match.id },
    data: {
      status: newStatus,
      winnerUserId: newWinnerUserId,
      battleState: state,
      currentTurnPlayerId: newCurrentTurnPlayerId,
      lastUpdatedAt: new Date(),
    },
  });

  return NextResponse.json(serializeMatch(updated, user.id));
}