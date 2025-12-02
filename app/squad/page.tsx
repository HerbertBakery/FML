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
  artBasePath?: string | null;
  setCode?: string | null;
  editionType?: string | null;
  editionLabel?: string | null;
  serialNumber?: number | null;
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

type GameweekHistoryEntry = {
  gameweekId: string;
  number: number;
  name: string | null;
  points: number;
};

type GameweekSquadMonster = UserMonsterDTO & {
  isSub: boolean;
  gameweekPoints: number;
};

type GameweekSquadResponse = {
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

function getArtUrlForMonster(m: UserMonsterDTO): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) return `/cards/base/${m.templateCode}.png`;
  return "/cards/base/test.png";
}

function preloadImages(urls: string[]): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  const unique = Array.from(
    new Set(urls.filter((u) => typeof u === "string" && u.length > 0))
  );
  if (!unique.length) return Promise.resolve();

  return new Promise((resolve) => {
    let loaded = 0;
    const total = unique.length;

    unique.forEach((url) => {
      const img = new window.Image();
      img.onload = img.onerror = () => {
        loaded += 1;
        if (loaded >= total) resolve();
      };
      img.src = url;
    });
  });
}

export default function SquadPage() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);

  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [detailMonsterId, setDetailMonsterId] = useState<string | null>(null);
  const maxPlayers = 6;

  // Filters/search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterPosition, setFilterPosition] = useState<string>("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");

  // Gameweek history + current GW view
  const [gwHistory, setGwHistory] = useState<GameweekHistoryEntry[]>([]);
  const [gwIndex, setGwIndex] = useState<number | null>(null);
  const [gwSquad, setGwSquad] = useState<GameweekSquadResponse | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwError, setGwError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "include" });

        if (!meRes.ok) {
          setUser(null);
          return;
        }

        const meData = await meRes.json();
        setUser(meData.user);

        const colRes = await fetch("/api/me/collection", {
          credentials: "include",
        });
        if (colRes.ok) {
          const colData: CollectionResponse = await colRes.json();
          setCollection(colData.monsters);

          const preview = colData.monsters.slice(0, 24);
          const urls = preview.map((m) => getArtUrlForMonster(m));
          void preloadImages(urls);
        }

        const squadRes = await fetch("/api/squad", {
          credentials: "include",
        });
        if (squadRes.ok) {
          const squadData: SquadResponse = await squadRes.json();
          if (squadData.squad) {
            setSelectedIds(squadData.squad.monsters.map((m) => m.id));
          }
        }

        const gwRes = await fetch("/api/me/gameweeks", {
          credentials: "include",
        });
        if (gwRes.ok) {
          const data = await gwRes.json();
          const entries: GameweekHistoryEntry[] = data.entries ?? [];
          setGwHistory(entries);
          if (entries.length > 0) {
            setGwIndex(entries.length - 1); // latest GW
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

  // When gwIndex changes, load that gameweek’s locked squad (for history view)
  useEffect(() => {
    if (gwIndex === null || gwHistory.length === 0) return;

    const entry = gwHistory[gwIndex];
    const number = entry.number;

    const loadGwSquad = async () => {
      setGwLoading(true);
      setGwError(null);
      try {
        const res = await fetch(
          `/api/me/gameweek-squad?gameweekNumber=${number}`,
          { credentials: "include" }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setGwSquad(null);
          setGwError(data?.error || "Failed to load gameweek squad.");
          return;
        }
        const data: GameweekSquadResponse = await res.json();
        setGwSquad(data);
      } catch {
        setGwSquad(null);
        setGwError("Failed to load gameweek squad.");
      } finally {
        setGwLoading(false);
      }
    };

    void loadGwSquad();
  }, [gwIndex, gwHistory]);

  const selectedMonsters = useMemo(
    () => collection.filter((m) => selectedIds.includes(m.id)),
    [collection, selectedIds]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const m of selectedMonsters) {
      if (c[m.position] !== undefined) c[m.position]++;
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
      if (prev.includes(monsterId)) return prev.filter((id) => id !== monsterId);
      if (prev.length >= maxPlayers) return prev;
      return [...prev, monsterId];
    });
  }

  // Save default squad + submit/overwrite entry for current gameweek
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
      // 1) Save / overwrite your default 6-monster squad
      const squadRes = await fetch("/api/squad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userMonsterIds: selectedIds }),
      });

      const squadData = await squadRes.json().catch(() => null);
      if (!squadRes.ok) {
        setError(squadData?.error || "Failed to save your default squad.");
        return;
      }

      // 2) Lock / overwrite your entry for the *current* gameweek
      const gwRes = await fetch("/api/gameweeks/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userMonsterIds: selectedIds }),
      });

      const gwData = await gwRes.json().catch(() => null);

      if (!gwRes.ok) {
        // This will surface "Deadline has passed for the current gameweek."
        setError(
          gwData?.error ||
            "Your squad was saved, but we couldn’t update it for the current gameweek."
        );
        return;
      }

      setSuccess(
        "Squad saved for the current gameweek. You can still make changes and resubmit until the deadline."
      );

      // Optional: refresh history / GW squad after save if you want
      // but not required for pitch to update
    } catch {
      setError("Something went wrong saving and locking your squad.");
    } finally {
      setSaving(false);
    }
  }

  const availableClubs = useMemo(() => {
    const set = new Set<string>();
    for (const m of collection) if (m.club) set.add(m.club);
    return Array.from(set).sort();
  }, [collection]);

  const availableRarities = useMemo(() => {
    const set = new Set<string>();
    for (const m of collection) if (m.rarity) set.add(m.rarity.toUpperCase());
    return Array.from(set).sort();
  }, [collection]);

  const filteredCollection = useMemo(() => {
    let list = [...collection];
    const term = searchTerm.trim().toLowerCase();

    if (term) {
      list = list.filter(
        (m) =>
          m.displayName.toLowerCase().includes(term) ||
          m.realPlayerName.toLowerCase().includes(term) ||
          m.club.toLowerCase().includes(term)
      );
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

  const grouped = useMemo(
    () => ({
      GK: filteredCollection.filter((m) => m.position === "GK"),
      DEF: filteredCollection.filter((m) => m.position === "DEF"),
      MID: filteredCollection.filter((m) => m.position === "MID"),
      FWD: filteredCollection.filter((m) => m.position === "FWD"),
    }),
    [filteredCollection]
  );

  const hasGwHistory = gwHistory.length > 0 && gwIndex !== null;

  // 👉 New logic: decide what the pitch uses.
  // - Latest GW (default view on this page): always show live selection.
  // - When you navigate BACK with ← to an older GW: show the locked squad for that GW.
  const viewingLatestGw =
    hasGwHistory && gwIndex !== null && gwIndex === gwHistory.length - 1;

  const hasLockedGwSquad =
    gwSquad && gwSquad.monsters && gwSquad.monsters.length > 0;

  const shouldUseLockedGw = hasLockedGwSquad && !viewingLatestGw;

  const pitchSource: PitchMonster[] = shouldUseLockedGw
    ? gwSquad!.monsters
    : selectedMonsters;

  const pitchByLine = useMemo(() => {
    const gk: PitchMonster[] = [];
    const def: PitchMonster[] = [];
    const mid: PitchMonster[] = [];
    const fwd: PitchMonster[] = [];

    for (const m of pitchSource) {
      switch (m.position) {
        case "GK":
          gk.push(m);
          break;
        case "DEF":
          def.push(m);
          break;
        case "MID":
          mid.push(m);
          break;
        case "FWD":
          fwd.push(m);
          break;
      }
    }
    return { GK: gk, DEF: def, MID: mid, FWD: fwd };
  }, [pitchSource]);

  if (checking) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">Loading your squad builder...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">Log in to manage your squad</h2>
          <p className="text-sm text-slate-300 mb-3">
            You need an account to build and lock your 6-monster team for the upcoming
            gameweek.
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

  const hasEnoughPlayers = collection.length >= maxPlayers;

  // Only show GW total / header as "history" when looking at an older GW
  const showGwOnPitch = shouldUseLockedGw && !!gwSquad?.gameweek;
  const pitchTotalPoints = showGwOnPitch ? gwSquad!.totalPoints : 0;

  return (
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Build your 6-monster matchday squad
          </h2>
          <p className="text-xs text-slate-400 mb-2">
            Pick exactly 6 monsters: you must have exactly 1 Goalkeeper plus at least 1
            Defender, 1 Midfielder, and 1 Forward. The extra 2 outfielders act as your
            subs for this gameweek.
          </p>
          <p className="text-xs text-slate-400">
            Signed in as <span className="font-mono">{user.email}</span>
          </p>
        </section>

        {!hasEnoughPlayers ? (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <h3 className="font-semibold text-amber-300 mb-1">You need more monsters</h3>
            <p className="text-xs text-amber-100">
              You currently own {collection.length} monsters. Open your starter packs on
              the{" "}
              <Link href="/" className="underline underline-offset-2">
                home page
              </Link>{" "}
              until you have at least 6 monsters to build a squad.
            </p>
          </section>
        ) : (
          <>
            {/* Squad status */}
            <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <h3 className="font-semibold text-emerald-300">Squad status</h3>
                  <p className="text-xs text-emerald-100">
                    Selected {selectedIds.length}/{maxPlayers} players
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

              {error && <p className="text-xs text-red-400">{error}</p>}
              {success && <p className="text-xs text-emerald-300">{success}</p>}

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
                {saving ? "Saving..." : "Save Squad for Current Gameweek"}
              </button>
            </section>

            {/* Pitch view with GW points + arrows */}
            <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-100">
                    Pitch view
                  </h3>
                  {showGwOnPitch ? (
                    <p className="text-[11px] text-emerald-200">
                      Gameweek {gwSquad!.gameweek!.number}{" "}
                      {gwSquad!.gameweek!.name ? `– ${gwSquad!.gameweek!.name}` : ""}{" "}
                      (locked view)
                    </p>
                  ) : (
                    <p className="text-[11px] text-emerald-200">
                      Showing your current selection for the active gameweek. Changes
                      here update live as you pick or remove monsters.
                    </p>
                  )}
                  {gwLoading && (
                    <p className="text-[11px] text-emerald-300">
                      Loading gameweek squad...
                    </p>
                  )}
                  {gwError && (
                    <p className="text-[11px] text-red-300">
                      {gwError}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {showGwOnPitch && (
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
                        disabled={
                          gwIndex === null || gwIndex >= gwHistory.length - 1
                        }
                        onClick={() => {
                          if (
                            gwIndex === null ||
                            gwIndex >= gwHistory.length - 1
                          )
                            return;
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
                {/* Pitch lines */}
                <div className="pointer-events-none absolute inset-x-6 top-4 h-10 rounded-full border border-emerald-500/40" />
                <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px -translate-y-1/2 border-t border-emerald-500/40" />
                <div className="pointer-events-none absolute inset-x-8 bottom-4 h-12 rounded-full border border-emerald-500/40" />

                <div className="relative flex flex-col gap-6">
                  {/* GK */}
                  <div className="flex justify-center mb-4">
                    {pitchByLine.GK.length ? (
                      pitchByLine.GK.map((m) => (
                        <PitchCard key={m.id} monster={m} />
                      ))
                    ) : (
                      <PitchPlaceholder label="GK" />
                    )}
                  </div>

                  {/* DEF */}
                  <div className="flex justify-center gap-3 mb-4">
                    {pitchByLine.DEF.length ? (
                      pitchByLine.DEF.map((m) => (
                        <PitchCard key={m.id} monster={m} />
                      ))
                    ) : (
                      <PitchPlaceholder label="DEF" />
                    )}
                  </div>

                  {/* MID */}
                  <div className="flex justify-center gap-3 mb-4">
                    {pitchByLine.MID.length ? (
                      pitchByLine.MID.map((m) => (
                        <PitchCard key={m.id} monster={m} />
                      ))
                    ) : (
                      <PitchPlaceholder label="MID" />
                    )}
                  </div>

                  {/* FWD */}
                  <div className="flex justify-center gap-3">
                    {pitchByLine.FWD.length ? (
                      pitchByLine.FWD.map((m) => (
                        <PitchCard key={m.id} monster={m} />
                      ))
                    ) : (
                      <PitchPlaceholder label="FWD" />
                    )}
                  </div>
                </div>
              </div>

              {!pitchSource.length && (
                <p className="mt-3 text-[11px] text-emerald-200">
                  Select monsters from your collection below to see them appear on the
                  pitch.
                </p>
              )}
            </section>

            {/* Search & filters */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 mb-1">
                Search & filters
              </h3>
              <p className="text-[11px] text-slate-400 mb-1">
                Filter your collection while picking your 6-monster squad.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
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
                </div>
              </div>

              <div className="flex justify-end">
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
            </section>

            {/* Position groups (uses filteredCollection) */}
            <section className="space-y-4">
              {(["GK", "DEF", "MID", "FWD"] as const).map((pos) => {
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
                        const selected = selectedIds.includes(monster.id);
                        const disabled =
                          !selected && selectedIds.length >= maxPlayers;
                        const artUrl = getArtUrlForMonster(monster);

                        return (
                          <button
                            key={monster.id}
                            type="button"
                            onClick={() => !disabled && toggleSelect(monster.id)}
                            className={`text-left rounded-xl border p-3 text-xs transition ${
                              selected
                                ? "border-emerald-400 bg-emerald-500/10"
                                : disabled
                                ? "border-slate-800 bg-slate-950/40 opacity-50 cursor-not-allowed"
                                : "border-slate-700 bg-slate-950/60 hover:border-emerald-400"
                            }`}
                          >
                            <div className="mb-2 relative w-full overflow-hidden rounded-lg aspect-[3/4]">
                              <img
                                src={artUrl}
                                alt={monster.displayName}
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold">
                                {monster.displayName}
                              </span>
                              <span className="text-[10px] uppercase text-emerald-300">
                                {monster.rarity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              {monster.realPlayerName} • {monster.club}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {monster.position} • ATK {monster.baseAttack} • MAG{" "}
                              {monster.baseMagic} • DEF {monster.baseDefense}
                            </p>
                            <p className="text-[10px] text-emerald-300 mt-1">
                              Evo Lv. {monster.evolutionLevel}
                            </p>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailMonsterId(monster.id);
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
              })}
            </section>
          </>
        )}
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

function PitchCard({ monster }: { monster: PitchMonster }) {
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
