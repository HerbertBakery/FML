// app/me/chips/page.tsx
"use client";

import { useEffect, useState } from "react";
import MonsterChipBadge from "@/components/MonsterChipBadge";

type MonsterChip = {
  id: string;
  code: string;
  name: string;
  description: string;
  // optional metadata – backend may or may not send all of these
  rarityRequirement?: string | null;
  allowedRarities?: string[] | null;
  maxEvoIncrease?: number | null;
  maxUsesPerMonster?: number | null;

  status: string; // "INVENTORY" | "ACTIVE" | "CONSUMED" | etc.
  gameweekNumber?: number | null;

  attachedMonsterId?: string | null;
  attachedMonsterName?: string | null;
  attachedMonsterTemplateCode?: string | null;

  createdAt: string;
};

type ChipsApiResponse = {
  chips?: MonsterChip[];
  error?: string;
};

function groupChips(chips: MonsterChip[]) {
  const active: MonsterChip[] = [];
  const inventory: MonsterChip[] = [];
  const used: MonsterChip[] = [];

  for (const chip of chips) {
    const status = chip.status?.toUpperCase?.() ?? "";

    if (status === "ACTIVE") active.push(chip);
    else if (status === "CONSUMED" || status === "USED") used.push(chip);
    else inventory.push(chip);
  }

  return { active, inventory, used };
}

export default function ChipsPage() {
  const [chips, setChips] = useState<MonsterChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/me/chips", {
          credentials: "include",
        });

        const data = (await res.json()) as ChipsApiResponse;

        if (!res.ok || data.error) {
          if (!cancelled) {
            setError(data.error || "Failed to load evolution chips.");
            setChips([]);
          }
          return;
        }

        if (!cancelled) {
          setChips(data.chips || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load evolution chips.");
          setChips([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const { active, inventory, used } = groupChips(chips);

  return (
    <main className="space-y-4">
      {/* Page header */}
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
        <h1 className="text-lg font-semibold text-slate-100">
          Evolution Lab
        </h1>
        <p className="mt-1 text-[12px] text-slate-300">
          Attach evolution chips to your monsters and let real-world FPL
          performances power up (or punish) your cards.
        </p>

        {/* Rules summary */}
        <div className="mt-3 grid gap-3 text-[11px] text-slate-200 md:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <h2 className="text-[11px] font-semibold text-emerald-300 mb-1">
              Evolution limits by rarity
            </h2>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>COMMON monsters can evolve <b>1 time</b> max.</li>
              <li>RARE monsters can evolve <b>2 times</b> max.</li>
              <li>EPIC monsters can evolve <b>3 times</b> max.</li>
              <li>LEGENDARY monsters can evolve <b>4 times</b> max.</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3">
            <h2 className="text-[11px] font-semibold text-amber-300 mb-1">
              Blanks & negative outcomes
            </h2>
            <p>
              A <span className="font-semibold">blank</span> is any FPL score of{" "}
              <span className="font-mono">2 points or less</span> before
              bonus/chip effects.
            </p>
            <p className="mt-1">
              Some chips turn big hauls into huge evolutions, but repeated blanks
              can <span className="text-red-300 font-semibold">devolve</span> a
              monster or apply negative effects.
            </p>
          </div>
        </div>
      </section>

      {/* Error / loading states */}
      {loading && (
        <p className="text-sm text-slate-300">
          Loading your chips…
        </p>
      )}

      {!loading && error && (
        <p className="text-sm text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          {/* Active chips */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold text-emerald-300">
                Active this gameweek
              </h2>
              {active.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {active.length} chip{active.length === 1 ? "" : "s"} active
                </span>
              )}
            </div>

            {active.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                No active chips yet. Attach a chip to one of your monsters for
                the current gameweek from your squad screen.
              </p>
            ) : (
              <ul className="space-y-2">
                {active.map((chip) => (
                  <li
                    key={chip.id}
                    className="rounded-lg border border-emerald-700/60 bg-emerald-950/20 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <MonsterChipBadge
                          name={chip.name}
                          code={chip.code}
                          gameweekNumber={chip.gameweekNumber ?? null}
                        />
                        <p className="mt-1 text-[11px] text-slate-200">
                          {chip.description}
                        </p>
                        {chip.allowedRarities && chip.allowedRarities.length > 0 && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Allowed rarities:{" "}
                            <span className="font-mono">
                              {chip.allowedRarities.join(", ")}
                            </span>
                          </p>
                        )}
                        {typeof chip.maxEvoIncrease === "number" && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Max evo from this chip:{" "}
                            <span className="font-mono">
                              +{chip.maxEvoIncrease}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-400">
                        {chip.attachedMonsterName ? (
                          <>
                            <p className="text-slate-300">
                              Attached to:
                            </p>
                            <p className="font-mono text-slate-100">
                              {chip.attachedMonsterName}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-500">
                            Not attached
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Inventory */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold text-slate-200">
                Chip inventory
              </h2>
              {inventory.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {inventory.length} available chip
                  {inventory.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {inventory.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                You don&apos;t have any unused chips yet. Earn chips from
                objectives, SBCs, special packs, or rewards.
              </p>
            ) : (
              <ul className="space-y-2">
                {inventory.map((chip) => (
                  <li
                    key={chip.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-100">
                          {chip.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-300">
                          {chip.description}
                        </p>

                        {(chip.allowedRarities && chip.allowedRarities.length > 0) ||
                        chip.rarityRequirement ? (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Rarity rule:{" "}
                            <span className="font-mono">
                              {chip.allowedRarities && chip.allowedRarities.length > 0
                                ? chip.allowedRarities.join(", ")
                                : chip.rarityRequirement}
                            </span>
                          </p>
                        ) : null}

                        {typeof chip.maxEvoIncrease === "number" && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Max evo from this chip:{" "}
                            <span className="font-mono">
                              +{chip.maxEvoIncrease}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        <p>Status: Inventory</p>
                        <p>
                          Earned:{" "}
                          {new Date(chip.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Used chips */}
          <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[12px] font-semibold text-slate-200">
                Used / consumed chips
              </h2>
              {used.length > 0 && (
                <span className="text-[10px] text-slate-400">
                  {used.length} used
                </span>
              )}
            </div>

            {used.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                Once you use chips in a gameweek, they&apos;ll appear here with
                a record of what happened.
              </p>
            ) : (
              <ul className="space-y-2 max-h-52 overflow-y-auto">
                {used.map((chip) => (
                  <li
                    key={chip.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-100">
                          {chip.name}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-300">
                          {chip.description}
                        </p>
                        {chip.gameweekNumber && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            Used in GW{" "}
                            <span className="font-mono">
                              {chip.gameweekNumber}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right text-[10px] text-slate-500">
                        <p>Status: Used</p>
                        <p>
                          Created:{" "}
                          {new Date(chip.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
