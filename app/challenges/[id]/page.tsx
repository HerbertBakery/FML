// app/challenges/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import MonsterDetailModal from "@/components/MonsterDetailModal";
import MonsterCard from "@/components/MonsterCard";

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
  isRepeatable: boolean;
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

  // align with collection / marketplace DTO
  artBasePath?: string | null;
  setCode?: string | null;
  editionType?: string | null;
  editionLabel?: string | null;
  serialNumber?: number | null;
};

type CollectionResponse = {
  monsters: UserMonsterDTO[];
  starterPacksOpened?: number;
};

// Same art logic as marketplace / squad
function getArtUrlForMonster(m: UserMonsterDTO): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) {
    return `/cards/base/${m.templateCode}.png`;
  }
  return "/cards/base/test.png";
}

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

  // which monster is open in the detail modal
  const [detailMonsterId, setDetailMonsterId] = useState<string | null>(null);

  // ------- search + filters (mirroring marketplace) -------
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterPosition, setFilterPosition] = useState<string>("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");

  const availableClubs = useMemo(() => {
    const set = new Set<string>();
    for (const m of collection) {
      if (m.club) set.add(m.club);
    }
    return Array.from(set).sort();
  }, [collection]);

  const availableRarities = useMemo(() => {
    const set = new Set<string>();
    for (const m of collection) {
      if (m.rarity) set.add(m.rarity.toUpperCase());
    }
    return Array.from(set).sort();
  }, [collection]);

  const filteredCollection = useMemo(() => {
    let list = [...collection];

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((m) => {
        return (
          m.displayName.toLowerCase().includes(term) ||
          m.realPlayerName.toLowerCase().includes(term) ||
          m.club.toLowerCase().includes(term)
        );
      });
    }

    if (filterRarity !== "ALL") {
      list = list.filter(
        (m) => m.rarity.toUpperCase().trim() === filterRarity
      );
    }

    if (filterPosition !== "ALL") {
      list = list.filter(
        (m) => m.position.toUpperCase().trim() === filterPosition
      );
    }

    if (filterClub !== "ALL") {
      list = list.filter((m) => m.club === filterClub);
    }

    return list;
  }, [collection, searchTerm, filterRarity, filterPosition, filterClub]);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Load challenge
      const cRes = await fetch(`/api/challenges/${challengeId}`, {
        credentials: "include",
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
        credentials: "include",
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
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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

  const isOneTime = !!challenge && !challenge.isRepeatable;
  const isCompletedOnce = !!challenge && challenge.completedCount > 0;
  const isLocked = isOneTime && isCompletedOnce;
  const canSubmit = !!challenge && meetsRequirements && !isLocked;

  async function handleSubmit() {
    if (!challenge) return;
    setError(null);
    setSuccess(null);

    if (!canSubmit) {
      if (isLocked) {
        setError("You have already completed this one-time challenge.");
      } else {
        setError("Your selected monsters do not meet the challenge requirements.");
      }
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/challenges/submit", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: challenge.id,
          userMonsterIds: selectedIds,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.ok) {
        setError(json?.error || "Failed to submit challenge.");
        return;
      }

      const coinsGranted = json.coinsGranted ?? 0;
      setSuccess(
        coinsGranted > 0
          ? `Challenge completed! You earned ${coinsGranted} coins.`
          : "Challenge completed!"
      );

      // Remove burned monsters from local collection
      setCollection((prev) => prev.filter((m) => !selectedIds.includes(m.id)));
      setSelectedIds([]);

      // Optionally refresh challenge (to bump completedCount)
      // await load();
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
          <p className="text-sm text-slate-300">Loading challenge...</p>
        </section>
      </main>
    );
  }

  if (error && !challenge) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-red-500/40 bg-red-900/30 p-5">
          <p className="text-sm text-red-100 mb-3">{error}</p>
          <Link href="/challenges" className="text-xs text-emerald-300 underline">
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
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold mb-1">{challenge.name}</h1>
              <p className="text-xs text-slate-400 mb-2">{challenge.description}</p>
              <p className="text-[11px] text-amber-300">Reward: {rewardText}</p>
              <div className="mt-2 flex flex-wrap gap-2 items-center text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-full border ${
                    challenge.isRepeatable
                      ? "bg-sky-500/10 border-sky-400 text-sky-300"
                      : "bg-slate-800 border-slate-500 text-slate-200"
                  }`}
                >
                  {challenge.isRepeatable ? "Repeatable" : "One-time"}
                </span>
                {challenge.completedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full border border-emerald-400 bg-emerald-500/10 text-emerald-300">
                    Completed {challenge.completedCount} time
                    {challenge.completedCount > 1 ? "s" : ""}
                  </span>
                )}
                {isLocked && (
                  <span className="px-2 py-0.5 rounded-full border border-slate-500 bg-slate-800 text-slate-300">
                    Already completed – cannot be done again
                  </span>
                )}
              </div>
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
            <p className="font-semibold text-slate-200">Requirements:</p>
            <ul className="list-disc list-inside">
              <li>
                At least {challenge.minMonsters} monsters (selected:{" "}
                {selectedMonsters.length})
              </li>
              {challenge.requiredPosition && (
                <li>Must include at least one {challenge.requiredPosition}</li>
              )}
              {challenge.requiredClub && (
                <li>Must include at least one from club {challenge.requiredClub}</li>
              )}
              {challenge.minRarity && (
                <li>All monsters must be at least {challenge.minRarity} rarity</li>
              )}
            </ul>
          </div>

          <div className="mt-3 text-[11px] text-slate-400">
            <p>
              Selected monsters will be{" "}
              <span className="text-amber-300 font-semibold">permanently removed</span>{" "}
              from your collection if the challenge is successfully completed.
            </p>
          </div>

          {error && (
            <p className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-2 text-xs text-emerald-300">
              {success}
            </p>
          )}

          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={handleSubmit}
            className={`mt-4 rounded-full px-4 py-2 text-sm font-semibold ${
              submitting || !canSubmit
                ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
            }`}
          >
            {isLocked
              ? "Already Completed"
              : submitting
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
              You don&apos;t have any monsters to submit yet. Open more packs first.
            </p>
          ) : (
            <>
              {/* Search + filters (mirroring marketplace style) */}
              <div className="mb-3 space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Search */}
                  <div className="sm:col-span-1">
                    <label className="block text-[11px] text-slate-300 mb-1">
                      Search by name or club
                    </label>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="e.g. Haaland, MCI, Bruno..."
                      className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  </div>

                  {/* Rarity + position */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Rarity
                      </label>
                      <select
                        value={filterRarity}
                        onChange={(e) => setFilterRarity(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="ALL">All</option>
                        {availableRarities.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Position
                      </label>
                      <select
                        value={filterPosition}
                        onChange={(e) => setFilterPosition(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="ALL">All</option>
                        <option value="GK">GK</option>
                        <option value="DEF">DEF</option>
                        <option value="MID">MID</option>
                        <option value="FWD">FWD</option>
                      </select>
                    </div>
                  </div>

                  {/* Club + clear */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] text-slate-300 mb-1">
                        Club
                      </label>
                      <select
                        value={filterClub}
                        onChange={(e) => setFilterClub(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="ALL">All</option>
                        {availableClubs.map((club) => (
                          <option key={club} value={club}>
                            {club}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1 flex items-end justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm("");
                          setFilterRarity("ALL");
                          setFilterPosition("ALL");
                          setFilterClub("ALL");
                        }}
                        className="rounded-full border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                      >
                        Clear filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {filteredCollection.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No monsters match your filters. Try clearing some filters.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  {filteredCollection.map((m) => {
                    const selected = selectedIds.includes(m.id);
                    const artUrl = getArtUrlForMonster(m);

                    return (
                      <div
                        key={m.id}
                        onClick={() => toggleSelect(m.id)}
                        className={`cursor-pointer transition rounded-2xl ${
                          selected ? "ring-2 ring-emerald-400 ring-offset-0" : ""
                        }`}
                      >
                        <MonsterCard
                          monster={{
                            displayName: m.displayName,
                            realPlayerName: m.realPlayerName,
                            position: m.position,
                            club: m.club,
                            rarity: m.rarity,
                            baseAttack: m.baseAttack,
                            baseMagic: m.baseMagic,
                            baseDefense: m.baseDefense,
                            evolutionLevel: m.evolutionLevel,
                            artUrl,
                            setCode: m.setCode ?? undefined,
                            editionType: m.editionType ?? undefined,
                            editionLabel: m.editionLabel ?? undefined,
                            serialNumber: m.serialNumber ?? undefined,
                          }}
                          rightBadge={
                            <span className="uppercase text-[10px] text-emerald-300">
                              {m.rarity}
                            </span>
                          }
                        >
                          {/* Only actions here – no repeated info text */}
                          <div className="mt-2 flex gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSelect(m.id);
                              }}
                              className={`flex-1 rounded-full px-2 py-1 text-[10px] font-semibold border ${
                                selected
                                  ? "border-emerald-400 bg-emerald-500/10 text-emerald-300"
                                  : "border-slate-600 text-slate-200 hover:border-emerald-400"
                              }`}
                            >
                              {selected ? "Selected" : "Select"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailMonsterId(m.id);
                              }}
                              className="flex-1 rounded-full border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                            >
                              View details
                            </button>
                          </div>
                        </MonsterCard>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* shared monster detail modal */}
      {detailMonsterId && (
        <MonsterDetailModal
          monsterId={detailMonsterId}
          onClose={() => setDetailMonsterId(null)}
        />
      )}
    </>
  );
}
