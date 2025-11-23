"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

type CreateResponse = {
  id?: string;
  name?: string;
  code?: string;
  error?: string;
};

type JoinResponse = CreateResponse;

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(
    null
  );
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadLeagues() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leagues", {
        credentials: "include"
      });
      if (!res.ok) {
        const data = (await res
          .json()
          .catch(() => null)) as any;
        setError(
          data?.error || "Failed to load your leagues."
        );
        setLeagues([]);
        return;
      }
      const data = (await res.json()) as ListResponse;
      setLeagues(data.leagues || []);
    } catch {
      setError("Failed to load your leagues.");
      setLeagues([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeagues();
  }, []);

  async function handleCreateLeague() {
    setCreateStatus(null);
    setError(null);
    const name = createName.trim();
    if (!name) {
      setCreateStatus("Enter a league name first.");
      return;
    }

    try {
      const res = await fetch("/api/leagues", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ name })
      });

      const data = (await res
        .json()
        .catch(() => null)) as CreateResponse | null;

      if (!res.ok || !data) {
        setCreateStatus(
          data?.error ||
            "Failed to create league. Are you logged in?"
        );
        return;
      }

      setCreateStatus(
        `League created: ${data.name} (Code: ${data.code})`
      );
      setCreateName("");
      await loadLeagues();
    } catch {
      setCreateStatus("Failed to create league.");
    }
  }

  async function handleJoinLeague() {
    setJoinStatus(null);
    setError(null);
    const code = joinCode.trim();
    if (!code) {
      setJoinStatus("Enter a league code first.");
      return;
    }

    try {
      const res = await fetch("/api/leagues/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ code })
      });

      const data = (await res
        .json()
        .catch(() => null)) as JoinResponse | null;

      if (!res.ok || !data) {
        setJoinStatus(
          data?.error || "Failed to join league."
        );
        return;
      }

      setJoinStatus(
        `Joined league: ${data.name} (Code: ${data.code})`
      );
      setJoinCode("");
      await loadLeagues();
    } catch {
      setJoinStatus("Failed to join league.");
    }
  }

  async function handleLeaveLeague(league: League) {
    setError(null);

    const confirmed = window.confirm(
      `Leave "${league.name}"? You can re-join later with the league code if you have it.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch("/api/leagues/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ leagueId: league.id })
      });

      const data = (await res
        .json()
        .catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        setError(
          data?.error || "Failed to leave league."
        );
        return;
      }

      await loadLeagues();
    } catch {
      setError("Failed to leave league.");
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-2">
          Mini Leagues
        </h2>
        <p className="text-sm text-slate-300">
          Create private mini-leagues with your friends and compete
          on the same scoring system as the global leaderboard.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h3 className="font-semibold text-slate-100">
              Create a League
            </h3>
            <p className="text-xs text-slate-400">
              You&apos;ll be the owner and automatically added as a
              member. Share the code so your friends can join.
            </p>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="League name"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50"
            />
            <button
              type="button"
              onClick={handleCreateLeague}
              className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Create League
            </button>
            {createStatus && (
              <p className="text-xs text-emerald-300">
                {createStatus}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h3 className="font-semibold text-slate-100">
              Join a League
            </h3>
            <p className="text-xs text-slate-400">
              Ask your friend for their league code and enter it
              here.
            </p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="League code (e.g. ABC123)"
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50"
            />
            <button
              type="button"
              onClick={handleJoinLeague}
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-200"
            >
              Join League
            </button>
            {joinStatus && (
              <p className="text-xs text-emerald-300">
                {joinStatus}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="font-semibold mb-2">
          Your Leagues
        </h3>
        {loading ? (
          <p className="text-xs text-slate-400">
            Loading your leagues...
          </p>
        ) : error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : leagues.length === 0 ? (
          <p className="text-xs text-slate-400">
            You&apos;re not in any leagues yet. Create one or join
            with a code.
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
                    {league.isOwner
                      ? "You"
                      : league.ownerEmail}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Members: {league.memberCount} • Your rank:{" "}
                    {league.myRank
                      ? `#${league.myRank}`
                      : "— (no scores yet)"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Link
                    href={`/leagues/${league.id}`}
                    className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                  >
                    View Table
                  </Link>
                  {!league.isOwner && (
                    <button
                      type="button"
                      onClick={() => handleLeaveLeague(league)}
                      className="text-[10px] text-red-400 hover:text-red-300"
                    >
                      Leave league
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
