// app/challenges/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ChallengeSummary = {
  id: string;
  code: string;
  name: string;
  description: string;
  minMonsters: number;
  minRarity: string | null;
  requiredPosition: string | null;
  requiredClub: string | null;
  rewardType: string;
  rewardValue: string;
  isRepeatable: boolean;
  isActive: boolean;
  completedCount: number;
  canSubmit: boolean;
};

type ChallengesResponse = {
  challenges: ChallengeSummary[];
  error?: string;
};

export default function ChallengesPage() {
  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] =
    useState<ChallengeSummary[]>([]);
  const [error, setError] =
    useState<string | null>(null);

  async function loadChallenges() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/challenges", {
        credentials: "include",
      });

      const data =
        (await res.json()) as ChallengesResponse;

      if (!res.ok) {
        setError(
          data.error || "Failed to load challenges."
        );
        setChallenges([]);
        return;
      }

      setChallenges(data.challenges || []);
    } catch {
      setError("Failed to load challenges.");
      setChallenges([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChallenges();
  }, []);

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading Squad Builder Challenges...
          </p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-red-500/40 bg-red-900/30 p-5">
          <p className="text-sm text-red-100">
            {error}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h1 className="text-xl font-semibold mb-1">
          Squad Builder Challenges
        </h1>
        <p className="text-xs text-slate-400">
          Turn in selected monsters from your collection to
          earn rewards and clean up your club, just like FUT
          SBCs.
        </p>
      </section>

      {challenges.length === 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            No active challenges right now. Check back later!
          </p>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {challenges.map((c) => {
              const rewardText =
                c.rewardType === "coins"
                  ? `${c.rewardValue} coins`
                  : `${c.rewardType} (${c.rewardValue})`;

              const constraints: string[] = [];
              if (c.minMonsters > 0)
                constraints.push(
                  `At least ${c.minMonsters} monsters`
                );
              if (c.requiredPosition)
                constraints.push(
                  `Includes a ${c.requiredPosition}`
                );
              if (c.requiredClub)
                constraints.push(
                  `Includes a player from ${c.requiredClub}`
                );
              if (c.minRarity)
                constraints.push(
                  `All at least ${c.minRarity} rarity`
                );

              const isOneTime = !c.isRepeatable;
              const isCompletedOnce =
                c.completedCount > 0;
              const isLocked =
                isOneTime && isCompletedOnce;

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {c.name}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {c.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.completedCount > 0 && (
                        <span className="rounded-full bg-emerald-500/10 border border-emerald-400 text-[10px] px-2 py-0.5 text-emerald-300">
                          {c.isRepeatable
                            ? `Completed ${c.completedCount}x`
                            : "Completed"}
                        </span>
                      )}
                      <span
                        className={`rounded-full text-[10px] px-2 py-0.5 border ${
                          c.isRepeatable
                            ? "bg-sky-500/10 border-sky-400 text-sky-300"
                            : "bg-slate-800 border-slate-500 text-slate-200"
                        }`}
                      >
                        {c.isRepeatable
                          ? "Repeatable"
                          : "One-time"}
                      </span>
                    </div>
                  </div>

                  {constraints.length > 0 && (
                    <p className="text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-200">
                        Requirements:
                      </span>{" "}
                      {constraints.join(" • ")}
                    </p>
                  )}

                  <p className="text-[10px] text-amber-300">
                    Reward: {rewardText}
                  </p>

                  <div className="mt-2 flex justify-end">
                    {isLocked ? (
                      <button
                        type="button"
                        disabled
                        className="rounded-full bg-slate-800 text-slate-500 px-3 py-1 text-[11px] font-semibold cursor-not-allowed"
                      >
                        Completed (one-time)
                      </button>
                    ) : (
                      <Link
                        href={`/challenges/${c.id}`}
                        className="rounded-full bg-emerald-400 text-slate-950 px-3 py-1 text-[11px] font-semibold hover:bg-emerald-300"
                      >
                        Build Squad
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
