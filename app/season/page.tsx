"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MeUser = {
  id: string;
  email: string;
  coins: number;
};

type MeResponse = {
  user: MeUser | null;
};

type GameweekEntry = {
  gameweekId: string;
  number: number;
  name: string | null;
  points: number;
};

type GameweeksResponse = {
  entries: GameweekEntry[];
  error?: string;
};

export default function SeasonPage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [entries, setEntries] = useState<GameweekEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include"
      });

      if (!meRes.ok) {
        setMe(null);
        setEntries([]);
        setLoading(false);
        return;
      }

      const meData: MeResponse = await meRes.json();
      if (!meData.user) {
        setMe(null);
        setEntries([]);
        setLoading(false);
        return;
      }

      setMe(meData.user);

      const gwRes = await fetch("/api/me/gameweeks", {
        credentials: "include"
      });

      const gwJson = (await gwRes.json().catch(
        () => null
      )) as GameweeksResponse | null;

      if (!gwRes.ok || !gwJson) {
        setError(
          gwJson?.error ||
            "Failed to load gameweek history."
        );
        setEntries([]);
        return;
      }

      if (gwJson.error) {
        setError(gwJson.error);
      }

      setEntries(gwJson.entries || []);
    } catch {
      setError("Error loading season history.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Logged-out view
  if (!me) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h1 className="text-2xl font-bold mb-2">
            Season History
          </h1>
          <p className="text-sm text-slate-300 mb-4">
            Log in to view your Fantasy Monster League
            gameweek history and season totals.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Log In
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-300"
            >
              Create Account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // Compute stats
  const totalPoints = entries.reduce(
    (sum, e) => sum + e.points,
    0
  );
  const gwCount = entries.length;
  const avgPoints =
    gwCount > 0
      ? Math.round(
          (totalPoints / gwCount) * 10
        ) / 10
      : 0;

  let best: GameweekEntry | null = null;
  let worst: GameweekEntry | null = null;
  for (const e of entries) {
    if (!best || e.points > best.points) {
      best = e;
    }
    if (!worst || e.points < worst.points) {
      worst = e;
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Season History
            </h1>
            <p className="text-xs text-slate-400">
              Manager{" "}
              <span className="font-mono">
                {me.email}
              </span>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
          >
            Refresh
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] text-slate-400">
              Total Points
            </p>
            <p className="mt-1 text-lg font-semibold text-emerald-300 font-mono">
              {totalPoints}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] text-slate-400">
              Gameweeks Played
            </p>
            <p className="mt-1 text-lg font-semibold text-sky-300 font-mono">
              {gwCount}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-[11px] text-slate-400">
              Average Points
            </p>
            <p className="mt-1 text-lg font-semibold text-amber-300 font-mono">
              {avgPoints}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-sm font-semibold text-slate-100 mb-3">
          Gameweek Breakdown
        </h2>

        {loading && !entries.length ? (
          <p className="text-xs text-slate-300">
            Loading gameweek history...
          </p>
        ) : entries.length === 0 ? (
          <p className="text-xs text-slate-300">
            You don&apos;t have any scored gameweeks
            yet. Set your squad and run scoring from
            the Admin Tools after a gameweek has
            finished.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="py-2 pr-4">
                    GW
                  </th>
                  <th className="py-2 pr-4">
                    Name
                  </th>
                  <th className="py-2 pr-4 text-right">
                    Points
                  </th>
                  <th className="py-2 pr-4 text-right">
                    Cumulative
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.reduce(
                  (
                    acc,
                    entry,
                    index
                  ) => {
                    const prevCum =
                      index === 0
                        ? 0
                        : acc.rows[index - 1]
                            .cumulative;
                    const cumulative =
                      prevCum +
                      entry.points;
                    acc.rows.push({
                      entry,
                      cumulative
                    });
                    return acc;
                  },
                  {
                    rows: [] as {
                      entry: GameweekEntry;
                      cumulative: number;
                    }[]
                  }
                ).rows.map(
                  ({ entry, cumulative }) => {
                    const isBest =
                      best &&
                      entry.number ===
                        best.number &&
                      entry.points ===
                        best.points;
                    const isWorst =
                      worst &&
                      entry.number ===
                        worst.number &&
                      entry.points ===
                        worst.points;

                    return (
                      <tr
                        key={
                          entry.gameweekId
                        }
                        className="border-b border-slate-800 last:border-b-0"
                      >
                        <td className="py-2 pr-4 text-slate-200">
                          {entry.number}
                        </td>
                        <td className="py-2 pr-4 text-slate-300">
                          {entry.name ||
                            `Gameweek ${entry.number}`}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <span
                            className={`font-mono ${
                              isBest
                                ? "text-emerald-300"
                                : isWorst
                                ? "text-red-300"
                                : "text-slate-100"
                            }`}
                          >
                            {
                              entry.points
                            }
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right">
                          <span className="font-mono text-slate-100">
                            {cumulative}
                          </span>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
        <p>
          Check the{" "}
          <Link
            href="/leaderboards"
            className="underline underline-offset-2"
          >
            Global Leaderboards
          </Link>{" "}
          to see how your season compares to other
          managers.
        </p>
      </section>
    </main>
  );
}
