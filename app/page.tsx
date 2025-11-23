// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PackOpenModal from "@/components/PackOpenModal";

type MeUser = {
  id: string;
  email: string;
  coins: number;
};

type MeResponse = {
  user: MeUser | null;
};

type SummaryResponse = {
  user: {
    id: string;
    email: string;
    coins: number;
    createdAt: string;
  };
  monsters: {
    totalOwned: number;
  };
  latestGameweek: {
    gameweekId: string;
    number: number;
    name: string | null;
    points: number;
  } | null;
  season: {
    totalPoints: number;
  };
  error?: string;
};

export default function HomePage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [summary, setSummary] =
    useState<SummaryResponse | null>(null);
  const [loading, setLoading] =
    useState<boolean>(true);
  const [error, setError] =
    useState<string | null>(null);

  // Starter-pack state (client-side only)
  const [starterOpenedCount, setStarterOpenedCount] =
    useState(0);
  const [activeStarterModal, setActiveStarterModal] =
    useState<"starter1" | "starter2" | null>(null);
  const [starterError, setStarterError] =
    useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include"
      });

      if (!meRes.ok) {
        setMe(null);
        setSummary(null);
        setLoading(false);
        return;
      }

      const meData: MeResponse = await meRes.json();
      if (!meData.user) {
        setMe(null);
        setSummary(null);
        setLoading(false);
        return;
      }

      setMe(meData.user);

      const sumRes = await fetch(
        "/api/me/summary",
        {
          credentials: "include"
        }
      );

      if (!sumRes.ok) {
        const data = (await sumRes
          .json()
          .catch(() => null)) as
          | SummaryResponse
          | null;
        setError(
          data?.error ||
            "Failed to load manager summary."
        );
        setSummary(null);
      } else {
        const data: SummaryResponse =
          await sumRes.json();
        if (data.error) {
          setError(data.error);
        }
        setSummary(data);
      }
    } catch {
      setError(
        "Error loading dashboard data."
      );
      setMe(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const monstersOwnedBase =
    summary?.monsters?.totalOwned ?? 0;

  // Show starter hero only for a brand new manager
  const showStarterHero =
    !!me &&
    monstersOwnedBase === 0 &&
    starterOpenedCount < 2;

  function openStarterModal(which: "starter1" | "starter2") {
    setStarterError(null);

    // Force Starter Pack 1 first
    if (which === "starter2" && starterOpenedCount === 0) {
      setStarterError(
        "Open Starter Pack 1 before Starter Pack 2."
      );
      return;
    }

    if (starterOpenedCount >= 2) {
      setStarterError(
        "You’ve already opened your 2 starter packs."
      );
      return;
    }

    setActiveStarterModal(which);
  }

  function handleStarterModalClose() {
    setActiveStarterModal(null);
  }

  function handleStarterOpened() {
    // Called after the pack has been successfully opened
    setStarterOpenedCount((prev) =>
      prev < 2 ? prev + 1 : prev
    );
  }

  // ----------------- Logged-out view -----------------
  if (!me) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h1 className="text-2xl font-bold mb-2">
            Fantasy Monster League
          </h1>
          <p className="text-sm text-slate-300 mb-4">
            Build a squad of monsterized Premier
            League stars, open packs, trade on the
            marketplace, and compete in fantasy
            leaderboards every gameweek.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Get Started – Free Packs
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-300"
            >
              Log In
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            How it works
          </h2>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Sign up and open your <b>free starter
              packs</b>.
            </li>
            <li>
              Build your <b>6-a-side monster squad</b>{" "}
              (1 GK, at least 1 in each position).
            </li>
            <li>
              Each gameweek, your monsters score
              points based on real Premier League
              performances.
            </li>
            <li>
              Evolve monsters as their real-life
              player hits milestones, and climb the{" "}
              <b>global leaderboards</b>.
            </li>
            <li>
              Buy and sell monsters on the{" "}
              <b>marketplace</b> to build your dream
              club.
            </li>
          </ol>
        </section>
      </main>
    );
  }

  // ----------------- Logged-in dashboard -----------------
  return (
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">
                Manager Dashboard
              </h1>
              <p className="text-xs text-slate-400 mb-1">
                Welcome back,{" "}
                <span className="font-mono">
                  {me.email}
                </span>
                .
              </p>
              {summary?.user?.createdAt && (
                <p className="text-[11px] text-slate-500">
                  Manager since{" "}
                  {new Date(
                    summary.user.createdAt
                  ).toLocaleDateString()}
                </p>
              )}
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

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <p className="text-[11px] text-slate-400">
                Coins
              </p>
              <p className="mt-1 text-lg font-semibold text-emerald-300 font-mono">
                {summary?.user?.coins ?? me.coins}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Spend coins in the{" "}
                <Link
                  href="/packs"
                  className="underline underline-offset-2"
                >
                  Shop
                </Link>{" "}
                on new monster packs.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <p className="text-[11px] text-slate-400">
                Monsters Owned
              </p>
              <p className="mt-1 text-lg font-semibold text-sky-300 font-mono">
                {monstersOwnedBase}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Manage your squad and collection on the{" "}
                <Link
                  href="/squad"
                  className="underline underline-offset-2"
                >
                  My Squads page
                </Link>
                .
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <p className="text-[11px] text-slate-400">
                Season Progress
              </p>
              <p className="mt-1 text-lg font-semibold text-amber-300 font-mono">
                {summary?.season?.totalPoints ?? 0} pts
              </p>
              {summary?.latestGameweek ? (
                <p className="mt-1 text-[11px] text-slate-300">
                  Latest GW{" "}
                  <span className="font-mono">
                    {summary.latestGameweek.number}
                  </span>
                  :{" "}
                  <span className="font-mono">
                    {
                      summary.latestGameweek
                        .points
                    }{" "}
                    pts
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-300">
                  No gameweek scores yet. Set your
                  squad before the next deadline.
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-400">
                See rankings on{" "}
                <Link
                  href="/leaderboards"
                  className="underline underline-offset-2"
                >
                  Leaderboards
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        {/* Starter packs hero – uses modal cinematic flow */}
        {showStarterHero && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-900/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-emerald-100">
              Welcome! Open your 2 free starter packs
            </h2>
            <p className="text-[11px] text-emerald-200">
              These packs are free and give you enough monsters
              to build your first 6-a-side squad. Tap a pack to
              rip it open and reveal your monsters.
            </p>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() =>
                    openStarterModal("starter1")
                  }
                  className={`w-36 rounded-2xl border px-3 py-3 text-xs text-left transition ${
                    starterOpenedCount >= 1
                      ? "border-emerald-800 bg-emerald-900/40 text-emerald-400 cursor-not-allowed"
                      : "border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-emerald-200">
                    Starter Pack 1
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-100/80">
                    Free • 4 monsters
                  </p>
                  <p className="mt-2 text-[10px] text-emerald-300">
                    {starterOpenedCount >= 1
                      ? "Opened"
                      : "Tap to open"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openStarterModal("starter2")
                  }
                  className={`w-36 rounded-2xl border px-3 py-3 text-xs text-left transition ${
                    starterOpenedCount >= 2
                      ? "border-emerald-800 bg-emerald-900/40 text-emerald-400 cursor-not-allowed"
                      : starterOpenedCount === 0
                      ? "border-emerald-800 bg-emerald-900/40 text-emerald-400 cursor-not-allowed"
                      : "border-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-emerald-200">
                    Starter Pack 2
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-100/80">
                    Free • 4 monsters
                  </p>
                  <p className="mt-2 text-[10px] text-emerald-300">
                    {starterOpenedCount === 0
                      ? "Open Pack 1 first"
                      : starterOpenedCount >= 2
                      ? "Opened"
                      : "Tap to open"}
                  </p>
                </button>
              </div>
              <div className="text-[11px] text-emerald-100 max-w-xs">
                <p>
                  Packs opened:{" "}
                  <span className="font-mono">
                    {starterOpenedCount}/2
                  </span>
                </p>
                <p className="mt-1">
                  After opening both, head to{" "}
                  <Link
                    href="/squad"
                    className="underline underline-offset-2"
                  >
                    My Squads
                  </Link>{" "}
                  to set your first team.
                </p>
                {starterError && (
                  <p className="mt-1 text-red-300">
                    {starterError}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Main tabs */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-100 mb-3">
            Jump back into the action
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Link
              href="/squad"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">
                My Squads
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Set Your 6-a-side Team
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Pick 1 GK and a balanced mix of DEF, MID,
                FWD before each gameweek.
              </p>
            </Link>

            <Link
              href="/leaderboards"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">
                Leaderboards
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                See How You Rank
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Check global standings and your mini-leagues
                for the latest gameweek.
              </p>
            </Link>

            <Link
              href="/marketplace"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">
                Marketplace
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Trade Monsters
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Buy low, sell high, and target key monsters
                for your tactics.
              </p>
            </Link>

            <Link
              href="/packs"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">
                Shop
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Buy Monster Packs
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Use your coins to buy Bronze, Silver, and
                Gold packs and grow your club.
              </p>
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
          <p>
            Need to update scores or test new
            gameweeks? Use the{" "}
            <Link
              href="/admin/tools"
              className="underline underline-offset-2"
            >
              Admin Tools
            </Link>{" "}
            page to trigger FPL scoring and evolution.
          </p>
        </section>
      </main>

      {/* Starter pack modal using same style as shop, but no redirect */}
      {activeStarterModal && (
        <PackOpenModal
          packId="starter"
          onClose={handleStarterModalClose}
          onOpened={() => handleStarterOpened()}
          redirectToSquad={false}
        />
      )}
    </>
  );
}
