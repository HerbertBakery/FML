// app/managers/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonsterDetailModal from "@/components/MonsterDetailModal";

type ManagerInfo = {
  id: string;
  email: string;
  username: string | null;
};

type GameweekHistoryEntry = {
  gameweekId: string;
  number: number;
  name: string | null;
  points: number;
};

type UserMonsterDTO = {
  id: string;
  templateCode: string;
  displayName: string;
  realPlayerName: string;
  position: "GK" | "DEF" | "MID" | "FWD" | string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
  evolutionLevel: number;
  artBasePath?: string | null;
  setCode?: string | null;
  editionType?: string | null;
  editionLabel?: string | null;
  serialNumber?: number | null;
};

type GameweekSquadMonster = UserMonsterDTO & {
  isSub: boolean;
  gameweekPoints: number;
};

type GameweekSquadResponse = {
  user: ManagerInfo;
  gameweek: {
    id: string;
    number: number;
    name: string | null;
  } | null;
  totalPoints: number;
  monsters: GameweekSquadMonster[];
};

type PitchMonster = UserMonsterDTO & {
  isSub?: boolean;
  gameweekPoints?: number;
};

type GameweeksResponse = {
  user: ManagerInfo;
  entries: GameweekHistoryEntry[];
};

function getArtUrlForMonster(m: UserMonsterDTO): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) return `/cards/base/${m.templateCode}.png`;
  return "/cards/base/test.png";
}

