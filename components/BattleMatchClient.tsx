// components/BattleMatchClient.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type BattleStatus = "PENDING" | "ACTIVE" | "FINISHED" | string;

export type BattleMatch = {
  id: string;
  status: BattleStatus;
  player1Id: string;
  player2Id: string | null;
  currentTurnPlayerId: string | null;
  winnerUserId: string | null;
  lastUpdatedAt: string; // ISO string
  battleState: any; // your own battle state type
};

type BattleMatchClientProps = {
  initialMatch: BattleMatch;
  currentUserId: string;
  // "SINGLE" = vs computer, "MULTI" = vs another user.
  mode: "SINGLE" | "MULTI";
  pollIntervalMs?: number;
};

const TURN_DURATION_MS = 60_000; // 60 seconds

export default function BattleMatchClient({
  initialMatch,
  currentUserId,
  mode,
  pollIntervalMs = 1500,
}: BattleMatchClientProps) {
  const [match, setMatch] = useState<BattleMatch>(initialMatch);
  const [isEndingTurn, setIsEndingTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isMyTurn =
    match.status === "ACTIVE" &&
    !!match.currentTurnPlayerId &&
    match.currentTurnPlayerId === currentUserId;

  // If you later store an explicit "turnStartAt" in battleState, use that instead.
  const turnStartTime = useMemo(
    () => new Date(match.lastUpdatedAt).getTime(),
    [match.lastUpdatedAt]
  );

  const turnEndsAt = turnStartTime + TURN_DURATION_MS;
  const msLeft = Math.max(0, turnEndsAt - now);
  const secondsLeft = Math.ceil(msLeft / 1000);

  const youLabel = "You";
  const oppLabel = mode === "SINGLE" ? "Computer" : "Opponent";

  // -----------------------
  // Poll match from server
  // -----------------------
  useEffect(() => {
    if (!match.id) return;
    if (match.status === "FINISHED") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/battle/matches/${match.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.match) return;

        // Only update if something actually changed
        setMatch((prev) =>
          prev.lastUpdatedAt === data.match.lastUpdatedAt ? prev : data.match
        );
      } catch {
        // swallow polling errors; they’re usually temporary
      }
    };

    poll(); // initial fetch

    pollIntervalRef.current = setInterval(poll, pollIntervalMs);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [match.id, match.status, pollIntervalMs]);

  // -----------------------
  // Turn countdown timer
  // -----------------------
  useEffect(() => {
    // only tick when it's our turn and match is active
    if (!isMyTurn || match.status !== "ACTIVE") {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    setNow(Date.now());

    timerIntervalRef.current = setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isMyTurn, match.status, turnStartTime]);

  // Auto-end turn when timer hits 0 (client-side safety)
  useEffect(() => {
    if (!isMyTurn || match.status !== "ACTIVE") return;
    if (msLeft > 0) return;

    // Time up → auto end turn (guarded)
    void handleEndTurn(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft, isMyTurn, match.status]);

  // -----------------------
  // End turn (ONLY button)
  // -----------------------
  const handleEndTurn = async (auto = false) => {
    if (!isMyTurn) return;
    if (isEndingTurn) return; // prevent “stuck” from double click
    setIsEndingTurn(true);
    if (!auto) setError(null);

    try {
      const res = await fetch(
        `/api/battle/matches/${match.id}/end-turn`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!auto) {
          setError(body.error || "Failed to end turn.");
        }
        return;
      }

      const data = await res.json().catch(() => ({}));

      // If backend returns updated match, sync immediately
      if (data.match) {
        setMatch(data.match);
      }
      // Otherwise polling will pick up new state on next tick
    } catch (err) {
      if (!auto) {
        setError("Network error ending turn.");
      }
    } finally {
      setIsEndingTurn(false);
    }
  };

  // -----------------------
  // UI
  // -----------------------
  const matchShortId = match.id ? match.id.slice(0, 6) : "";

  return (
    <div className="flex flex-col gap-4">
      {/* TOP BAR: players + timer + END TURN ONLY */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-slate-800 px-3 py-1 text-sm font-semibold">
            {youLabel}{" "}
            {match.status === "FINISHED"
              ? "• Match Finished"
              : isMyTurn
              ? "• Your Turn"
              : "• Waiting for Opponent"}
          </span>
          <span className="text-xs text-slate-400">
            vs {oppLabel} • Match #{matchShortId}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">
              Turn Timer
            </span>
            <span className="font-mono text-sm">
              {match.status === "ACTIVE" ? `${secondsLeft}s` : "--"}
            </span>
          </div>

          <button
            onClick={() => void handleEndTurn(false)}
            disabled={
              !isMyTurn || isEndingTurn || match.status !== "ACTIVE"
            }
            className="rounded-full bg-amber-500 px-4 py-1 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isEndingTurn ? "Ending..." : "End Turn"}
          </button>
        </div>
      </div>

      {/* ERROR BANNER (if any) */}
      {error && (
        <div className="rounded-lg border border-red-700 bg-red-950/60 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      {/* MAIN BATTLE AREA – plug your real board here */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900 to-slate-950 p-4">
        {/* TODO: replace with your actual board / hands / etc. */}
        <pre className="max-h-[400px] overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">
          {JSON.stringify(match.battleState, null, 2)}
        </pre>
      </div>
    </div>
  );
}
