"use client";

import { useEffect, useState } from "react";

type LeaderboardEntry = {
  userId: string;
  email: string;
  points: number;
};

type LeaderboardResponse = {
  gameweek: {
    id: string;
    number: number;
    name: string | null;
    deadlineAt: string;
  };
  scores: LeaderboardEntry[];
};

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/gameweeks/leaderboard", {
          credentials: "include"
        });
        if (!res.ok) {
          setData(null);
          return;
        }
        const json = (await res.json()) as LeaderboardResponse;
        setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading leaderboard...
          </p>
        </section>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Leaderboard unavailable
          </h2>
          <p className="text-sm text-slate-300">
            We couldn&apos;t load the current gameweek leaderboard.
            Try again later.
          </p>
        </section>
      </main>
    );
  }

  const { gameweek, scores } = data;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-1">
          Gameweek {gameweek.number} Leaderboard
        </h2>
        <p className="text-xs text-slate-400">
          For now, all managers will show 0 points until we wire in
          the scoring engine. This is just the shell.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {scores.length === 0 ? (
          <p className="text-sm text-slate-300">
            No entries yet. Build and lock your squad to appear on the
            leaderboard.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-700 text-slate-300">
              <tr>
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Manager</th>
                <th className="py-2 pr-4 text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, index) => (
                <tr
                  key={entry.userId}
                  className="border-b border-slate-800 last:border-b-0"
                >
                  <td className="py-2 pr-4 text-slate-400">
                    #{index + 1}
                  </td>
                  <td className="py-2 pr-4 text-slate-100">
                    {entry.email}
                  </td>
                  <td className="py-2 pr-4 text-right text-slate-100">
                    {entry.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
