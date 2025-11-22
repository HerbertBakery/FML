"use client";

import { useState } from "react";

type ApiResponse = {
  message?: string;
  error?: string;
  gameweekNumber?: number;
  entriesProcessed?: number;
  monstersUpdated?: number;
};

export default function AdminToolsPage() {
  const [gw, setGw] = useState<string>("1");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function handleScoreFromFpl() {
    setLoading(true);
    setResult(null);

    let gameweekNumber: number | undefined = undefined;
    if (gw.trim().length > 0) {
      const parsed = parseInt(gw.trim(), 10);
      if (!Number.isNaN(parsed)) {
        gameweekNumber = parsed;
      }
    }

    try {
      const res = await fetch(
        "/api/admin/fpl/score-gameweek",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            gameweekNumber
              ? { gameweekNumber }
              : {}
          )
        }
      );

      const json = (await res
        .json()
        .catch(() => null)) as ApiResponse | null;

      if (!res.ok) {
        setResult(
          json || {
            error:
              "Failed to score from FPL. Check server logs."
          }
        );
      } else {
        setResult(
          json || {
            message:
              "Scored gameweek from FPL (no details returned)."
          }
        );
      }
    } catch {
      setResult({
        error:
          "Network error scoring from FPL. Is the server running?"
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-2">
          Admin Tools
        </h2>
        <p className="text-sm text-slate-300">
          Trigger real FPL-based scoring and monster evolution for a
          specific gameweek. This uses official Fantasy Premier League
          live data.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Gameweek number (leave empty to use active GW from DB)
            </label>
            <input
              type="number"
              value={gw}
              onChange={(e) => setGw(e.target.value)}
              className="w-32 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-50"
              placeholder="1"
            />
          </div>
          <button
            type="button"
            onClick={handleScoreFromFpl}
            disabled={loading}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              loading
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            }`}
          >
            {loading
              ? "Scoring from FPL..."
              : "Score Gameweek from FPL"}
          </button>
        </div>

        {result && (
          <div className="mt-3 text-xs">
            {result.error && (
              <p className="text-red-400 mb-1">
                {result.error}
              </p>
            )}
            {result.message && (
              <p className="text-emerald-300 mb-1">
                {result.message}
              </p>
            )}
            {typeof result.gameweekNumber === "number" && (
              <p className="text-slate-300">
                Gameweek: {result.gameweekNumber}
              </p>
            )}
            {typeof result.entriesProcessed === "number" && (
              <p className="text-slate-300">
                Entries processed:{" "}
                {result.entriesProcessed}
              </p>
            )}
            {typeof result.monstersUpdated === "number" && (
              <p className="text-slate-300">
                Monsters updated:{" "}
                {result.monstersUpdated}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
