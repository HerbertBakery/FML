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

type MeResponse = {
  user: {
    id: string;
    email: string;
    coins: number;
  } | null;
};

export default function LeagueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leagueId = params?.id as string;

  const [data, setData] =
    useState<LeagueLeaderboardResponse | null>(null);
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        const [meRes, lbRes] = await Promise.all([
          fetch("/api/auth/me", {
            credentials: "include"
          }).catch(() => null),
          fetch(`/api/leagues/${leagueId}/leaderboard`, {
            credentials: "include"
          }).catch(() => null)
        ]);

        // Me
        if (meRes && meRes.ok) {
          const meJson =
            (await meRes
              .json()
              .catch(() => null)) as MeResponse | null;
          if (!cancelled) {
            setMe(meJson?.user ?? null);
          }
        } else if (!cancelled) {
          setMe(null);
        }

        // Leaderboard
        if (!lbRes) {
          if (!cancelled) {
            setError(
              "Failed to load league leaderboard."
            );
            setData(null);
          }
          return;
        }

        const json =
          (await lbRes
            .json()
            .catch(() => null)) as LeagueLeaderboardResponse | null;

        if (!lbRes.ok || !json) {
          if (!cancelled) {
            setError(
              json?.error ||
                "Failed to load league leaderboard."
            );
            setData(null);
          }
          return;
        }

        if (json.error) {
          if (!cancelled) {
            setError(json.error);
          }
        }

        if (!cancelled) {
          setData(json);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load league leaderboard.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Loading league...
          </h2>
          <p className="text-sm text-slate-300">
            Fetching the latest standings for this mini
            league.
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
            We couldn&apos;t load this league. It may not
            exist or you might not be a member.
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
  const myUserId = me?.id ?? null;
  const myIndex = myUserId
    ? scores.findIndex(
        (entry) => entry.userId === myUserId
      )
    : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myPoints =
    myIndex >= 0 ? scores[myIndex].points : null;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-1">
            {league.name}
          </h2>
          <p className="text-xs text-slate-400 mb-1">
            League code:{" "}
            <span className="font-mono">
              {league.code}
            </span>
          </p>
          {league.ownerEmail && (
            <p className="text-xs text-slate-400">
              Owner: {league.ownerEmail}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-2">
            This table shows the latest gameweek with
            recorded scores.
          </p>
          {myRank && (
            <p className="mt-2 text-xs font-semibold text-emerald-300">
              Your rank in this league: #{myRank}
              {typeof myPoints === "number"
                ? ` • ${myPoints} pts`
                : ""}
            </p>
          )}
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
                {gameweek.name
                  ? ` • ${gameweek.name}`
                  : ""}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="font-semibold mb-2 text-sm">
          League Standings
        </h3>

        {error && (
          <p className="text-xs text-red-400 mb-2">
            {error}
          </p>
        )}

        {scores.length === 0 ? (
          <p className="text-xs text-slate-400">
            No scores yet for this league.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2 pr-4 text-left">
                  Rank
                </th>
                <th className="py-2 pr-4 text-left">
                  Manager
                </th>
                <th className="py-2 pr-4 text-right">
                  Gameweek Points
                </th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry, index) => {
                const isMe =
                  myUserId &&
                  entry.userId === myUserId;
                return (
                  <tr
                    key={entry.userId}
                    className={
                      "border-b border-slate-800 last:border-b-0" +
                      (isMe
                        ? " bg-emerald-500/10"
                        : "")
                    }
                  >
                    <td className="py-2 pr-4 text-slate-400">
                      #{index + 1}
                    </td>
                    <td className="py-2 pr-4 text-slate-100">
                      {entry.email}
                      {isMe && (
                        <span className="ml-2 rounded-full border border-emerald-400/60 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          You
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-right text-slate-100">
                      {entry.points}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
