"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Mode = "gameweek" | "overall";

type LeaderboardEntry = {
  userId: string;
  email: string;
  points: number;
};

type LeaderboardResponse = {
  mode: Mode;
  gameweek: {
    id: string;
    number: number;
    name: string | null;
    deadlineAt: string;
  } | null;
  entries: LeaderboardEntry[];
  error?: string;
};

type MeResponse = {
  user: {
    id: string;
    email: string;
    coins: number;
  } | null;
};

// From /leagues page
type League = {
  id: string;
  name: string;
  code: string;
  ownerEmail: string;
  isOwner: boolean;
  memberCount: number;
  myRank: number | null;
};

type ListResponse = {
  leagues: League[];
};

export default function LeaderboardsPage() {
  const [mode, setMode] = useState<Mode>("gameweek");

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [me, setMe] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Private leagues state
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState<boolean>(true);
  const [leaguesError, setLeaguesError] = useState<string | null>(null);

  // -----------------------------
  // Load global leaderboard + me
  // -----------------------------
  async function loadLeaderboard(modeToLoad: Mode) {
    setLoading(true);
    setError(null);

    try {
      const [meRes, lbRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch(`/api/leaderboard/global?mode=${modeToLoad}`, {
          credentials: "include",
        }),
      ]);

      if (meRes.ok) {
        const meData: MeResponse = await meRes.json();
        setMe(meData.user);
      } else {
        setMe(null);
      }

      const lbJson = (await lbRes.json().catch(() => null)) as
        | LeaderboardResponse
        | null;

      if (!lbRes.ok || !lbJson) {
        setError(lbJson?.error || "Failed to load leaderboard.");
        setData(null);
        return;
      }

      if (lbJson.error) {
        setError(lbJson.error);
      }

      setData(lbJson);
    } catch {
      setError("Failed to load leaderboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeaderboard(mode);
  }, [mode]);

  // -----------------------------
  // Load private leagues
  // -----------------------------
  async function loadLeagues() {
    setLeaguesLoading(true);
    setLeaguesError(null);

    try {
      const res = await fetch("/api/leagues", {
        credentials: "include",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as any;
        setLeaguesError(data?.error || "Failed to load your leagues.");
        setLeagues([]);
        return;
      }

      const data = (await res.json()) as ListResponse;
      setLeagues(data.leagues || []);
    } catch {
      setLeaguesError("Failed to load your leagues.");
      setLeagues([]);
    } finally {
      setLeaguesLoading(false);
    }
  }

  useEffect(() => {
    loadLeagues();
  }, []);

  const isGameweek = mode === "gameweek";
  const isOverall = mode === "overall";

  return (
    <main className="space-y-6">
      {/* GLOBAL LEAGUES HEADER */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Global Leagues
            </h2>
            <p className="text-xs text-slate-400 mb-2">
              Track the top monster managers in Fantasy Monster League.
            </p>
            {me ? (
              <p className="text-xs text-emerald-300">
                You&apos;re logged in as{" "}
                <span className="font-mono">{me.email}</span>.
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                <Link
                  href="/login"
                  className="underline underline-offset-2"
                >
                  Log in
                </Link>{" "}
                to see where you rank.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="inline-flex rounded-full bg-slate-900 border border-slate-700 p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setMode("gameweek")}
                className={`px-3 py-1 rounded-full ${
                  isGameweek
                    ? "bg-emerald-400 text-slate-950 font-semibold"
                    : "text-slate-200"
                }`}
              >
                This Gameweek
              </button>
              <button
                type="button"
                onClick={() => setMode("overall")}
                className={`px-3 py-1 rounded-full ${
                  isOverall
                    ? "bg-emerald-400 text-slate-950 font-semibold"
                    : "text-slate-200"
                }`}
              >
                Overall Season
              </button>
            </div>
            <button
              type="button"
              onClick={() => loadLeaderboard(mode)}
              className="text-[11px] text-slate-300 underline underline-offset-2"
            >
              Refresh
            </button>
          </div>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-400">
            {error}
          </p>
        )}
      </section>

      {/* GLOBAL LEAGUES TABLE (RIGHT UNDER GLOBAL LEAGUES) */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        {loading && !data ? (
          <p className="text-sm text-slate-300">
            Loading leaderboard...
          </p>
        ) : !data ? (
          <p className="text-sm text-slate-300">
            Leaderboard is not available.
          </p>
        ) : data.entries.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-300">
              No scores found yet.
            </p>
            {isGameweek && (
              <p className="text-xs text-slate-400">
                Make sure at least one gameweek has been scored via the admin
                tools.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs text-slate-300">
                {data.mode === "gameweek" && data.gameweek ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold">
                      Gameweek {data.gameweek.number}
                    </span>
                    {data.gameweek.name ? ` • ${data.gameweek.name}` : ""}
                  </>
                ) : (
                  <>Showing total points across all gameweeks.</>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Top {data.entries.length} managers
              </div>
            </div>
            <p className="mb-3 text-[11px] text-slate-500">
              Tip: click a manager to view their gameweek pitch and full points
              history.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-700 text-slate-300">
                  <tr>
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Manager</th>
                    <th className="py-2 pr-4 text-right">
                      {data.mode === "gameweek" ? "GW Points" : "Total Points"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, index) => {
                    const isMe = me && entry.userId === me.id;
                    return (
                      <tr
                        key={entry.userId}
                        className={`border-b border-slate-800 last:border-b-0 ${
                          isMe ? "bg-emerald-500/10" : "hover:bg-slate-800/60"
                        }`}
                      >
                        <td className="py-2 pr-4 text-slate-400">
                          #{index + 1}
                        </td>
                        <td className="py-2 pr-4">
                          <Link
                            href={`/managers/${entry.userId}`}
                            className="text-slate-100 hover:text-emerald-300 underline underline-offset-2"
                          >
                            {entry.email}
                          </Link>
                          {isMe && (
                            <span className="ml-2 text-[10px] text-emerald-300">
                              (You)
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
            </div>
          </>
        )}
      </section>

      {/* PRIVATE LEAGUES SECTION: LIST ALL MINI LEAGUES YOU'RE IN */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100 mb-1">
              Private Leagues
            </h2>
            <p className="text-xs text-slate-400">
              These are your invitation-only mini leagues, using the same
              scoring as the Global Leagues.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/leagues"
              className="rounded-full bg-emerald-400 px-4 py-2 text-[11px] font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Create / Join Leagues
            </Link>
          </div>
        </div>

        {leaguesLoading ? (
          <p className="text-xs text-slate-400">
            Loading your private leagues...
          </p>
        ) : leaguesError ? (
          <p className="text-xs text-red-400">
            {leaguesError}
          </p>
        ) : leagues.length === 0 ? (
          <p className="text-xs text-slate-400">
            You&apos;re not in any private leagues yet. Use{" "}
            <span className="font-semibold">Create / Join Leagues</span> to get
            started.
          </p>
        ) : (
          <ul className="space-y-2 text-xs">
            {leagues.map((league) => (
              <li
                key={league.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-100">
                    {league.name}
                    {league.isOwner && (
                      <span className="ml-2 rounded-full border border-amber-400/70 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        Owner
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Code:{" "}
                    <span className="font-mono">
                      {league.code}
                    </span>{" "}
                    • Owner:{" "}
                    {league.isOwner ? "You" : league.ownerEmail}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Members: {league.myRank ? `#${league.myRank}` : "— (no scores yet)"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Link
                    href={`/leagues/${league.id}`}
                    className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                  >
                    View Table
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* FOOTNOTE */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400 space-y-1">
        <p>
          Global Leagues show overall rankings across the entire game, while
          Private Leagues let you compete with friends on the same scoring.
        </p>
        <p>
          Manage your mini leagues from{" "}
          <Link
            href="/leagues"
            className="underline underline-offset-2"
          >
            the Leagues page
          </Link>
          .
        </p>
      </section>
    </main>
  );
}