export default function ManagerPage() {
  const params = useParams();
  const managerId = (params?.id as string) || "";

  const [manager, setManager] = useState<ManagerInfo | null>(null);
  const [gwHistory, setGwHistory] = useState<GameweekHistoryEntry[]>([]);
  const [gwIndex, setGwIndex] = useState<number | null>(null);
  const [gwSquad, setGwSquad] = useState<GameweekSquadResponse | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingSquad, setLoadingSquad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [squadError, setSquadError] = useState<string | null>(null);
  const [detailMonsterId, setDetailMonsterId] = useState<string | null>(null);

  // Load manager GW history
  useEffect(() => {
    if (!managerId) return;

    const loadHistory = async () => {
      setLoadingHistory(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/${managerId}/gameweeks`, {
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Failed to load manager history.");
          setManager(null);
          setGwHistory([]);
          return;
        }
        const data: GameweeksResponse = await res.json();
        setManager(data.user);
        setGwHistory(data.entries || []);
        if (data.entries && data.entries.length > 0) {
          setGwIndex(data.entries.length - 1); // latest GW
        } else {
          setGwIndex(null);
        }
      } catch {
        setError("Failed to load manager history.");
        setManager(null);
        setGwHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    void loadHistory();
  }, [managerId]);

  // Load specific GW squad when gwIndex changes
  useEffect(() => {
    if (!managerId || gwIndex === null || gwHistory.length === 0) return;

    const entry = gwHistory[gwIndex];
    const gameweekId = entry.gameweekId;

    const loadSquad = async () => {
      setLoadingSquad(true);
      setSquadError(null);
      try {
        const res = await fetch(
          `/api/users/${managerId}/gameweek-squad?gameweekId=${gameweekId}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setGwSquad(null);
          setSquadError(data?.error || "Failed to load gameweek squad.");
          return;
        }
        const data: GameweekSquadResponse = await res.json();
        setGwSquad(data);
        setManager(data.user);
      } catch {
        setGwSquad(null);
        setSquadError("Failed to load gameweek squad.");
      } finally {
        setLoadingSquad(false);
      }
    };

    void loadSquad();
  }, [managerId, gwIndex, gwHistory]);

  const hasGwHistory = gwHistory.length > 0 && gwIndex !== null;

  const seasonTotalPoints = useMemo(
    () => gwHistory.reduce((sum, gw) => sum + gw.points, 0),
    [gwHistory]
  );

  const pitchSource: PitchMonster[] =
    gwSquad && gwSquad.monsters && gwSquad.monsters.length > 0
      ? gwSquad.monsters
      : [];

  const pitchByLine = useMemo(() => {
    const gk: PitchMonster[] = [];
    const def: PitchMonster[] = [];
    const mid: PitchMonster[] = [];
    const fwd: PitchMonster[] = [];

    for (const m of pitchSource) {
      const pos = (m.position || "").toUpperCase().trim();

      if (pos === "GK" || pos === "GKP" || pos === "GOALKEEPER") {
        gk.push(m);
      } else if (pos === "DEF" || pos === "D" || pos === "DEFENDER") {
        def.push(m);
      } else if (pos === "MID" || pos === "M" || pos === "MIDFIELDER") {
        mid.push(m);
      } else if (pos === "FWD" || pos === "F" || pos === "FORWARD" || pos === "ATT") {
        fwd.push(m);
      } else {
        mid.push(m);
      }
    }

    return { GK: gk, DEF: def, MID: mid, FWD: fwd };
  }, [pitchSource]);

  const pitchTotalPoints =
    gwSquad && typeof gwSquad.totalPoints === "number"
      ? gwSquad.totalPoints
      : 0;

  const noMonstersButHasScore =
    !loadingSquad &&
    !squadError &&
    gwSquad &&
    pitchSource.length === 0 &&
    typeof gwSquad.totalPoints === "number" &&
    gwSquad.totalPoints > 0;

  if (!managerId) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-sm text-slate-300">
            Invalid manager URL.
          </p>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/leaderboards"
              className="text-[11px] text-slate-400 hover:text-emerald-300"
            >
              ← Back to Leaderboards
            </Link>
            <h1 className="mt-1 text-xl font-bold text-slate-100">
              Manager Profile
            </h1>
            {manager && (
              <p className="mt-1 text-xs text-slate-300">
                {manager.username || manager.email}
              </p>
            )}
            {error && (
              <p className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
            {!loadingHistory && !error && manager && (
              <p className="mt-2 text-xs text-slate-400">
                Season total:{" "}
                <span className="font-mono text-amber-300">
                  {seasonTotalPoints} pts
                </span>
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-emerald-100">
                Gameweek Pitch
              </h2>
              {gwSquad?.gameweek ? (
                <p className="text-[11px] text-emerald-200">
                  Gameweek {gwSquad.gameweek.number}{" "}
                  {gwSquad.gameweek.name ? `– ${gwSquad.gameweek.name}` : ""}
                </p>
              ) : hasGwHistory ? (
                <p className="text-[11px] text-emerald-200">
                  No locked squad found for this gameweek.
                </p>
              ) : (
                <p className="text-[11px] text-emerald-200">
                  This manager has no gameweek scores yet.
                </p>
              )}
              {loadingSquad && (
                <p className="text-[11px] text-emerald-300">
                  Loading gameweek squad...
                </p>
              )}
              {squadError && (
                <p className="text-[11px] text-red-300">
                  {squadError}
                </p>
              )}
              {noMonstersButHasScore && (
                <p className="mt-1 text-[10px] text-emerald-200/80">
                  This gameweek only has a total score stored – a per-monster
                  breakdown was not recorded.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {gwSquad?.gameweek && (
                <div className="rounded-xl border border-emerald-400/70 bg-emerald-500/10 px-3 py-1.5 text-right min-w-[90px]">
                  <p className="text-[10px] uppercase tracking-wide text-emerald-200">
                    GW total
                  </p>
                  <p className="text-sm font-mono font-semibold text-emerald-50">
                    {pitchTotalPoints} pts
                  </p>
                </div>
              )}

              {hasGwHistory && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={gwIndex === null || gwIndex <= 0}
                    onClick={() => {
                      if (gwIndex === null || gwIndex <= 0) return;
                      setGwIndex(gwIndex - 1);
                    }}
                    className={`h-7 w-7 rounded-full border text-xs ${
                      gwIndex === null || gwIndex <= 0
                        ? "border-emerald-900 text-emerald-700 cursor-not-allowed"
                        : "border-emerald-500/60 text-emerald-100 hover:border-emerald-300"
                    }`}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    disabled={gwIndex === null || gwIndex >= gwHistory.length - 1}
                    onClick={() => {
                      if (gwIndex === null || gwIndex >= gwHistory.length - 1) return;
                      setGwIndex(gwIndex + 1);
                    }}
                    className={`h-7 w-7 rounded-full border text-xs ${
                      gwIndex === null || gwIndex >= gwHistory.length - 1
                        ? "border-emerald-900 text-emerald-700 cursor-not-allowed"
                        : "border-emerald-500/60 text-emerald-100 hover:border-emerald-300"
                    }`}
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-900 to-emerald-950 px-3 py-6">
            <div className="pointer-events-none absolute inset-x-6 top-4 h-10 rounded-full border border-emerald-500/40" />
            <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 border-t border-emerald-500/40" />
            <div className="pointer-events-none absolute inset-x-8 bottom-4 h-12 rounded-full border border-emerald-500/40" />

            <div className="relative flex flex-col gap-6">
              {/* GK */}
              <div className="flex justify-center mb-4">
                {pitchByLine.GK.length ? (
                  pitchByLine.GK.map((m) => (
                    <PitchCard
                      key={m.id}
                      monster={m}
                      onClickDetails={() => setDetailMonsterId(m.id)}
                    />
                  ))
                ) : (
                  <PitchPlaceholder label="GK" />
                )}
              </div>

              {/* DEF */}
              <div className="flex justify-center gap-3 mb-4">
                {pitchByLine.DEF.length ? (
                  pitchByLine.DEF.map((m) => (
                    <PitchCard
                      key={m.id}
                      monster={m}
                      onClickDetails={() => setDetailMonsterId(m.id)}
                    />
                  ))
                ) : (
                  <PitchPlaceholder label="DEF" />
                )}
              </div>

              {/* MID */}
              <div className="flex justify-center gap-3 mb-4">
                {pitchByLine.MID.length ? (
                  pitchByLine.MID.map((m) => (
                    <PitchCard
                      key={m.id}
                      monster={m}
                      onClickDetails={() => setDetailMonsterId(m.id)}
                    />
                  ))
                ) : (
                  <PitchPlaceholder label="MID" />
                )}
              </div>

              {/* FWD */}
              <div className="flex justify-center gap-3">
                {pitchByLine.FWD.length ? (
                  pitchByLine.FWD.map((m) => (
                    <PitchCard
                      key={m.id}
                      monster={m}
                      onClickDetails={() => setDetailMonsterId(m.id)}
                    />
                  ))
                ) : (
                  <PitchPlaceholder label="FWD" />
                )}
              </div>
            </div>
          </div>

          {hasGwHistory && (
            <section className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-300">
              <p className="mb-1 font-semibold text-slate-100">
                Gameweek history
              </p>
              <div className="flex flex-wrap gap-2">
                {gwHistory.map((gw, idx) => (
                  <button
                    key={gw.gameweekId}
                    type="button"
                    onClick={() => setGwIndex(idx)}
                    className={`rounded-full px-2 py-1 border text-[10px] ${
                      idx === gwIndex
                        ? "border-emerald-400 bg-emerald-400/10 text-emerald-200"
                        : "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-emerald-300"
                    }`}
                  >
                    GW {gw.number}:{" "}
                    <span className="font-mono">{gw.points}</span> pts
                  </button>
                ))}
              </div>
            </section>
          )}
        </section>
      </main>

      {detailMonsterId && (
        <MonsterDetailModal
          monsterId={detailMonsterId}
          onClose={() => setDetailMonsterId(null)}
        />
      )}
    </>
  );
}

function PitchCard({
  monster,
  onClickDetails,
}: {
  monster: PitchMonster;
  onClickDetails?: () => void;
}) {
  const artUrl = getArtUrlForMonster(monster);

  return (
    <div className="min-w-[90px] rounded-lg border border-emerald-300/70 bg-emerald-900/80 px-2 py-2 text-center shadow-md flex flex-col items-center">
      <div className="mb-1 w-12 h-16 overflow-hidden rounded-[6px] border border-emerald-300/60 bg-slate-900/60">
        <img
          src={artUrl}
          alt={monster.displayName}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="text-[11px] font-semibold text-emerald-50 truncate max-w-[90px]">
        {monster.displayName}
      </div>
      <div className="text-[9px] text-emerald-200">
        {monster.position} • {monster.club}
        {monster.isSub ? " • SUB" : ""}
      </div>
      {typeof monster.gameweekPoints === "number" && (
        <div className="mt-1 rounded-full bg-emerald-800/80 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-50">
          GW pts:{" "}
          <span className="text-[12px] text-emerald-300">
            {monster.gameweekPoints}
          </span>
        </div>
      )}
      {onClickDetails && (
        <button
          type="button"
          onClick={onClickDetails}
          className="mt-1 inline-flex items-center rounded-full border border-emerald-500/60 px-2 py-0.5 text-[9px] text-emerald-100 hover:border-emerald-300"
        >
          View
        </button>
      )}
    </div>
  );
}

function PitchPlaceholder({ label }: { label: string }) {
  return (
    <div className="min-w-[70px] rounded-full border border-emerald-500/40 bg-emerald-900/40 px-3 py-1 text-center text-[10px] uppercase text-emerald-200">
      {label}
    </div>
  );
}
