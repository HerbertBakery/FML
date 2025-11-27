// components/MonsterDetailModal.tsx
"use client";

import { useEffect, useState } from "react";

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

  // NEW: art path (optional, if backend sends it)
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

  // NEW: art path for modal
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/monsters/${monsterId}`, {
          credentials: "include",
        });

        const data = (await res.json()) as DetailApiResponse;

        if (!res.ok || data.error) {
          if (!cancelled) {
            setError(data.error || "Failed to load monster details.");
            setMonster(null);
            setHistory([]);
          }
          return;
        }

        if (!data.monster) {
          if (!cancelled) {
            setError("Monster not found.");
            setMonster(null);
            setHistory([]);
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
            // NEW: art base path
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
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load monster details.");
          setMonster(null);
          setHistory([]);
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

  const handleBackdropClick = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    // Close when clicking the dark backdrop, but not the panel itself
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
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
              <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 space-y-2">
                {/* NEW: Card image */}
                <div className="w-24 aspect-[3/4] overflow-hidden rounded-lg border border-slate-700 bg-slate-900/60 mx-auto mb-1">
                  <img
                    src={getArtUrlForMonster(monster)}
                    alt={monster.displayName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex items-center justify-between">
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

                <p className="text-[11px] text-slate-400 mt-1">
                  {monster.position} • ATK {monster.baseAttack} • MAG{" "}
                  {monster.baseMagic} • DEF {monster.baseDefense}
                </p>

                <p className="text-[10px] text-emerald-300 mt-1">
                  Evo Lv. {monster.evolutionLevel}
                </p>

                {(monster.totalGoals ||
                  monster.totalAssists ||
                  monster.totalCleanSheets ||
                  monster.totalFantasyPoints) && (
                  <p className="mt-2 text-[11px] text-slate-300">
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
                            {new Date(event.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-200">
                          {event.description}
                        </p>
                        {(event.actorEmail || event.actorUsername) && (
                          <p className="mt-0.5 text-[10px] text-slate-400">
                            By{" "}
                            <span className="font-mono text-slate-200">
                              {event.actorUsername || event.actorEmail}
                            </span>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
