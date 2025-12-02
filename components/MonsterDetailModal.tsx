// components/MonsterDetailModal.tsx
"use client";

import { useEffect, useState } from "react";
import MonsterChipBadge from "@/components/MonsterChipBadge";

type ApiHistoryItem = {
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

type ApiChipAssignment = {
  id: string;
  gameweekId: string | null;
  gameweekNumber: number | null;
  createdAt: string;
  resolvedAt: string | null;
  wasSuccessful: boolean | null;
  userChip: {
    id: string;
    isConsumed: boolean;
    template: {
      id: string;
      code: string;
      name: string;
      description: string;
      conditionType: string;
      minRarity: string | null;
      maxRarity: string | null;
      allowedPositions: string | null;
    };
  };
};

type ApiMonster = {
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

  // art path (optional, if backend sends it)
  artBasePath?: string | null;

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
  history: ApiHistoryItem[];

  // 🔥 NEW: chip assignments from the API
  chipAssignments?: ApiChipAssignment[];
};

type DetailApiResponse = {
  monster?: ApiMonster;
  error?: string;
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
  totalGoals?: number;
  totalAssists?: number;
  totalCleanSheets?: number;
  totalFantasyPoints?: number;
  isConsumed?: boolean;
  createdAt?: string;
  ownerEmail?: string | null;
  ownerUsername?: string | null;

  artBasePath?: string | null;
};

type HistoryEvent = {
  id: string;
  action: string;
  description: string;
  createdAt: string;
  actorEmail?: string | null;
  actorUsername?: string | null;
};

type ChipAssignment = {
  id: string;
  gameweekNumber: number | null;
  createdAt: string;
  resolvedAt: string | null;
  wasSuccessful: boolean | null;
  chipName: string;
  chipCode: string;
  chipDescription: string;
};

type PriceHistoryEvent = {
  id: string;
  price: number;
  createdAt: string;
};

type MonsterDetailModalProps = {
  monsterId: string;
  onClose: () => void;
};

// Same art logic as marketplace/squad
function getArtUrlForMonster(m: {
  templateCode: string;
  artBasePath?: string | null;
}): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) {
    return `/cards/base/${m.templateCode}.png`;
  }
  return "/cards/base/test.png";
}

