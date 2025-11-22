"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type LeagueLeaderboardEntry = {
  userId: string;
  email: string;
  points: number;
};

type LeagueLeaderboardResponse = {
  league: {
    id: string;
    name: string;
    code: string;
    ownerEmail?: string;
  };
  gameweek: {
    id: string;
    number: number;
    name: string | null;
    deadlineAt: string;
  } | null;
  scores: LeagueLeaderboardEntry[];
  error?: string;
};

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string;

  const [data, setData] =
    useState<LeagueLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/leagues/${leagueId}/leaderboard`,
          {
            credentials: "include"
          }
        );
        const json =
          (await res
            .json()
            .catch(() => null)) as LeagueLeaderboardResponse | null;

        if (!res.ok || !json) {
          setError(
            json?.error ||
              "Failed to load league leaderboard."
          );
          setData(null);
          return;
        }

        if (json.error) {
          setError(json.error);
        }

        setData(json);
      } catch {
        setError("Failed to load league leaderboard.");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [leagueId]);

  if (!leagueId) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            No league selected.
          </p>
        </section>
      </main>
    );
  }

  if (loading && !data) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading league table...
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
            League not available
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            We couldn&apos;t load this league. It may not exist or
            you might not be a member.
          </p>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            type="button"
            onClick={() => router.push("/leagues")}
            className="mt-2 rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
          >
            Back to Leagues
          </button>
        </section>
      </main>
    );
  }

  const { league, gameweek, scores } = data;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">
            {league.name}
          </h2>
          <p className="text-xs text-slate-400 mb-1">
            League code:{" "}
            <span className="font-mono">{league.code}</span>
          </p>
          {league.ownerEmail && (
            <p className="text-xs text-slate-400">
              Owner: {league.ownerEmail}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">
            This table shows the latest gameweek with recorded scores.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Link
            href="/leagues"
            className="text-[11px] text-slate-300 underline underline-offset-2"
          >
            Back to all leagues
          </Link>
          {gameweek && (
            <div className="text-[11px] text-slate-300 text-right">
              <div>
                Gameweek {gameweek.number}
                {gameweek.name ? ` • ${gameweek.name}` : ""}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {scores.length === 0 ? (
          <p className="text-sm text-slate-300">
            No scores recorded yet for this league. Make sure players
            have locked squads and the gameweek has been scored.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-700 text-slate-300">
              <tr>
                <th className="py-2 pr-4">Rank</th>
                <th className="py-2 pr-4">Manager</th>
                <th className="py-2 pr-4 text-right">
                  Gameweek Points
                </th>
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
