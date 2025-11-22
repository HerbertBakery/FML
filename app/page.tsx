"use client";

import { useState } from "react";

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

export default function HomePage() {
  const [packsOpened, setPacksOpened] = useState(0);
  const [opening, setOpening] = useState(false);
  const [lastPack, setLastPack] = useState<UserMonsterDTO[] | null>(
    null
  );
  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const maxStarterPacks = 2;

  const canOpenPack = packsOpened < maxStarterPacks && !opening;

  async function handleOpenPack() {
    if (!canOpenPack) return;

    setOpening(true);
    setLastPack(null);

    try {
      const res = await fetch("/api/packs/open", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packType: "STARTER" }),
      });

      if (!res.ok) {
        console.error("Failed to open pack", res.status);
        return;
      }

      const data: OpenPackResponse = await res.json();
      setLastPack(data.monsters);
      setCollection((prev) => [...prev, ...data.monsters]);
      setPacksOpened((prev) => prev + 1);
    } catch (err) {
      console.error("Error opening pack", err);
    } finally {
      setOpening(false);
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="text-xl font-semibold mb-2">
          Welcome, Monster Manager
        </h2>
        <p className="text-sm text-slate-300">
          This is the early build of{" "}
          <span className="font-semibold">Fantasy Monster League</span> —{" "}
          fantasy Premier League with monsterized players, packs, and a
          persistent collection (saved in Postgres).
        </p>
      </section>

      <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-emerald-300">
              Starter Packs ({packsOpened}/{maxStarterPacks})
            </h3>
            <p className="text-xs text-emerald-100">
              New managers get two free starter packs to build their first
              squad. Currently using a demo account.
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
              Latest Pack (saved to DB)
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
            You don&apos;t own any monsters yet (demo user). Open your
            starter packs to begin your squad.
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