export default function MonsterDetailModal({
  monsterId,
  onClose,
}: MonsterDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [monster, setMonster] = useState<MonsterDetail | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // NEW: chip assignments
  const [chipAssignments, setChipAssignments] = useState<
    ChipAssignment[]
  >([]);

  // NEW: market price history
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEvent[]>(
    []
  );
  const [priceHistoryLoading, setPriceHistoryLoading] =
    useState(false);
  const [priceHistoryError, setPriceHistoryError] = useState<
    string | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setPriceHistory([]);
      setPriceHistoryError(null);
      setChipAssignments([]);

      try {
        const res = await fetch(`/api/monsters/${monsterId}`, {
          credentials: "include",
        });

        const data = (await res.json()) as DetailApiResponse;

        if (!res.ok || data.error) {
          if (!cancelled) {
            setError(
              data.error || "Failed to load monster details."
            );
            setMonster(null);
            setHistory([]);
            setChipAssignments([]);
          }
          return;
        }

        if (!data.monster) {
          if (!cancelled) {
            setError("Monster not found.");
            setMonster(null);
            setHistory([]);
            setChipAssignments([]);
          }
          return;
        }

        const apiMonster = data.monster;

        if (!cancelled) {
          // Map API monster -> modal monster
          setMonster({
            id: apiMonster.id,
            templateCode: apiMonster.templateCode,
            displayName: apiMonster.displayName,
            realPlayerName: apiMonster.realPlayerName,
            position: apiMonster.position,
            club: apiMonster.club,
            rarity: apiMonster.rarity,
            baseAttack: apiMonster.baseAttack,
            baseMagic: apiMonster.baseMagic,
            baseDefense: apiMonster.baseDefense,
            evolutionLevel: apiMonster.evolutionLevel,
            totalGoals: apiMonster.totalGoals,
            totalAssists: apiMonster.totalAssists,
            totalCleanSheets: apiMonster.totalCleanSheets,
            totalFantasyPoints: apiMonster.totalFantasyPoints,
            isConsumed: apiMonster.isConsumed,
            createdAt: apiMonster.createdAt,
            ownerEmail: apiMonster.owner?.email ?? null,
            ownerUsername: apiMonster.owner?.username ?? null,
            artBasePath: apiMonster.artBasePath ?? null,
          });

          // Map API history (with actor) -> modal history
          setHistory(
            (apiMonster.history || []).map((h) => ({
              id: h.id,
              action: h.action,
              description: h.description,
              createdAt: h.createdAt,
              actorEmail: h.actor?.email ?? null,
              actorUsername: h.actor?.username ?? null,
            }))
          );

          // 🔥 Map chip assignments
          setChipAssignments(
            (apiMonster.chipAssignments || []).map((a) => ({
              id: a.id,
              gameweekNumber: a.gameweekNumber,
              createdAt: a.createdAt,
              resolvedAt: a.resolvedAt,
              wasSuccessful: a.wasSuccessful,
              chipName: a.userChip.template.name,
              chipCode: a.userChip.template.code,
              chipDescription: a.userChip.template.description,
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load monster details.");
          setMonster(null);
          setHistory([]);
          setChipAssignments([]);
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
  }, [monsterId]);

  // NEW: fetch market price history once we know the monster templateCode
  useEffect(() => {
    if (!monster?.templateCode) return;

    let cancelled = false;
    async function loadHistory() {
      setPriceHistoryLoading(true);
      setPriceHistoryError(null);
      try {
        const res = await fetch(
          `/api/marketplace/price-history?templateCode=${encodeURIComponent(
            monster.templateCode
          )}`,
          { credentials: "include" }
        );
        const data = (await res.json()) as {
          history?: PriceHistoryEvent[];
          error?: string;
        };

        if (!res.ok || data.error) {
          if (!cancelled) {
            setPriceHistoryError(
              data.error || "Failed to load price history."
            );
            setPriceHistory([]);
          }
          return;
        }

        if (!cancelled) {
          setPriceHistory(data.history || []);
        }
      } catch {
        if (!cancelled) {
          setPriceHistoryError("Failed to load price history.");
          setPriceHistory([]);
        }
      } finally {
        if (!cancelled) {
          setPriceHistoryLoading(false);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [monster?.templateCode]);

  const handleBackdropClick = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    // Close when clicking the dark backdrop, but not the panel itself
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Helper: average price
  const averagePrice =
    priceHistory.length > 0
      ? Math.round(
          priceHistory.reduce((sum, h) => sum + h.price, 0) /
            priceHistory.length
        )
      : null;

  // 🔥 Active chip = first unresolved assignment
  const activeChip = chipAssignments.find(
    (c) => c.resolvedAt === null
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Monster details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[75vh] overflow-y-auto px-4 py-3 space-y-4 text-xs">
          {loading && (
            <p className="text-slate-300 text-sm">
              Loading monster details...
            </p>
          )}

          {!loading && error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {!loading && !error && !monster && (
            <p className="text-sm text-slate-300">
              Monster not found.
            </p>
          )}

          {!loading && !error && monster && (
            <>
              {/* Top card with core info */}
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 space-y-3">
                <div className="flex flex-col md:flex-row md:items-start md:gap-4">
                  {/* BIG Card image */}
                  <div className="flex-shrink-0 w-40 sm:w-48 md:w-56 aspect-[3/4] overflow-hidden rounded-lg border border-slate-700 bg-slate-900/60 mx-auto md:mx-0 mb-2 md:mb-0">
                    <img
                      src={getArtUrlForMonster(monster)}
                      alt={monster.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Text / stats */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {monster.displayName}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          {monster.realPlayerName} • {monster.club}
                        </p>
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-emerald-300">
                        {monster.rarity}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      {monster.position} • ATK {monster.baseAttack} • MAG{" "}
                      {monster.baseMagic} • DEF {monster.baseDefense}
                    </p>

                    <p className="text-[10px] text-emerald-300">
                      Evo Lv. {monster.evolutionLevel}
                    </p>

                    {(monster.totalGoals ||
                      monster.totalAssists ||
                      monster.totalCleanSheets ||
                      monster.totalFantasyPoints) && (
                      <p className="mt-1 text-[11px] text-slate-300">
                        GW stats:{" "}
                        <span className="text-emerald-300">
                          {monster.totalGoals ?? 0} G •{" "}
                          {monster.totalAssists ?? 0} A •{" "}
                          {monster.totalCleanSheets ?? 0} CS •{" "}
                          {monster.totalFantasyPoints ?? 0} PTS
                        </span>
                      </p>
                    )}

                    {(monster.ownerEmail || monster.ownerUsername) && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Current owner:{" "}
                        <span className="font-mono text-slate-200">
                          {monster.ownerUsername || monster.ownerEmail}
                        </span>
                      </p>
                    )}

                    {monster.isConsumed && (
                      <p className="mt-1 text-[10px] text-amber-300">
                        This monster has been consumed in an SBC /
                        special action and is no longer active.
                      </p>
                    )}

                    {/* 🔥 Active chip display */}
                    {activeChip && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] text-slate-300">
                          Active evolution chip:
                        </p>
                        <MonsterChipBadge
                          name={activeChip.chipName}
                          code={activeChip.chipCode}
                          gameweekNumber={activeChip.gameweekNumber}
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Condition: {activeChip.chipDescription}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* History timeline */}
              <div>
                <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                  History
                </h3>
                {history.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No history events recorded yet.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {history.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-semibold text-emerald-300">
                            {event.action}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(
                              event.createdAt
                            ).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-200">
                          {event.description}
                        </p>
                        {(event.actorEmail ||
                          event.actorUsername) && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            By{" "}
                            <span className="font-mono text-slate-200">
                              {event.actorUsername ||
                                event.actorEmail}
                            </span>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 🔥 Chip history */}
              <div className="mt-3">
                <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                  Chip history
                </h3>
                {chipAssignments.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    No chip history recorded yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {chipAssignments.map((asgn) => (
                      <div
                        key={asgn.id}
                        className="rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <MonsterChipBadge
                            name={asgn.chipName}
                            code={asgn.chipCode}
                            gameweekNumber={asgn.gameweekNumber}
                          />
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border 
                              ${
                                asgn.wasSuccessful === true
                                  ? "border-emerald-500/60 text-emerald-300 bg-emerald-950/30"
                                  : asgn.wasSuccessful === false
                                  ? "border-rose-500/60 text-rose-300 bg-rose-950/30"
                                  : "border-slate-500/60 text-slate-300 bg-slate-900/40"
                              }`}
                          >
                            {asgn.wasSuccessful === true
                              ? "Success"
                              : asgn.wasSuccessful === false
                              ? "Failed"
                              : "Pending"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-300">
                          {asgn.chipDescription}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* NEW: Market price history */}
              <div className="mt-3">
                <h3 className="text-[11px] font-semibold text-slate-200 mb-1">
                  Market price history
                </h3>
                {priceHistoryLoading && (
                  <p className="text-[11px] text-slate-400">
                    Loading price history...
                  </p>
                )}
                {!priceHistoryLoading && priceHistoryError && (
                  <p className="text-[11px] text-red-400">
                    {priceHistoryError}
                  </p>
                )}
                {!priceHistoryLoading &&
                  !priceHistoryError &&
                  priceHistory.length === 0 && (
                    <p className="text-[11px] text-slate-400">
                      No marketplace trades recorded yet for this
                      monster template.
                    </p>
                  )}
                {!priceHistoryLoading &&
                  !priceHistoryError &&
                  priceHistory.length > 0 && (
                    <div className="space-y-1.5">
                      {averagePrice !== null && (
                        <p className="text-[11px] text-emerald-300">
                          Average sale price (last{" "}
                          {priceHistory.length}):{" "}
                          <span className="font-mono font-semibold">
                            {averagePrice}
                          </span>{" "}
                          coins
                        </p>
                      )}
                      <ul className="space-y-1 max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2">
                        {priceHistory.map((h) => (
                          <li
                            key={h.id}
                            className="flex items-center justify-between text-[10px] text-slate-200"
                          >
                            <span className="font-mono">
                              {h.price} coins
                            </span>
                            <span className="text-slate-500">
                              {new Date(
                                h.createdAt
                              ).toLocaleDateString()}{" "}
                              {new Date(
                                h.createdAt
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
