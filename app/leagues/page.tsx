"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type League = {
  id: string;
  name: string;
  code: string;
  ownerEmail: string;
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

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-2">
          Mini Leagues
        </h2>
        <p className="text-sm text-slate-300">
          Create a private league for your friends or join one with a
          code. League tables use the same gameweek scores as the
          global leaderboard.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="font-semibold text-slate-100">
            Create a League
          </h3>
          <p className="text-xs text-slate-400">
            You&apos;ll get a unique code to share with your friends.
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
            Ask your friend for their league code and enter it here.
          </p>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="ABC123"
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-50 uppercase"
          />
          <button
            type="button"
            onClick={handleJoinLeague}
            className="rounded-full bg-sky-400 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-sky-300"
          >
            Join League
          </button>
          {joinStatus && (
            <p className="text-xs text-emerald-300">
              {joinStatus}
            </p>
          )}
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
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
              >
                <div>
                  <div className="font-semibold text-slate-100">
                    {league.name}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Code:{" "}
                    <span className="font-mono">
                      {league.code}
                    </span>{" "}
                    • Owner: {league.ownerEmail}
                  </div>
                </div>
                <Link
                  href={`/leagues/${league.id}`}
                  className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                >
                  View Table
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
