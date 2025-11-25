// app/monsters/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import MonsterCard, {
  MonsterCardMonster,
} from "@/components/MonsterCard";

type MonsterHistoryItem = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  actor: {
    id: string;
    email: string;
    username: string | null;
  };
};

type MonsterDetail = {
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
  totalGoals: number;
  totalAssists: number;
  totalCleanSheets: number;
  totalFantasyPoints: number;
  isConsumed: boolean;
  createdAt: string;
  owner: {
    id: string;
    email: string;
    username: string | null;
  };
  marketplace: {
    isListed: boolean;
    listingId?: string;
    price?: number;
  };
  history: MonsterHistoryItem[];
};

type ApiResponse = {
  monster?: MonsterDetail;
  error?: string;
};

export default function MonsterDetailPage() {
  const params = useParams();
  const monsterId = params?.id as string | undefined;

  const [monster, setMonster] = useState<MonsterDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(
    null
  );

  async function load() {
    if (!monsterId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/monsters/${monsterId}`, {
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.monster) {
        setError(json.error || "Failed to load monster.");
        setMonster(null);
        return;
      }

      setMonster(json.monster);
    } catch {
      setError("Failed to load monster.");
      setMonster(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monsterId]);

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading monster...
          </p>
        </section>
      </main>
    );
  }

  if (error || !monster) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-red-500/40 bg-red-900/30 p-5">
          <p className="text-sm text-red-100 mb-3">
            {error || "Monster not found."}
          </p>
          <Link
            href="/"
            className="text-xs text-emerald-300 underline underline-offset-2"
          >
            Back to home
          </Link>
        </section>
      </main>
    );
  }

  const monsterForCard: MonsterCardMonster = {
    displayName: monster.displayName,
    realPlayerName: monster.realPlayerName,
    position: monster.position,
    club: monster.club,
    rarity: monster.rarity,
    baseAttack: monster.baseAttack,
    baseMagic: monster.baseMagic,
    baseDefense: monster.baseDefense,
    evolutionLevel: monster.evolutionLevel,
  };

  const ownerLabel =
    monster.owner.username ||
    monster.owner.email ||
    "Manager";

  const createdDate = new Date(
    monster.createdAt
  ).toLocaleString();

  return (
    <main className="space-y-6">
      {/* Header + summary */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold mb-1">
              {monster.displayName}
            </h1>
            <p className="text-xs text-slate-400 mb-1">
              {monster.realPlayerName} •{" "}
              {monster.club} • {monster.position}
            </p>
            <p className="text-[11px] text-slate-500">
              Owned by{" "}
              <span className="font-semibold text-slate-200">
                {ownerLabel}
              </span>
              {" • "}Created: {createdDate}
            </p>
            {monster.isConsumed && (
              <p className="mt-1 text-[11px] text-amber-300">
                This monster has been consumed in a Squad
                Builder Challenge.
              </p>
            )}
            {monster.marketplace.isListed && (
              <p className="mt-1 text-[11px] text-emerald-300">
                Currently listed on the marketplace for{" "}
                <span className="font-mono font-semibold">
                  {monster.marketplace.price}
                </span>{" "}
                coins.
              </p>
            )}
          </div>

          <Link
            href="/"
            className="text-[11px] text-slate-300 underline underline-offset-2"
          >
            Back to home
          </Link>
        </div>
      </section>

      {/* Monster core stats card */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="max-w-md">
          <MonsterCard monster={monsterForCard}>
            <div className="text-[11px] text-slate-300 space-y-1">
              <p>
                Total fantasy points:{" "}
                <span className="font-mono font-semibold">
                  {monster.totalFantasyPoints}
                </span>
              </p>
              <p className="text-[10px] text-slate-400">
                G: {monster.totalGoals} • A:{" "}
                {monster.totalAssists} • CS:{" "}
                {monster.totalCleanSheets}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Monster ID:{" "}
                <span className="font-mono">
                  {monster.id}
                </span>
              </p>
            </div>
          </MonsterCard>
        </div>
      </section>

      {/* History timeline */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100 mb-1">
          Monster History
        </h2>
        {monster.history.length === 0 ? (
          <p className="text-xs text-slate-400">
            No history recorded for this monster yet.
          </p>
        ) : (
          <div className="space-y-2">
            {monster.history.map((h) => {
              const dateStr = new Date(
                h.createdAt
              ).toLocaleString();
              const actorName =
                h.actor.username ||
                h.actor.email ||
                "Unknown manager";

              return (
                <div
                  key={h.id}
                  className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] uppercase font-semibold text-emerald-300">
                      {h.action}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {dateStr}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-200">
                    {h.description}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    By{" "}
                    <span className="font-semibold">
                      {actorName}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
