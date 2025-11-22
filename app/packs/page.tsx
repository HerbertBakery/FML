"use client";

import { useEffect, useState } from "react";
import { PACK_DEFINITIONS } from "@/lib/packs";
import Link from "next/link";

type User = {
  id: string;
  email: string;
  coins: number;
};

type UserMonsterDTO = {
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
};

type CollectionResponse = {
  monsters: UserMonsterDTO[];
  starterPacksOpened: number;
};

type OpenPackResponse = {
  message?: string;
  error?: string;
  packType?: string;
  coinsAfter?: number;
  monsters?: UserMonsterDTO[];
};

export default function PacksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [starterOpened, setStarterOpened] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [lastPulled, setLastPulled] = useState<UserMonsterDTO[]>(
    []
  );
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadInitial() {
    setLoading(true);
    setError(null);
    setStatus(null);
    setLastPulled([]);

    try {
      const [meRes, colRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/me/collection", {
          credentials: "include"
        })
      ]);

      if (!meRes.ok) {
        setUser(null);
        setCoins(0);
        setError("You must be logged in to open packs.");
        return;
      }

      const meData = await meRes.json();
      const userData: User = meData.user;
      setUser(userData);
      setCoins(userData.coins ?? 0);

      if (colRes.ok) {
        const colData: CollectionResponse =
          await colRes.json();
        setStarterOpened(
          colData.starterPacksOpened ?? 0
        );
      } else {
        setStarterOpened(0);
      }
    } catch {
      setError(
        "Failed to load pack data. Please try again."
      );
      setUser(null);
      setCoins(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  async function handleOpenPack(packId: string) {
    if (!user) {
      setError("You must be logged in to open packs.");
      return;
    }

    setOpening(packId);
    setError(null);
    setStatus(null);
    setLastPulled([]);

    try {
      const res = await fetch("/api/packs/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ packType: packId })
      });

      const data: OpenPackResponse = await res
        .json()
        .catch(() => ({} as OpenPackResponse));

      if (!res.ok || data.error) {
        const msg =
          data.error || "Failed to open pack.";
        setError(msg);
        return;
      }

      if (typeof data.coinsAfter === "number") {
        setCoins(data.coinsAfter);
      }

      if (data.packType === "starter") {
        setStarterOpened((prev) => prev + 1);
      }

      if (data.monsters && data.monsters.length > 0) {
        setLastPulled(data.monsters);
        setStatus(
          data.message ||
            `Opened ${data.monsters.length} monsters!`
        );
      } else {
        setStatus(
          data.message || "Pack opened, but no monsters?"
        );
      }
    } catch {
      setError(
        "Error opening pack. Please try again."
      );
    } finally {
      setOpening(null);
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading pack store...
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Sign in to open packs
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            Log in to claim your free starter packs and buy
            more using coins.
          </p>
          <div className="flex gap-3">
            <Link
              href="/register"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-300"
            >
              Log In
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const starterRemaining = Math.max(
    0,
    2 - starterOpened
  );

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Pack Store
            </h2>
            <p className="text-xs text-slate-400 mb-2">
              Open packs to grow your Fantasy Monster League
              club.
            </p>
            <p className="text-xs text-emerald-300">
              Coins:{" "}
              <span className="font-mono font-semibold">
                {coins}
              </span>
            </p>
            <p className="text-xs text-slate-300 mt-1">
              Starter packs remaining:{" "}
              <span className="font-mono">
                {starterRemaining}
              </span>{" "}
              / 2
            </p>
          </div>
          <button
            type="button"
            onClick={loadInitial}
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
        {status && (
          <p className="mt-2 text-xs text-emerald-300">
            {status}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 mb-1">
          Available Packs
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {PACK_DEFINITIONS.map((pack) => {
            const disabled =
              pack.id === "starter" &&
              starterRemaining <= 0;

            const isOpening = opening === pack.id;

            return (
              <div
                key={pack.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">
                      {pack.name}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase">
                      {pack.id}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {pack.description}
                  </p>
                  <p className="text-[11px] text-slate-200 mt-2">
                    Contains:{" "}
                    <span className="font-mono">
                      {pack.size}
                    </span>{" "}
                    monsters
                  </p>
                  <p className="text-[11px] text-slate-200">
                    Cost:{" "}
                    {pack.cost === 0 ? (
                      <span className="text-emerald-300">
                        FREE
                      </span>
                    ) : (
                      <span className="font-mono">
                        {pack.cost} coins
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <button
                    type="button"
                    disabled={disabled || isOpening}
                    onClick={() =>
                      handleOpenPack(pack.id)
                    }
                    className={`mt-2 w-full rounded-full px-3 py-1 text-[11px] font-semibold ${
                      disabled || isOpening
                        ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                        : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                    }`}
                  >
                    {isOpening
                      ? "Opening..."
                      : pack.id === "starter"
                      ? disabled
                        ? "No Starter Packs Left"
                        : "Open Starter Pack"
                      : "Buy & Open Pack"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {lastPulled.length > 0 && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="font-semibold text-slate-100 mb-1">
            Latest Pack Results
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {lastPulled.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">
                    {m.displayName}
                  </span>
                  <span className="text-[10px] uppercase text-emerald-300">
                    {m.rarity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {m.realPlayerName} • {m.club}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {m.position} • ATK {m.baseAttack} • MAG{" "}
                  {m.baseMagic} • DEF {m.baseDefense}
                </p>
                <p className="text-[10px] text-emerald-300 mt-1">
                  Evo Lv. {m.evolutionLevel}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
