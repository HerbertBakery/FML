// app/challenges/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type Challenge = {
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
  completedCount: number;
};

type ChallengeResponse = {
  challenge?: Challenge;
  error?: string;
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
  starterPacksOpened?: number;
};

export default function ChallengeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = params?.id as string;

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Load challenge
      const cRes = await fetch(`/api/challenges/${challengeId}`, {
        credentials: "include"
      });
      const cJson = (await cRes.json()) as ChallengeResponse;

      if (!cRes.ok || !cJson.challenge) {
        setError(cJson.error || "Challenge not found.");
        setChallenge(null);
        setCollection([]);
        return;
      }

      setChallenge(cJson.challenge);

      // Load collection
      const colRes = await fetch("/api/me/collection", {
        credentials: "include"
      });
      if (colRes.ok) {
        const colJson = (await colRes.json()) as CollectionResponse;
        setCollection(colJson.monsters || []);
      } else {
        setCollection([]);
      }
    } catch {
      setError("Failed to load challenge or collection.");
      setChallenge(null);
      setCollection([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!challengeId) return;
    load();
  }, [challengeId]);

  function toggleSelect(id: string) {
    setError(null);
    setSuccess(null);
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  const selectedMonsters = useMemo(
    () => collection.filter((m) => selectedIds.includes(m.id)),
    [collection, selectedIds]
  );

  const meetsRequirements = useMemo(() => {
    if (!challenge) return false;
    const count = selectedMonsters.length;
    if (count < challenge.minMonsters) return false;

    if (challenge.requiredPosition) {
      const requiredPos = challenge.requiredPosition.toUpperCase();
      const hasPos = selectedMonsters.some(
        (m) => m.position.toUpperCase() === requiredPos
      );
      if (!hasPos) return false;
    }

    if (challenge.requiredClub) {
      const requiredClub = challenge.requiredClub.toUpperCase();
      const hasClub = selectedMonsters.some(
        (m) => m.club.toUpperCase() === requiredClub
      );
      if (!hasClub) return false;
    }

    if (challenge.minRarity) {
      const min = challenge.minRarity.toUpperCase();
      const order = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
      const minIdx = order.indexOf(min);
      if (minIdx !== -1) {
        for (const m of selectedMonsters) {
          const idx = order.indexOf(m.rarity.toUpperCase());
          if (idx !== -1 && idx < minIdx) {
            return false;
          }
        }
      }
    }

    return true;
  }, [challenge, selectedMonsters]);

  async function handleSubmit() {
    if (!challenge) return;
    setError(null);
    setSuccess(null);

    if (!meetsRequirements) {
      setError(
        "Your selected monsters do not meet the challenge requirements."
      );
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          userMonsterIds: selectedIds
        })
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setError(
          json?.error || "Failed to submit challenge."
        );
        return;
      }

      const coinsGranted = json.coinsGranted ?? 0;
      setSuccess(
        coinsGranted > 0
          ? `Challenge completed! You earned ${coinsGranted} coins.`
          : "Challenge completed!"
      );

      // Remove burned monsters from local collection
      setCollection((prev) =>
        prev.filter((m) => !selectedIds.includes(m.id))
      );
      setSelectedIds([]);
    } catch (err) {
      setError("Something went wrong submitting the challenge.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading challenge...
          </p>
        </section>
      </main>
    );
  }

  if (error && !challenge) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-red-500/40 bg-red-900/30 p-5">
          <p className="text-sm text-red-100 mb-3">{error}</p>
          <Link
            href="/challenges"
            className="text-xs text-emerald-300 underline"
          >
            Back to challenges
          </Link>
        </section>
      </main>
    );
  }

  if (!challenge) return null;

  const rewardText =
    challenge.rewardType === "coins"
      ? `${challenge.rewardValue} coins`
      : `${challenge.rewardType} (${challenge.rewardValue})`;

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold mb-1">
              {challenge.name}
            </h1>
            <p className="text-xs text-slate-400 mb-2">
              {challenge.description}
            </p>
            <p className="text-[11px] text-amber-300">
              Reward: {rewardText}
            </p>
            {challenge.completedCount > 0 && (
              <p className="mt-1 text-[11px] text-emerald-300">
                You have completed this challenge{" "}
                {challenge.completedCount} time
                {challenge.completedCount > 1 ? "s" : ""}.
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/challenges"
              className="text-[11px] text-slate-300 underline underline-offset-2"
            >
              Back to all challenges
            </Link>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-slate-400 space-y-1">
          <p className="font-semibold text-slate-200">
            Requirements:
          </p>
          <ul className="list-disc list-inside">
            <li>
              At least {challenge.minMonsters} monsters
              (selected: {selectedMonsters.length})
            </li>
            {challenge.requiredPosition && (
              <li>
                Must include at least one{" "}
                {challenge.requiredPosition}
              </li>
            )}
            {challenge.requiredClub && (
              <li>
                Must include at least one from club{" "}
                {challenge.requiredClub}
              </li>
            )}
            {challenge.minRarity && (
              <li>
                All monsters must be at least{" "}
                {challenge.minRarity} rarity
              </li>
            )}
          </ul>
        </div>

        <div className="mt-3 text-[11px] text-slate-400">
          <p>
            Selected monsters will be{" "}
            <span className="text-amber-300 font-semibold">
              permanently removed
            </span>{" "}
            from your collection if the challenge is
            successfully completed.
          </p>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-400">{error}</p>
        )}
        {success && (
          <p className="mt-2 text-xs text-emerald-300">
            {success}
          </p>
        )}

        <button
          type="button"
          disabled={submitting || !meetsRequirements}
          onClick={handleSubmit}
          className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold ${
            submitting || !meetsRequirements
              ? "bg-slate-800 text-slate-500 cursor-not-allowed"
              : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
          }`}
        >
          {submitting
            ? "Submitting..."
            : "Submit Squad & Claim Reward"}
        </button>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100 mb-2">
          Your Collection
        </h2>
        {collection.length === 0 ? (
          <p className="text-xs text-slate-400">
            You don&apos;t have any monsters to submit yet. Open
            more packs first.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {collection.map((m) => {
              const selected = selectedIds.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleSelect(m.id)}
                  className={`text-left rounded-xl border p-3 text-xs transition ${
                    selected
                      ? "border-emerald-400 bg-emerald-500/10"
                      : "border-slate-700 bg-slate-950/60 hover:border-emerald-400"
                  }`}
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
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
