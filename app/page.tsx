// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PackOpenModal from "@/components/PackOpenModal";

type MeUser = {
  id: string;
  email: string;
  coins: number;
  username?: string | null;
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

type StreakStatus = {
  currentStreak: number;
  longestStreak: number;
  lastClaimedAt: string | null;
  canClaim: boolean;
};

type StreakResponse = {
  streak?: StreakStatus | null;
  error?: string;
};

type CollectionResponse = {
  monsters: {
    id: string;
    templateCode: string;
    displayName: string;
    realPlayerName: string;
    position: string;
    club: string;
    rarity: string;
    baseAttack: number;
    baseMagic: number;
    baseDefense: number;
    evolutionLevel: number;
  }[];
  starterPacksOpened: number;
};

// ---------- Unclaimed / expired listing types ----------

type UnclaimedMonster = {
  id: string;
  templateCode: string;
  displayName: string;
  realPlayerName: string;
  position: string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
  evolutionLevel: number;
  artBasePath?: string | null;
};

type UnclaimedItem = {
  listingId: string;
  createdAt: string;
  expiresAt: string | null;
  userMonster: UnclaimedMonster;
};

type UnclaimedResponse = {
  items?: UnclaimedItem[];
  error?: string;
};

export default function HomePage() {
  const [me, setMe] = useState<MeUser | null>(null);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [streak, setStreak] = useState<StreakStatus | null>(null);
  const [streakError, setStreakError] = useState<string | null>(null);
  const [claimingStreak, setClaimingStreak] = useState<boolean>(false);
  const [streakMessage, setStreakMessage] = useState<string | null>(null);

  const [starterPacksOpened, setStarterPacksOpened] = useState<number | null>(
    null
  );
  const [starterError, setStarterError] = useState<string | null>(null);
  const [starterMessage, setStarterMessage] = useState<string | null>(null);
  const [showStarterModal, setShowStarterModal] = useState<boolean>(false);

  // NEW: expired listings / unclaimed items
  const [unclaimedItems, setUnclaimedItems] = useState<UnclaimedItem[]>([]);
  const [unclaimedError, setUnclaimedError] = useState<string | null>(null);
  const [unclaimedMessage, setUnclaimedMessage] = useState<string | null>(null);
  const [showUnclaimedModal, setShowUnclaimedModal] = useState<boolean>(false);
  const [selectedUnclaimedId, setSelectedUnclaimedId] = useState<string | null>(
    null
  );
  const [resolvingUnclaimed, setResolvingUnclaimed] =
    useState<boolean>(false);

  async function load() {
    setLoading(true);
    setError(null);
    setStreakError(null);
    setStreakMessage(null);
    setStarterError(null);
    setStarterMessage(null);
    setUnclaimedError(null);
    setUnclaimedMessage(null);

    try {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!meRes.ok) {
        setMe(null);
        setSummary(null);
        setStreak(null);
        setStarterPacksOpened(null);
        setUnclaimedItems([]);
        setLoading(false);
        return;
      }

      const meData: MeResponse = await meRes.json();
      if (!meData.user) {
        setMe(null);
        setSummary(null);
        setStreak(null);
        setStarterPacksOpened(null);
        setUnclaimedItems([]);
        setLoading(false);
        return;
      }

      setMe(meData.user);

      // Manager summary
      const sumRes = await fetch("/api/me/summary", {
        credentials: "include",
      });

      if (!sumRes.ok) {
        const data = (await sumRes.json().catch(() => null)) as
          | SummaryResponse
          | null;
        setError(data?.error || "Failed to load manager summary.");
        setSummary(null);
      } else {
        const data: SummaryResponse = await sumRes.json();
        if (data.error) {
          setError(data.error);
        }
        setSummary(data);
      }

      // Load streak status (only if logged in)
      const streakRes = await fetch("/api/streak", {
        credentials: "include",
      });
      if (streakRes.ok) {
        const s: StreakResponse = await streakRes.json();
        if (s.error) {
          setStreakError(s.error);
          setStreak(null);
        } else if (s.streak) {
          setStreak(s.streak);
        } else {
          setStreak(null);
        }
      } else {
        const s = (await streakRes.json().catch(() => null)) as
          | StreakResponse
          | null;
        if (s?.error) {
          setStreakError(s.error);
        }
        setStreak(null);
      }

      // Load starter pack meta (how many free starter packs opened)
      const colRes = await fetch("/api/me/collection", {
        credentials: "include",
      });
      if (colRes.ok) {
        const colData: CollectionResponse = await colRes.json();
        setStarterPacksOpened(colData.starterPacksOpened ?? 0);
      } else {
        setStarterPacksOpened(null);
      }

      // NEW: load any listings that expired and didn't sell
      const unclaimedRes = await fetch("/api/me/unclaimed-items", {
        credentials: "include",
      });

      if (unclaimedRes.ok) {
        const data: UnclaimedResponse = await unclaimedRes.json();
        if (data.error) {
          setUnclaimedError(data.error);
          setUnclaimedItems([]);
        } else {
          setUnclaimedItems(data.items || []);
        }
      } else {
        const data = (await unclaimedRes.json().catch(() => null)) as
          | UnclaimedResponse
          | null;
        if (data?.error) {
          setUnclaimedError(data.error);
        } else {
          setUnclaimedError("Failed to load items that didn't sell.");
        }
        setUnclaimedItems([]);
      }
    } catch {
      setError("Error loading dashboard data.");
      setMe(null);
      setSummary(null);
      setStreak(null);
      setStreakError("Could not load streak data.");
      setStarterPacksOpened(null);
      setUnclaimedItems([]);
      setUnclaimedError("Could not load items that didn't sell.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleClaimStreak() {
    if (!streak) return;
    setStreakError(null);
    setStreakMessage(null);
    setClaimingStreak(true);

    try {
      const res = await fetch("/api/streak/claim", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setStreakError(data?.error || "Failed to claim daily reward.");
        return;
      }

      const {
        coinsGranted,
        coinsAfter,
        currentStreak,
        longestStreak,
        lastClaimedAt,
      } = data;

      setStreak({
        currentStreak,
        longestStreak,
        lastClaimedAt: lastClaimedAt || null,
        canClaim: false,
      });

      // Update coins in header/dashboard
      setMe((prev) => (prev ? { ...prev, coins: coinsAfter } : prev));
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              user: {
                ...prev.user,
                coins: coinsAfter,
              },
            }
          : prev
      );

      setStreakMessage(
        `Daily reward claimed! You earned ${coinsGranted} coins.`
      );
    } catch {
      setStreakError("Something went wrong claiming the reward.");
    } finally {
      setClaimingStreak(false);
    }
  }

  function handleOpenStarterPack() {
    if (starterPacksOpened === null || starterPacksOpened >= 2) {
      return;
    }
    setStarterError(null);
    setStarterMessage(null);
    setShowStarterModal(true);
  }

  // NEW: resolve a single unclaimed / expired listing
  async function handleResolveUnclaimed(action: "RETURN" | "QUICK_SELL" | "RELIST") {
    if (!selectedUnclaimedId) return;
    setResolvingUnclaimed(true);
    setUnclaimedError(null);
    setUnclaimedMessage(null);

    try {
      const res = await fetch("/api/me/unclaimed-items", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          listingId: selectedUnclaimedId,
          action,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        coinsAfter?: number;
        message?: string;
      } | null;

      if (!res.ok || !data?.ok) {
        setUnclaimedError(data?.error || "Failed to handle that item.");
        return;
      }

      if (typeof data.coinsAfter === "number") {
        setMe((prev) =>
          prev ? { ...prev, coins: data.coinsAfter } : prev
        );
        setSummary((prev) =>
          prev
            ? {
                ...prev,
                user: {
                  ...prev.user,
                  coins: data.coinsAfter,
                },
              }
            : prev
        );
      }

      setUnclaimedItems((prev) =>
        prev.filter((i) => i.listingId !== selectedUnclaimedId)
      );
      setSelectedUnclaimedId(null);

      setUnclaimedMessage(
        data.message ||
          (action === "RETURN"
            ? "Monster returned to your collection."
            : action === "QUICK_SELL"
            ? "Monster quick-sold for coins."
            : "Monster relisted on the marketplace.")
      );
    } catch {
      setUnclaimedError("Something went wrong handling that item.");
    } finally {
      setResolvingUnclaimed(false);
    }
  }

  // Logged-out view
  if (!me) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <h1 className="text-2xl font-bold mb-2">Fantasy Monster League</h1>
          <p className="text-sm text-slate-300 mb-4">
            Build a squad of monsterized Premier League stars, open packs, trade
            on the marketplace, and compete in fantasy leaderboards every
            gameweek.
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
              Sign up and open your <b>free starter packs</b>.
            </li>
            <li>
              Build your <b>6-a-side monster squad</b> (1 GK, at least 1 in each
              position).
            </li>
            <li>
              Each gameweek, your monsters score points based on real Premier
              League performances.
            </li>
            <li>
              Evolve monsters as their real-life player hits milestones, and
              climb the <b>global leaderboards</b>.
            </li>
            <li>
              Buy and sell monsters on the <b>marketplace</b> to build your
              dream club.
            </li>
          </ol>
        </section>
      </main>
    );
  }

  // Logged-in dashboard
  const starterAvailable =
    starterPacksOpened !== null && starterPacksOpened < 2;

  return (
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Manager Dashboard</h1>
              <p className="text-xs text-slate-400 mb-1">
                Welcome back,{" "}
                <span className="font-mono">
                  {me.username || me.email}
                </span>
                .
              </p>
              {summary?.user?.createdAt && (
                <p className="text-[11px] text-slate-500">
                  Manager since{" "}
                  {new Date(summary.user.createdAt).toLocaleDateString()}
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
              <p className="text-[11px] text-slate-400">Coins</p>
              <p className="mt-1 text-lg font-semibold text-emerald-300 font-mono">
                {summary?.user?.coins ?? me.coins}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Spend coins on new packs in the{" "}
                <Link
                  href="/packs"
                  className="underline underline-offset-2"
                >
                  Pack Store
                </Link>
                .
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <p className="text-[11px] text-slate-400">Monsters Owned</p>
              <p className="mt-1 text-lg font-semibold text-sky-300 font-mono">
                {summary?.monsters?.totalOwned ?? 0}
              </p>
              <p className="mt-2 text-[11px] text-slate-400">
                Manage your squad and collection on the{" "}
                <Link
                  href="/squad"
                  className="underline underline-offset-2"
                >
                  Squad page
                </Link>
                .
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <p className="text-[11px] text-slate-400">Season Progress</p>
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
                    {summary.latestGameweek.points} pts
                  </span>
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-300">
                  No gameweek scores yet. Set your squad before the next
                  deadline.
                </p>
              )}
              <p className="mt-2 text-[11px] text-slate-400">
                See rankings on the{" "}
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

        {/* Daily streak card */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-100">
                Daily Login Streak
              </p>
              {streak ? (
                <p className="mt-1 text-[11px] text-slate-300">
                  Current streak:{" "}
                  <span className="font-mono text-emerald-300">
                    {streak.currentStreak}
                  </span>{" "}
                  days • Longest:{" "}
                  <span className="font-mono text-sky-300">
                    {streak.longestStreak}
                  </span>{" "}
                  days
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-400">
                  Track your daily logins and earn escalating coin rewards.
                </p>
              )}
              {streakMessage && (
                <p className="mt-1 text-[11px] text-emerald-300">
                  {streakMessage}
                </p>
              )}
              {streakError && (
                <p className="mt-1 text-[11px] text-red-400">
                  {streakError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={claimingStreak || !streak || !streak.canClaim}
                onClick={handleClaimStreak}
                className={`rounded-full px-4 py-2 text-[11px] font-semibold ${
                  claimingStreak || !streak || !streak.canClaim
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                }`}
              >
                {claimingStreak
                  ? "Claiming..."
                  : streak && streak.canClaim
                  ? "Claim today's reward"
                  : "Already claimed today"}
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-slate-500">
            Reward formula:{" "}
            <span className="font-mono text-slate-300">
              50 × current streak
            </span>{" "}
            coins each time you claim.
          </p>
        </section>

        {/* NEW: expired listings / "items that didn't sell" – always visible */}
        <section className="rounded-2xl border border-amber-500/40 bg-amber-950/40 p-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold text-amber-200">
                Listings that didn’t sell
              </p>

              {unclaimedItems.length > 0 ? (
                <>
                  <p className="mt-1 text-[11px] text-amber-100">
                    {unclaimedItems.length === 1
                      ? "1 monster listing expired without a buyer."
                      : `${unclaimedItems.length} monster listings expired without buyers.`}
                  </p>
                  <p className="mt-1 text-[10px] text-amber-200/80">
                    Review them to send monsters back to your collection,
                    quick-sell for coins, or relist on the transfer market.
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-1 text-[11px] text-amber-100">
                    You don’t currently have any expired or failed listings.
                  </p>
                  <p className="mt-1 text-[10px] text-amber-200/80">
                    When a transfer listing expires without a buyer (or is
                    marked as failed), it will appear here so you can decide
                    what to do with the monster.
                  </p>
                </>
              )}

              {unclaimedMessage && (
                <p className="mt-1 text-[11px] text-emerald-300">
                  {unclaimedMessage}
                </p>
              )}
              {unclaimedError && (
                <p className="mt-1 text-[11px] text-red-400">
                  {unclaimedError}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowUnclaimedModal(true)}
                className="rounded-full px-5 py-2 text-[11px] font-semibold bg-amber-400 text-slate-950 border border-amber-300 shadow-lg shadow-amber-400/50 hover:bg-amber-300"
              >
                Review items
              </button>
            </div>
          </div>
        </section>

        {/* Starter packs card – ONLY while there are free packs remaining */}
        {starterAvailable && (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-950/50 p-4 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-emerald-200">
                  Free Starter Packs
                </p>
                <p className="mt-1 text-[11px] text-emerald-100">
                  You can open up to{" "}
                  <span className="font-mono">2</span> free Starter Packs to
                  kickstart your club.
                </p>
                <p className="mt-1 text-[11px] text-emerald-200">
                  Opened so far:{" "}
                  <span className="font-mono">
                    {starterPacksOpened ?? 0}
                  </span>{" "}
                  / 2
                </p>
                {starterMessage && (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    {starterMessage}
                  </p>
                )}
                {starterError && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {starterError}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!starterAvailable || starterPacksOpened === null}
                  onClick={handleOpenStarterPack}
                  className={`relative rounded-full px-5 py-2 text-[11px] font-semibold transition transform ${
                    !starterAvailable || starterPacksOpened === null
                      ? "bg-emerald-900 text-emerald-400/60 cursor-not-allowed border border-emerald-800"
                      : "bg-emerald-400 text-slate-950 border border-emerald-300 shadow-lg shadow-emerald-400/60 hover:bg-emerald-300 hover:shadow-emerald-400/80 hover:-translate-y-0.5"
                  }`}
                >
                  {starterAvailable
                    ? "Open Free Starter Pack"
                    : "All free packs claimed"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[10px] text-emerald-200/80">
              Starter Packs contain random monsters from across the league.
              After you’ve opened both, use your coins to buy Bronze, Silver, or
              Gold packs.
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="text-sm font-semibold text-slate-100 mb-3">
            Jump back into the action
          </h2>
          <div className="grid gap-3 sm:grid-cols-4">
            <Link
              href="/squad"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">Squad</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Set Your 6-a-side Team
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Pick 1 GK and a balanced mix of DEF, MID, FWD before each
                gameweek.
              </p>
            </Link>

            <Link
              href="/packs"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">Packs</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Open Monster Packs
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Use coins to buy Bronze, Silver, and Gold packs to grow your
                club.
              </p>
            </Link>

            <Link
              href="/marketplace"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">Marketplace</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Trade Monsters
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Buy low, sell high, and target key monsters for your tactics.
              </p>
            </Link>

            <Link
              href="/leagues"
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs hover:border-emerald-400 transition-colors"
            >
              <p className="text-[11px] text-slate-400">Leagues</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">
                Join Mini-Leagues
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                Create or join private leagues and compete with friends for
                bragging rights.
              </p>
            </Link>
          </div>
        </section>
      </main>

      {/* NEW: modal for expired / unclaimed listings */}
      {showUnclaimedModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 sm:p-6">
          <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-950/90 ring-1 ring-white/10 p-6">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold">
                Listings that didn’t sell
              </h3>
              <button
                type="button"
                onClick={() => setShowUnclaimedModal(false)}
                className="rounded-lg px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-300">
              Tap a monster card to select it, then choose what you’d like to
              do.
            </p>

            {unclaimedItems.length === 0 ? (
              <p className="mt-4 text-[11px] text-slate-300">
                You don’t currently have any expired or failed listings. Once a
                transfer listing expires without a buyer (or is marked as
                failed), it will show up here so you can return the monster to
                your collection, quick-sell it, or relist it on the market.
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {unclaimedItems.map((item) => {
                  const m = item.userMonster;
                  const selected =
                    item.listingId === selectedUnclaimedId;

                  return (
                    <button
                      key={item.listingId}
                      type="button"
                      onClick={() =>
                        setSelectedUnclaimedId(item.listingId)
                      }
                      className={`text-left rounded-2xl border p-3 bg-slate-900/70 hover:border-emerald-400 transition-colors ${
                        selected
                          ? "border-emerald-400 ring-2 ring-emerald-400/60"
                          : "border-slate-700"
                      }`}
                    >
                      <div className="text-[11px] text-slate-400 mb-1">
                        {m.position} • {m.club}
                      </div>
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {m.displayName}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">
                        {m.realPlayerName}
                      </div>
                      <div className="mt-2 text-[11px] text-slate-300 flex gap-2">
                        <span>ATK {m.baseAttack}</span>
                        <span>MAG {m.baseMagic}</span>
                        <span>DEF {m.baseDefense}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-emerald-300">
                        Rarity: {m.rarity}
                      </div>
                      {item.expiresAt && (
                        <div className="mt-1 text-[10px] text-slate-500">
                          Listing expired{" "}
                          {new Date(
                            item.expiresAt
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-[11px] text-slate-400">
                {selectedUnclaimedId
                  ? "Choose an action for the selected monster."
                  : "Select a monster above to enable the actions."}
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  disabled={!selectedUnclaimedId || resolvingUnclaimed}
                  onClick={() => handleResolveUnclaimed("RETURN")}
                  className={`rounded-full px-4 py-2 text-[11px] font-semibold border ${
                    !selectedUnclaimedId || resolvingUnclaimed
                      ? "border-slate-700 text-slate-500 cursor-not-allowed"
                      : "border-slate-600 text-slate-100 hover:border-emerald-300"
                  }`}
                >
                  Return to collection
                </button>
                <button
                  type="button"
                  disabled={!selectedUnclaimedId || resolvingUnclaimed}
                  onClick={() => handleResolveUnclaimed("QUICK_SELL")}
                  className={`rounded-full px-4 py-2 text-[11px] font-semibold ${
                    !selectedUnclaimedId || resolvingUnclaimed
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  }`}
                >
                  Quick-sell
                </button>
                <button
                  type="button"
                  disabled={!selectedUnclaimedId || resolvingUnclaimed}
                  onClick={() => handleResolveUnclaimed("RELIST")}
                  className={`rounded-full px-4 py-2 text-[11px] font-semibold ${
                    !selectedUnclaimedId || resolvingUnclaimed
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-sky-400 text-slate-950 hover:bg-sky-300"
                  }`}
                >
                  Relist on market
                </button>
              </div>
            </div>

            {unclaimedError && (
              <p className="mt-2 text-[11px] text-red-400">
                {unclaimedError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Starter pack modal */}
      {showStarterModal && (
        <PackOpenModal
          packId="starter"
          redirectToSquad={false}
          onClose={() => setShowStarterModal(false)}
          onOpened={(monsters, coinsAfter) => {
            // increment local starter pack count
            setStarterPacksOpened((prev) => (prev ?? 0) + 1);

            const openedCount = monsters.length;

            // Update coins + total monsters if we have coinsAfter
            if (typeof coinsAfter === "number") {
              setMe((prev) =>
                prev ? { ...prev, coins: coinsAfter } : prev
              );
              setSummary((prev) =>
                prev
                  ? {
                      ...prev,
                      user: {
                        ...prev.user,
                        coins: coinsAfter,
                      },
                      monsters: {
                        totalOwned:
                          (prev.monsters?.totalOwned ?? 0) +
                          openedCount,
                      },
                    }
                  : prev
              );
            }

            setStarterMessage(
              `You opened a free Starter Pack and pulled ${openedCount} monsters!`
            );
          }}
        />
      )}
    </>
  );
}
