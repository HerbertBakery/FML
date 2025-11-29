"use client";

import { useEffect, useState } from "react";

type ApiResponse = {
  message?: string;
  error?: string;
  gameweekNumber?: number;
  entriesProcessed?: number;
  monstersUpdated?: number;
};

type CurrentGameweek = {
  id: string;
  number: number;
  name: string | null;
  deadlineAt: string;
  isActive: boolean;
};

export default function AdminToolsPage() {
  // ----- Scoring from FPL -----
  const [gwForScore, setGwForScore] = useState<string>(""); // empty = use active GW
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreResult, setScoreResult] = useState<ApiResponse | null>(null);

  // ----- Current gameweek info -----
  const [currentGw, setCurrentGw] = useState<CurrentGameweek | null>(null);
  const [currentGwLoading, setCurrentGwLoading] = useState(false);
  const [currentGwError, setCurrentGwError] = useState<string | null>(null);

  // ----- Set current gameweek -----
  const [setGwInput, setSetGwInput] = useState<string>("");
  const [setGwLoading, setSetGwLoading] = useState(false);
  const [setGwMessage, setSetGwMessage] = useState<string | null>(null);
  const [setGwErrorMsg, setSetGwErrorMsg] = useState<string | null>(null);

  // ----- Update deadline -----
  const [deadlineGwInput, setDeadlineGwInput] = useState<string>("");
  const [deadlineInput, setDeadlineInput] = useState<string>(""); // datetime-local string
  const [deadlineLoading, setDeadlineLoading] = useState(false);
  const [deadlineMessage, setDeadlineMessage] = useState<string | null>(null);
  const [deadlineErrorMsg, setDeadlineErrorMsg] = useState<string | null>(null);

  // ------------------ Helpers ------------------

  async function loadCurrentGameweek() {
    setCurrentGwLoading(true);
    setCurrentGwError(null);
    try {
      const res = await fetch("/api/gameweeks/current", {
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setCurrentGwError(
          json?.error || "Failed to load current gameweek from server."
        );
        setCurrentGw(null);
        return;
      }
      const json = await res.json();
      if (json && json.gameweek) {
        setCurrentGw(json.gameweek as CurrentGameweek);
      } else {
        setCurrentGw(null);
      }
    } catch {
      setCurrentGwError("Network error loading current gameweek.");
      setCurrentGw(null);
    } finally {
      setCurrentGwLoading(false);
    }
  }

  useEffect(() => {
    void loadCurrentGameweek();
  }, []);

  function formatDeadline(deadlineAt: string | null | undefined) {
    if (!deadlineAt) return "—";
    const d = new Date(deadlineAt);
    if (Number.isNaN(d.getTime())) return deadlineAt;
    return d.toLocaleString();
  }

  // ------------------ Actions ------------------

  // 1) Score from FPL
  async function handleScoreFromFpl() {
    setScoreLoading(true);
    setScoreResult(null);

    let gameweekNumber: number | undefined = undefined;
    const trimmed = gwForScore.trim();

    if (trimmed.length > 0) {
      const parsed = parseInt(trimmed, 10);
      if (!Number.isNaN(parsed)) {
        gameweekNumber = parsed;
      }
    }

    try {
      const res = await fetch("/api/admin/fpl/score-gameweek", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(gameweekNumber ? { gameweekNumber } : {}),
      });

      const json = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok) {
        setScoreResult(
          json || {
            error: "Failed to score from FPL. Check server logs.",
          }
        );
      } else {
        setScoreResult(
          json || {
            message: "Scored gameweek from FPL (no details returned).",
          }
        );
      }
    } catch {
      setScoreResult({
        error: "Network error scoring from FPL. Is the server running?",
      });
    } finally {
      setScoreLoading(false);
    }
  }

  // 2) Set current gameweek (e.g. switch to GW 14)
  async function handleSetCurrentGameweek() {
    setSetGwMessage(null);
    setSetGwErrorMsg(null);

    const trimmed = setGwInput.trim();
    if (!trimmed) {
      setSetGwErrorMsg("Enter a gameweek number (1–38).");
      return;
    }
    const parsed = parseInt(trimmed, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 38) {
      setSetGwErrorMsg("Gameweek number must be between 1 and 38.");
      return;
    }

    setSetGwLoading(true);
    try {
      const res = await fetch("/api/admin/gameweeks/set-current", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ number: parsed }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSetGwErrorMsg(
          json?.error || "Failed to set current gameweek. Check server logs."
        );
      } else {
        setSetGwMessage(
          `Current gameweek set to ${json?.gameweek?.number ?? parsed}.`
        );
        // Refresh the current GW info box
        void loadCurrentGameweek();
      }
    } catch {
      setSetGwErrorMsg("Network error setting current gameweek.");
    } finally {
      setSetGwLoading(false);
    }
  }

  // 3) Update deadline of a gameweek
  async function handleUpdateDeadline() {
    setDeadlineMessage(null);
    setDeadlineErrorMsg(null);

    const trimmedGw = deadlineGwInput.trim();
    if (!trimmedGw) {
      setDeadlineErrorMsg("Enter the gameweek number whose deadline you want to edit.");
      return;
    }
    const parsedGw = parseInt(trimmedGw, 10);
    if (Number.isNaN(parsedGw) || parsedGw < 1 || parsedGw > 38) {
      setDeadlineErrorMsg("Gameweek number must be between 1 and 38.");
      return;
    }

    if (!deadlineInput.trim()) {
      setDeadlineErrorMsg("Pick a deadline date/time.");
      return;
    }

    // datetime-local gives something like "2025-08-01T18:30"
    const deadlineAt = deadlineInput;

    setDeadlineLoading(true);
    try {
      const res = await fetch("/api/admin/gameweeks/update-deadline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ number: parsedGw, deadlineAt }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setDeadlineErrorMsg(
          json?.error || "Failed to update deadline. Check server logs."
        );
      } else {
        setDeadlineMessage(
          `Deadline for GW ${json?.gameweek?.number ?? parsedGw} updated.`
        );
        // Refresh current GW info box (in case we edited the active one)
        void loadCurrentGameweek();
      }
    } catch {
      setDeadlineErrorMsg("Network error updating deadline.");
    } finally {
      setDeadlineLoading(false);
    }
  }

  // ------------------ UI ------------------

  return (
    <main className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-2">Admin Tools</h2>
        <p className="text-sm text-slate-300">
          Manage gameweeks and trigger real FPL-based scoring and monster evolution.
        </p>
      </section>

      {/* Current GW info */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">
          Current gameweek (from DB)
        </h3>
        {currentGwLoading ? (
          <p className="text-xs text-slate-300">Loading current gameweek...</p>
        ) : currentGwError ? (
          <p className="text-xs text-red-400">{currentGwError}</p>
        ) : currentGw ? (
          <div className="text-xs text-slate-200 space-y-1">
            <p>
              <span className="font-semibold">Number:</span>{" "}
              {currentGw.number}{" "}
              {currentGw.name ? <span>({currentGw.name})</span> : null}
            </p>
            <p>
              <span className="font-semibold">Deadline:</span>{" "}
              {formatDeadline(currentGw.deadlineAt)}
            </p>
            <p>
              <span className="font-semibold">Active flag:</span>{" "}
              {currentGw.isActive ? "true" : "false"}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-300">
            No gameweek found yet. Hitting this endpoint will create GW 1 as active.
          </p>
        )}
      </section>

      {/* Set current GW */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">
          Set current active gameweek
        </h3>
        <p className="text-xs text-slate-300 mb-1">
          Use this to switch which gameweek is considered &quot;current&quot; for
          squad locking and (if no GW is passed) scoring from FPL. For example, set this
          to <span className="font-mono">14</span> to start at Gameweek 14.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Gameweek number (1–38)
            </label>
            <input
              type="number"
              value={setGwInput}
              onChange={(e) => setSetGwInput(e.target.value)}
              className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-50"
              placeholder="e.g. 14"
            />
          </div>
          <button
            type="button"
            onClick={handleSetCurrentGameweek}
            disabled={setGwLoading}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              setGwLoading
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            }`}
          >
            {setGwLoading ? "Updating..." : "Set current gameweek"}
          </button>
        </div>

        {setGwErrorMsg && (
          <p className="text-xs text-red-400 mt-1">{setGwErrorMsg}</p>
        )}
        {setGwMessage && (
          <p className="text-xs text-emerald-300 mt-1">{setGwMessage}</p>
        )}
      </section>

      {/* Update deadline */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-100">
          Update gameweek deadline
        </h3>
        <p className="text-xs text-slate-300 mb-1">
          Set or adjust the deadline for any gameweek. This is what the squad-locking
          endpoint checks.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Gameweek number
            </label>
            <input
              type="number"
              value={deadlineGwInput}
              onChange={(e) => setDeadlineGwInput(e.target.value)}
              className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-50"
              placeholder="e.g. 14"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Deadline (local time)
            </label>
            <input
              type="datetime-local"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-50"
            />
          </div>
          <button
            type="button"
            onClick={handleUpdateDeadline}
            disabled={deadlineLoading}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              deadlineLoading
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            }`}
          >
            {deadlineLoading ? "Updating..." : "Update deadline"}
          </button>
        </div>

        {deadlineErrorMsg && (
          <p className="text-xs text-red-400 mt-1">{deadlineErrorMsg}</p>
        )}
        {deadlineMessage && (
          <p className="text-xs text-emerald-300 mt-1">{deadlineMessage}</p>
        )}
      </section>

      {/* Score from FPL (your existing section, slightly renamed vars) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-100">
          Score gameweek from FPL data
        </h3>
        <p className="text-xs text-slate-300">
          Fetches official FPL live stats and applies scoring + evolution. If you leave
          the gameweek field empty, it will use the <strong>current active</strong>{" "}
          gameweek from the database.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Gameweek number (optional)
            </label>
            <input
              type="number"
              value={gwForScore}
              onChange={(e) => setGwForScore(e.target.value)}
              className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-50"
              placeholder="leave empty = active GW"
            />
          </div>
          <button
            type="button"
            onClick={handleScoreFromFpl}
            disabled={scoreLoading}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              scoreLoading
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            }`}
          >
            {scoreLoading ? "Scoring from FPL..." : "Score gameweek from FPL"}
          </button>
        </div>

        {scoreResult && (
          <div className="mt-3 text-xs">
            {scoreResult.error && (
              <p className="text-red-400 mb-1">{scoreResult.error}</p>
            )}
            {scoreResult.message && (
              <p className="text-emerald-300 mb-1">{scoreResult.message}</p>
            )}
            {typeof scoreResult.gameweekNumber === "number" && (
              <p className="text-slate-300">Gameweek: {scoreResult.gameweekNumber}</p>
            )}
            {typeof scoreResult.entriesProcessed === "number" && (
              <p className="text-slate-300">
                Entries processed: {scoreResult.entriesProcessed}
              </p>
            )}
            {typeof scoreResult.monstersUpdated === "number" && (
              <p className="text-slate-300">
                Monsters updated: {scoreResult.monstersUpdated}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
