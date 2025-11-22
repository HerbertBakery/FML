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

export default function LeaderboardsPage() {
  const [mode, setMode] = useState<Mode>("gameweek");
  const [data, setData] =
    useState<LeaderboardResponse | null>(null);
  const [me, setMe] =
    useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function load(modeToLoad: Mode) {
    setLoading(true);
    setError(null);

    try {
      const [meRes, lbRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch(`/api/leaderboard/global?mode=${modeToLoad}`, {
          credentials: "include"
        })
      ]);

      if (meRes.ok) {
        const meData: MeResponse = await meRes.json();
        setMe(meData.user);
      } else {
        setMe(null);
      }

      const lbJson = (await lbRes
        .json()
        .catch(() => null)) as LeaderboardResponse | null;

      if (!lbRes.ok || !lbJson) {
        setError(
          lbJson?.error ||
            "Failed to load leaderboard."
        );
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
    load(mode);
  }, [mode]);

  const isGameweek = mode === "gameweek";
  const isOverall = mode === "overall";

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Global Leaderboards
            </h2>
            <p className="text-xs text-slate-400 mb-2">
              Track the top monster managers in Fantasy
              Monster League.
            </p>
            {me ? (
              <p className="text-xs text-emerald-300">
                You&apos;re logged in as{" "}
                <span className="font-mono">
                  {me.email}
                </span>
                .
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
              onClick={() => load(mode)}
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
                Make sure at least one gameweek has been
                scored via the admin tools.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-slate-300">
                {data.mode === "gameweek" &&
                data.gameweek ? (
                  <>
                    Showing{" "}
                    <span className="font-semibold">
                      Gameweek {data.gameweek.number}
                    </span>
                    {data.gameweek.name
                      ? ` • ${data.gameweek.name}`
                      : ""}
                  </>
                ) : (
                  <>Showing total points across all gameweeks.</>
                )}
              </div>
              <div className="text-[11px] text-slate-400">
                Top {data.entries.length} managers
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-700 text-slate-300">
                  <tr>
                    <th className="py-2 pr-4">Rank</th>
                    <th className="py-2 pr-4">Manager</th>
                    <th className="py-2 pr-4 text-right">
                      {data.mode === "gameweek"
                        ? "GW Points"
                        : "Total Points"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((entry, index) => {
                    const isMe =
                      me && entry.userId === me.id;
                    return (
                      <tr
                        key={entry.userId}
                        className={`border-b border-slate-800 last:border-b-0 ${
                          isMe
                            ? "bg-emerald-500/10"
                            : ""
                        }`}
                      >
                        <td className="py-2 pr-4 text-slate-400">
                          #{index + 1}
                        </td>
                        <td className="py-2 pr-4">
                          <span className="text-slate-100">
                            {entry.email}
                          </span>
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

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400 space-y-1">
        <p>
          This global leaderboard uses the same scores as
          your mini-leagues.
        </p>
        <p>
          To compete with friends, create or join a league
          from{" "}
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
