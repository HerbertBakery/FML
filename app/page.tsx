"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: string;
  email: string;
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
};

type OpenPackResponse = {
  packType: "STARTER";
  monsters: UserMonsterDTO[];
};

type CollectionResponse = {
  monsters: UserMonsterDTO[];
  starterPacksOpened: number;
};

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  const [packsOpened, setPacksOpened] = useState(0);
  const [opening, setOpening] = useState(false);
  const [lastPack, setLastPack] = useState<UserMonsterDTO[] | null>(
    null
  );
  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const maxStarterPacks = 2;

  const canOpenPack =
    !!user && packsOpened < maxStarterPacks && !opening;

  useEffect(() => {
    const loadUserAndCollection = async () => {
      try {
        const meRes = await fetch("/api/auth/me", {
          credentials: "include"
        });

        if (!meRes.ok) {
          setUser(null);
          setCollection([]);
          setPacksOpened(0);
          return;
        }

        const meData = await meRes.json();
        setUser(meData.user);

        const colRes = await fetch("/api/me/collection", {
          credentials: "include"
        });

        if (colRes.ok) {
          const colData: CollectionResponse = await colRes.json();
          setCollection(colData.monsters);
          setPacksOpened(colData.starterPacksOpened);
        } else {
          setCollection([]);
          setPacksOpened(0);
        }
      } catch {
        setUser(null);
        setCollection([]);
        setPacksOpened(0);
      } finally {
        setCheckingUser(false);
      }
    };

    loadUserAndCollection();
  }, []);

  async function handleOpenPack() {
    if (!canOpenPack) return;

    setOpening(true);
    setLastPack(null);

    try {
      const res = await fetch("/api/packs/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "include",
        body: JSON.stringify({ packType: "STARTER" })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        console.error("Failed to open pack", res.status, data);
        return;
      }

      const data: OpenPackResponse = await res.json();
      setLastPack(data.monsters);
      setCollection((prev) => [...data.monsters, ...prev]); // newest first
      setPacksOpened((prev) => prev + 1);
    } catch (err) {
      console.error("Error opening pack", err);
    } finally {
      setOpening(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
    } catch {
      // ignore
    } finally {
      setUser(null);
      setCollection([]);
      setPacksOpened(0);
      setLastPack(null);
    }
  }

  if (checkingUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading your manager profile...
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
            Welcome to Fantasy Monster League
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            To start opening packs, collecting monsters, and building
            your squad, create a free account or log in.
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

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Welcome back, Monster Manager
            </h2>
            <p className="text-xs text-slate-400 mb-1">
              Signed in as <span className="font-mono">{user.email}</span>
            </p>
            <p className="text-sm text-slate-300">
              Open packs, collect monsterized Premier League stars, and
              soon you&apos;ll be able to field squads and compete in
              fantasy leagues.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-slate-600 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-red-400 hover:text-red-300"
          >
            Log Out
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-emerald-300">
              Starter Packs ({packsOpened}/{maxStarterPacks})
            </h3>
            <p className="text-xs text-emerald-100">
              You can only open two free starter packs per account.
            </p>
          </div>
          <button
            type="button"
            disabled={!canOpenPack}
            onClick={handleOpenPack}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition
              ${
                canOpenPack
                  ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
          >
            {opening
              ? "Opening..."
              : packsOpened >= maxStarterPacks
              ? "All Packs Opened"
              : "Open Starter Pack"}
          </button>
        </div>

        {lastPack && (
          <div className="mt-3">
            <h4 className="text-xs font-semibold text-emerald-200 mb-2">
              Latest Pack (saved to your account)
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              {lastPack.map((monster) => (
                <div
                  key={monster.id}
                  className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">
                      {monster.displayName}
                    </span>
                    <span className="text-[10px] uppercase text-emerald-300">
                      {monster.rarity}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {monster.realPlayerName} • {monster.club}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {monster.position} • ATK {monster.baseAttack} • MAG{" "}
                    {monster.baseMagic} • DEF {monster.baseDefense}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="font-semibold mb-2">Your Monster Collection</h3>
        {collection.length === 0 ? (
          <p className="text-xs text-slate-400">
            You don&apos;t own any monsters yet. Open your starter packs
            to begin your squad.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {collection.map((monster) => (
              <div
                key={monster.id}
                className="rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold">
                    {monster.displayName}
                  </span>
                  <span className="text-[10px] uppercase text-emerald-300">
                    {monster.rarity}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  {monster.realPlayerName} • {monster.club}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  {monster.position} • ATK {monster.baseAttack} • MAG{" "}
                  {monster.baseMagic} • DEF {monster.baseDefense}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
