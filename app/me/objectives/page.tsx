"use client";

import { useEffect, useState } from "react";
import PackOpenModal, { PackId } from "@/components/PackOpenModal";

type ObjectiveDTO = {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string | null;
  seasonCode: string | null;
  period: string;
  type: string;
  sortOrder: number;
  targetValue: number;
  rewardType: string;
  rewardValue: string;
  currentValue: number;
  completedAt: string | null;
  rewardClaimedAt: string | null;
};

type ObjectiveSetDTO = {
  id: string;
  code: string;
  title: string;
  description: string;
  seasonCode: string | null;
  sortOrder: number;
  rewardType: string;
  rewardValue: string;
  isActive: boolean;
  isCompleted: boolean;
  completedAt: string | null;
  rewardClaimedAt: string | null;
  objectives: ObjectiveDTO[];
};

type ApiResponse = {
  objectives: ObjectiveDTO[];
  sets: ObjectiveSetDTO[];
  error?: string;
};

// For when we get a pack from an objective or set
type PendingRewardPack = {
  packId: PackId;
  rewardPackId: string;
};

export default function ObjectivesPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [claimingObjectiveId, setClaimingObjectiveId] = useState<string | null>(null);
  const [claimingSetId, setClaimingSetId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [pendingRewardPack, setPendingRewardPack] = useState<PendingRewardPack | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/objectives", {
        credentials: "include",
      });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || json.error) {
        setErr(json.error || "Failed to load objectives.");
        return;
      }

      setData(json);
    } catch {
      setErr("Failed to load objectives.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const totalObjectives = data?.objectives.length ?? 0;
  const completedObjectives =
    data?.objectives.filter((o) => !!o.completedAt).length ?? 0;

  async function handleClaimObjective(obj: ObjectiveDTO) {
    if (obj.rewardClaimedAt || !obj.completedAt) return;
    setClaimingObjectiveId(obj.id);
    setToast(null);
    try {
      const res = await fetch("/api/objectives/claim", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ objectiveId: obj.id }),
      });
      const j = await res.json();

      if (!res.ok || j.error) {
        setToast(j.error || "Failed to claim reward.");
      } else {
        const rewardLabel =
          obj.rewardType === "coins"
            ? `${obj.rewardValue} coins`
            : obj.rewardType === "pack"
            ? `${obj.rewardValue.toUpperCase()} pack`
            : obj.rewardType;

        setToast(`Reward claimed: ${rewardLabel}`);

        // If this was a pack reward, and backend created a reward pack, open it
        if (
          j.rewardType === "pack" &&
          typeof j.rewardValue === "string" &&
          j.createdRewardPackId
        ) {
          const rv = j.rewardValue.toLowerCase();
          if (rv === "starter" || rv === "bronze" || rv === "silver" || rv === "gold") {
            setPendingRewardPack({
              packId: rv as PackId,
              rewardPackId: j.createdRewardPackId as string,
            });
          }
        }

        await load();
      }
    } catch {
      setToast("Failed to claim reward.");
    } finally {
      setClaimingObjectiveId(null);
    }
  }

  async function handleClaimSet(set: ObjectiveSetDTO) {
    if (!set.isCompleted || set.rewardClaimedAt) return;
    setClaimingSetId(set.id);
    setToast(null);
    try {
      const res = await fetch("/api/objectives/claim-set", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ objectiveSetId: set.id }),
      });
      const j = await res.json();

      if (!res.ok || j.error) {
        setToast(j.error || "Failed to claim path reward.");
      } else {
        const rewardLabel =
          set.rewardType === "coins"
            ? `${set.rewardValue} coins`
            : set.rewardType === "pack"
            ? `${set.rewardValue.toUpperCase()} pack`
            : set.rewardType;

        setToast(`Path reward claimed: ${rewardLabel}`);

        if (
          j.rewardType === "pack" &&
          typeof j.rewardValue === "string" &&
          j.createdRewardPackId
        ) {
          const rv = j.rewardValue.toLowerCase();
          if (rv === "starter" || rv === "bronze" || rv === "silver" || rv === "gold") {
            setPendingRewardPack({
              packId: rv as PackId,
              rewardPackId: j.createdRewardPackId as string,
            });
          }
        }

        await load();
      }
    } catch {
      setToast("Failed to claim path reward.");
    } finally {
      setClaimingSetId(null);
    }
  }

  return (
    <>
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <div className="mx-auto max-w-5xl px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Objectives & Paths
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Complete objectives to earn coins, packs, and unlock full paths. Click to claim your rewards.
              </p>
            </div>
          </div>

          {/* Global summary */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Objectives completed</p>
              <p className="mt-1 text-xl font-semibold">
                {completedObjectives} / {totalObjectives}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Objective sets</p>
              <p className="mt-1 text-xl font-semibold">
                {data?.sets.length ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-slate-400">Completed sets</p>
              <p className="mt-1 text-xl font-semibold">
                {data?.sets.filter((s) => s.isCompleted).length ?? 0}
              </p>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div className="mt-4 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200">
              {toast}
            </div>
          )}

          {/* Loading / error */}
          <div className="mt-6">
            {loading && (
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
                Loading objectives...
              </div>
            )}

            {!loading && err && (
              <p className="text-sm text-red-400">{err}</p>
            )}
          </div>

          {/* Sets / paths */}
          {!loading && !err && data && (
            <div className="mt-6 space-y-5">
              {data.sets.map((set) => {
                const total = set.objectives.length;
                const completedCount = set.objectives.filter(
                  (o) => !!o.completedAt
                ).length;
                const pct =
                  total === 0 ? 0 : Math.round((completedCount / total) * 100);

                const rewardLabel =
                  set.rewardType === "coins"
                    ? `${set.rewardValue} coins`
                    : set.rewardType === "pack"
                    ? `${set.rewardValue.toUpperCase()} pack`
                    : set.rewardType;

                const setClaimable =
                  set.isCompleted && !set.rewardClaimedAt;

                return (
                  <div
                    key={set.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-md"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-semibold">
                            {set.title}
                          </h2>
                          {set.isCompleted && (
                            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                              Completed
                            </span>
                          )}
                          {set.rewardClaimedAt && (
                            <span className="rounded-full bg-slate-700/70 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200">
                              Reward claimed
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {set.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-xs">
                        <div className="text-right">
                          <p className="text-slate-400">Path reward</p>
                          <p className="mt-0.5 font-semibold text-emerald-300">
                            {rewardLabel}
                          </p>
                        </div>
                        {setClaimable && (
                          <button
                            onClick={() => handleClaimSet(set)}
                            disabled={claimingSetId === set.id}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 ${
                              claimingSetId === set.id ? "opacity-70" : "animate-pulse"
                            }`}
                          >
                            {claimingSetId === set.id ? "Claiming..." : "Claim path reward"}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          {completedCount} / {total} objectives
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      {set.objectives.map((obj) => {
                        const done = !!obj.completedAt;
                        const claimed = !!obj.rewardClaimedAt;
                        const claimable = done && !claimed;

                        const rewardShort =
                          obj.rewardType === "coins"
                            ? `${obj.rewardValue}c`
                            : obj.rewardType === "pack"
                            ? `${obj.rewardValue.toUpperCase()}`
                            : obj.rewardType;

                        const progressPct =
                          obj.targetValue === 0
                            ? 0
                            : Math.min(
                                100,
                                Math.round((obj.currentValue / obj.targetValue) * 100)
                              );

                        return (
                          <div
                            key={obj.id}
                            className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-xs font-semibold">
                                    {obj.name}
                                  </p>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                      claimed
                                        ? "bg-slate-700/70 text-slate-200"
                                        : done
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : obj.currentValue > 0
                                        ? "bg-sky-500/10 text-sky-300"
                                        : "bg-slate-700/70 text-slate-200"
                                    }`}
                                  >
                                    {claimed
                                      ? "Reward claimed"
                                      : done
                                      ? "Completed"
                                      : obj.currentValue > 0
                                      ? "In progress"
                                      : "Not started"}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {obj.description}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                                <div className="text-right">
                                  <p>Reward</p>
                                  <p className="font-semibold text-emerald-300">
                                    {rewardShort}
                                  </p>
                                </div>
                                {claimable && (
                                  <button
                                    onClick={() => handleClaimObjective(obj)}
                                    disabled={claimingObjectiveId === obj.id}
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 ${
                                      claimingObjectiveId === obj.id ? "opacity-70" : "animate-pulse"
                                    }`}
                                  >
                                    {claimingObjectiveId === obj.id ? "Claiming..." : "Claim"}
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="mt-2 text-[11px] text-slate-400">
                              <div className="flex items-center justify-between">
                                <span>
                                  {obj.currentValue} / {obj.targetValue}
                                </span>
                                <span>{progressPct}%</span>
                              </div>
                              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-emerald-400"
                                  style={{ width: `${progressPct}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Reward pack modal, opened right after claim */}
      {pendingRewardPack && (
        <PackOpenModal
          packId={pendingRewardPack.packId}
          rewardPackId={pendingRewardPack.rewardPackId}
          redirectToSquad={false}
          onClose={() => setPendingRewardPack(null)}
          onOpened={async () => {
            // After opening, refresh objectives so claimed state is correct
            await load();
          }}
        />
      )}
    </>
  );
}
