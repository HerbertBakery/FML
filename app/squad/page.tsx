// app/squad/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonsterDetailModal from "@/components/MonsterDetailModal";

type User = {
  id: string;
  email: string;
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
};

type CollectionResponse = {
  monsters: UserMonsterDTO[];
  starterPacksOpened: number;
};

type SquadResponse = {
  squad: {
    id: string;
    monsters: UserMonsterDTO[];
  } | null;
};

export default function SquadPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // NEW: which monster to show in detail modal
  const [detailMonsterId, setDetailMonsterId] =
    useState<string | null>(null);

  const maxPlayers = 6;

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!meRes.ok) {
          setUser(null);
          return;
        }

        const meData = await meRes.json();
        setUser(meData.user);

        const colRes = await fetch(
          "/api/me/collection",
          {
            credentials: "include",
          }
        );

        if (colRes.ok) {
          const colData: CollectionResponse =
            await colRes.json();
          setCollection(colData.monsters);
        }

        const squadRes = await fetch("/api/squad", {
          credentials: "include",
        });

        if (squadRes.ok) {
          const squadData: SquadResponse =
            await squadRes.json();
          if (squadData.squad) {
            setSelectedIds(
              squadData.squad.monsters.map((m) => m.id)
            );
          }
        }
      } catch {
        setUser(null);
      } finally {
        setChecking(false);
      }
    };

    load();
  }, []);

  const selectedMonsters = useMemo(
    () =>
      collection.filter((m) =>
        selectedIds.includes(m.id)
      ),
    [collection, selectedIds]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      GK: 0,
      DEF: 0,
      MID: 0,
      FWD: 0,
    };
    for (const m of selectedMonsters) {
      if (c[m.position] !== undefined) {
        c[m.position]++;
      }
    }
    return c;
  }, [selectedMonsters]);

  const isValidSquad =
    selectedIds.length === maxPlayers &&
    counts.GK === 1 &&
    counts.DEF >= 1 &&
    counts.MID >= 1 &&
    counts.FWD >= 1;

  function toggleSelect(monsterId: string) {
    setError(null);
    setSuccess(null);

    setSelectedIds((prev) => {
      if (prev.includes(monsterId)) {
        return prev.filter((id) => id !== monsterId);
      }
      if (prev.length >= maxPlayers) {
        return prev;
      }
      return [...prev, monsterId];
    });
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (!isValidSquad) {
      setError(
        "You must pick exactly 6 monsters, including exactly 1 GK and at least 1 DEF, 1 MID, and 1 FWD."
      );
      return;
    }

    setSaving(true);
    try {
      const squadRes = await fetch("/api/squad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userMonsterIds: selectedIds,
        }),
      });

      const squadData = await squadRes
        .json()
        .catch(() => null);

      if (!squadRes.ok) {
        setError(
          squadData?.error ||
            "Failed to save squad. Please try again."
        );
        return;
      }

      const gwRes = await fetch(
        "/api/gameweeks/entry",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            userMonsterIds: selectedIds,
          }),
        }
      );

      const gwData = await gwRes
        .json()
        .catch(() => null);

      if (!gwRes.ok) {
        setError(
          gwData?.error ||
            "Squad saved but failed to lock for the current gameweek."
        );
        return;
      }

      setSuccess(
        "Squad saved and locked for the current gameweek. You’re ready!"
      );
    } catch {
      setError(
        "Something went wrong saving and locking your squad."
      );
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    return {
      GK: collection.filter(
        (m) => m.position === "GK"
      ),
      DEF: collection.filter(
        (m) => m.position === "DEF"
      ),
      MID: collection.filter(
        (m) => m.position === "MID"
      ),
      FWD: collection.filter(
        (m) => m.position === "FWD"
      ),
    };
  }, [collection]);

  const selectedByLine = useMemo(
    () => ({
      GK: selectedMonsters.filter(
        (m) => m.position === "GK"
      ),
      DEF: selectedMonsters.filter(
        (m) => m.position === "DEF"
      ),
      MID: selectedMonsters.filter(
        (m) => m.position === "MID"
      ),
      FWD: selectedMonsters.filter(
        (m) => m.position === "FWD"
      ),
    }),
    [selectedMonsters]
  );

  if (checking) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading your squad builder...
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Log in to manage your squad
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            You need an account to build and lock your
            6-monster team for the upcoming gameweek.
          </p>
          <div className="flex gap-3">
            <Link
              href="/register"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-300"
            >
              Log In
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const hasEnoughPlayers =
    collection.length >= maxPlayers;

  return (
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Build your 6-monster matchday squad
          </h2>
          <p className="text-xs text-slate-400 mb-2">
            Pick exactly 6 monsters: you must have
            exactly 1 Goalkeeper plus at least 1
            Defender, 1 Midfielder, and 1 Forward. The
            extra 2 outfielders act as your subs for
            this gameweek.
          </p>
          <p className="text-xs text-slate-400">
            Signed in as{" "}
            <span className="font-mono">
              {user.email}
            </span>
          </p>
        </section>

        {!hasEnoughPlayers ? (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <h3 className="font-semibold text-amber-300 mb-1">
              You need more monsters
            </h3>
            <p className="text-xs text-amber-100">
              You currently own {collection.length} monsters.
              Open your starter packs on the{" "}
              <Link
                href="/"
                className="underline underline-offset-2"
              >
                home page
              </Link>{" "}
              until you have at least 6 monsters to build
              a squad.
            </p>
          </section>
        ) : (
          <>
            {/* Squad status */}
            <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <h3 className="font-semibold text-emerald-300">
                    Squad status
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Selected {selectedIds.length}/
                    {maxPlayers} players
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px]">
                  <span>
                    GK:{" "}
                    <span className="font-semibold text-emerald-200">
                      {counts.GK}
                    </span>
                  </span>
                  <span>
                    DEF:{" "}
                    <span className="font-semibold text-emerald-200">
                      {counts.DEF}
                    </span>
                  </span>
                  <span>
                    MID:{" "}
                    <span className="font-semibold text-emerald-200">
                      {counts.MID}
                    </span>
                  </span>
                  <span>
                    FWD:{" "}
                    <span className="font-semibold text-emerald-200">
                      {counts.FWD}
                    </span>
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-400">
                  {error}
                </p>
              )}
              {success && (
                <p className="text-xs text-emerald-300">
                  {success}
                </p>
              )}

              <button
                type="button"
                disabled={saving || !isValidSquad}
                onClick={handleSave}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  saving || !isValidSquad
                    ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                    : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                }`}
              >
                {saving
                  ? "Saving & locking..."
                  : "Save Squad & Lock for Gameweek"}
              </button>
            </section>

            {/* Football pitch view */}
            <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-4">
              <h3 className="text-sm font-semibold text-emerald-100 mb-2">
                Pitch view
              </h3>
              <p className="text-[11px] text-emerald-200 mb-3">
                Your selected monsters, laid out on a football
                field by position.
              </p>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-900 to-emerald-950 px-3 py-6">
                {/* Pitch lines */}
                <div className="pointer-events-none absolute inset-x-6 top-4 h-10 rounded-full border border-emerald-500/40" />
                <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 border-t border-emerald-500/40" />
                <div className="pointer-events-none absolute inset-x-8 bottom-4 h-12 rounded-full border border-emerald-500/40" />

                {/* GK line */}
                <div className="relative flex flex-col gap-6">
                  <div className="flex justify-center mb-4">
                    {selectedByLine.GK.length ? (
                      selectedByLine.GK.map((m) => (
                        <PitchCard
                          key={m.id}
                          monster={m}
                        />
                      ))
                    ) : (
                      <PitchPlaceholder label="GK" />
                    )}
                  </div>

                  {/* DEF line */}
                  <div className="flex justify-center gap-3 mb-4">
                    {selectedByLine.DEF.length ? (
                      selectedByLine.DEF.map((m) => (
                        <PitchCard
                          key={m.id}
                          monster={m}
                        />
                      ))
                    ) : (
                      <PitchPlaceholder label="DEF" />
                    )}
                  </div>

                  {/* MID line */}
                  <div className="flex justify-center gap-3 mb-4">
                    {selectedByLine.MID.length ? (
                      selectedByLine.MID.map((m) => (
                        <PitchCard
                          key={m.id}
                          monster={m}
                        />
                      ))
                    ) : (
                      <PitchPlaceholder label="MID" />
                    )}
                  </div>

                  {/* FWD line */}
                  <div className="flex justify-center gap-3">
                    {selectedByLine.FWD.length ? (
                      selectedByLine.FWD.map((m) => (
                        <PitchCard
                          key={m.id}
                          monster={m}
                        />
                      ))
                    ) : (
                      <PitchPlaceholder label="FWD" />
                    )}
                  </div>
                </div>
              </div>

              {selectedMonsters.length === 0 && (
                <p className="mt-3 text-[11px] text-emerald-200">
                  Select monsters from your collection below to see
                  them appear on the pitch.
                </p>
              )}
            </section>

            {/* Selection by position */}
            <section className="space-y-4">
              {(["GK", "DEF", "MID", "FWD"] as const).map(
                (pos) => {
                  const labelMap: Record<string, string> = {
                    GK: "Goalkeepers",
                    DEF: "Defenders",
                    MID: "Midfielders",
                    FWD: "Forwards",
                  };
                  const monsters = grouped[pos];

                  if (!monsters.length) return null;

                  return (
                    <div
                      key={pos}
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4"
                    >
                      <h3 className="text-sm font-semibold mb-2">
                        {labelMap[pos]} ({monsters.length})
                      </h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {monsters.map((monster) => {
                          const selected =
                            selectedIds.includes(
                              monster.id
                            );
                          const disabled =
                            !selected &&
                            selectedIds.length >=
                              maxPlayers;

                          return (
                            <button
                              key={monster.id}
                              type="button"
                              onClick={() =>
                                !disabled &&
                                toggleSelect(monster.id)
                              }
                              className={`text-left rounded-xl border p-3 text-xs transition ${
                                selected
                                  ? "border-emerald-400 bg-emerald-500/10"
                                  : disabled
                                  ? "border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed"
                                  : "border-slate-700 bg-slate-950/60 hover:border-emerald-400"
                              }`}
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
                                {monster.realPlayerName} •{" "}
                                {monster.club}
                              </p>
                              <p className="text-[11px] text-slate-400 mt-1">
                                {monster.position} • ATK{" "}
                                {monster.baseAttack} • MAG{" "}
                                {monster.baseMagic} • DEF{" "}
                                {monster.baseDefense}
                              </p>
                              <p className="text-[10px] text-emerald-300 mt-1">
                                Evo Lv.{" "}
                                {monster.evolutionLevel}
                              </p>

                              {/* NEW: view details button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailMonsterId(
                                    monster.id
                                  );
                                }}
                                className="mt-2 inline-flex items-center rounded-full border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
                              >
                                View details
                              </button>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
              )}
            </section>
          </>
        )}
      </main>

      {/* NEW: shared monster detail modal */}
      {detailMonsterId && (
        <MonsterDetailModal
          monsterId={detailMonsterId}
          onClose={() => setDetailMonsterId(null)}
        />
      )}
    </>
  );
}

function PitchCard({ monster }: { monster: UserMonsterDTO }) {
  return (
    <div className="min-w-[90px] rounded-lg border border-emerald-300/70 bg-emerald-900/80 px-2 py-1 text-center shadow-md">
      <div className="text-[11px] font-semibold text-emerald-50">
        {monster.displayName}
      </div>
      <div className="text-[9px] text-emerald-200">
        {monster.position} • {monster.club}
      </div>
      <div className="text-[9px] text-emerald-300 mt-0.5">
        ATK {monster.baseAttack} • DEF{" "}
        {monster.baseDefense}
      </div>
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
