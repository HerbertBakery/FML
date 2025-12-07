// app/squad/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonsterDetailModal from "@/components/MonsterDetailModal";
import type { ActiveChipInfo } from "@/components/MonsterCard";
import MonsterChipBadge from "@/components/MonsterChipBadge";

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

// /api/me/chips DTO slice (now used for sidebar + monster pill)
type MeChipAssignmentDTO = {
  id: string;
  gameweekId: string;
  gameweekNumber: number;
  userMonsterId: string;
  monsterName: string;
  monsterRealPlayerName: string;
  createdAt: string;
  resolvedAt: string | null;
  wasSuccessful: boolean | null;
};

type MeChipDTO = {
  id: string;
  isConsumed: boolean;
  remainingTries: number;
  template: {
    id: string;
    code: string;
    name: string;
  };
  assignments: MeChipAssignmentDTO[];
};

type MeChipsResponse = {
  chips: MeChipDTO[];
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

// Build map userMonsterId -> ActiveChipInfo (for pitch/card pills)
function buildMonsterChipMapFromChips(
  chips: MeChipDTO[]
): Record<string, ActiveChipInfo> {
  const map: Record<string, ActiveChipInfo> = {};

  for (const chip of chips ?? []) {
    if (chip.isConsumed) continue;

    for (const asgn of chip.assignments ?? []) {
      if (asgn.resolvedAt) continue;

      map[asgn.userMonsterId] = {
        name: chip.template.name,
        code: chip.template.code,
        gameweekNumber: asgn.gameweekNumber ?? null,
      };
    }
  }

  return map;
}

// Simple status text for chips sidebar
function chipStatusLabel(chip: MeChipDTO): string {
  const tries = chip.remainingTries ?? 0;

  if (chip.isConsumed) {
    return "Consumed";
  }

  const activeAssignment = chip.assignments.find((a) => a.resolvedAt === null);

  if (activeAssignment) {
    return `Assigned · GW ${activeAssignment.gameweekNumber} · ${tries} tries left`;
  }

  return `Available · ${tries} tries left`;
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
  const maxPlayers = 7;

  // Filters/search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterPosition, setFilterPosition] = useState<string>("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");

  // Chips: map from monsterId -> active chip info (for pill on card/pitch)
  const [monsterChipMap, setMonsterChipMap] = useState<
    Record<string, ActiveChipInfo>
  >({});

  // Full chips inventory for sidebar + pill mapping
  const [chips, setChips] = useState<MeChipDTO[]>([]);
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [chipAssignLoading, setChipAssignLoading] = useState(false);
  const [chipAssignMessage, setChipAssignMessage] = useState<string | null>(
    null
  );

  // Gameweek history + current GW view
  const [gwHistory, setGwHistory] = useState<GameweekHistoryEntry[]>([]);
  const [gwIndex, setGwIndex] = useState<number | null>(null);
  const [gwSquad, setGwSquad] = useState<GameweekSquadResponse | null>(null);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwError, setGwError] = useState<string | null>(null);

  // Load initial data
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

        // Collection
        const colRes = await fetch("/api/me/collection", {
          credentials: "include",
        });
        if (colRes.ok) {
          const colData: CollectionResponse = await colRes.json();
          setCollection(colData.monsters);

          const urls = colData.monsters.map((m) => getArtUrlForMonster(m));
          void preloadImages(urls);
        }

        // Default squad
        const squadRes = await fetch("/api/squad", {
          credentials: "include",
        });
        if (squadRes.ok) {
          const squadData: SquadResponse = await squadRes.json();
          if (squadData.squad) {
            setSelectedIds(squadData.squad.monsters.map((m) => m.id));
          }
        }

        // GW history
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

        // Chips (for evo pill + sidebar)
        const chipsRes = await fetch("/api/me/chips", {
          credentials: "include",
        });
        if (chipsRes.ok) {
          const chipsData: MeChipsResponse = await chipsRes.json();
          const list = chipsData.chips ?? [];
          setChips(list);
          setMonsterChipMap(buildMonsterChipMapFromChips(list));
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
      // Deselect
      if (prev.includes(monsterId)) {
        return prev.filter((id) => id !== monsterId);
      }

      // Don't exceed total squad size
      if (prev.length >= maxPlayers) {
        return prev;
      }

      const monster = collection.find((m) => m.id === monsterId);
      if (!monster) return prev;

      // Enforce max 1 GK in selection
      if (monster.position === "GK") {
        const currentGKCount = collection.filter(
          (m) => prev.includes(m.id) && m.position === "GK"
        ).length;

        if (currentGKCount >= 1) {
          setError("You can only select 1 Goalkeeper.");
          return prev;
        }
      }

      return [...prev, monsterId];
    });
  }

  // Save default squad + submit/overwrite entry for current gameweek
  async function handleSave() {
    setError(null);
    setSuccess(null);

    if (!isValidSquad) {
      setError(
        "You must pick exactly 7 monsters, including exactly 1 GK and at least 1 DEF, 1 MID, and 1 FWD."
      );
      return;
    }

    setSaving(true);
    try {
      // 1) Save / overwrite your default 7-monster squad
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
        setError(
          gwData?.error ||
            "Your squad was saved, but we couldn’t update it for the current gameweek."
        );
        return;
      }

      setSuccess(
        "Squad saved for the current gameweek. You can still make changes and resubmit until the deadline."
      );
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

  // ---- Derived GW + pitch + chip mode state ----

  const hasEnoughPlayers = collection.length >= maxPlayers;

  const hasGwHistoryFlag = gwHistory.length > 0 && gwIndex !== null;

  const viewingLatestGw =
    hasGwHistoryFlag &&
    gwIndex !== null &&
    gwIndex === gwHistory.length - 1;

  const hasLockedGwSquad =
    gwSquad && gwSquad.monsters && gwSquad.monsters.length > 0;

  const shouldUseLockedGw = !!hasLockedGwSquad && !viewingLatestGw;

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

  const selectedChipInfo =
    chips.find((c) => c.id === selectedChipId) ?? null;

  const chipMode = !!selectedChipInfo;

  const showGwOnPitch = shouldUseLockedGw && !!gwSquad?.gameweek;
  const pitchTotalPoints = showGwOnPitch ? gwSquad!.totalPoints : 0;

  // ---- Usable chips for sidebar (only chips you can actually assign) ----
  const usableChips = useMemo(() => {
    return chips.filter((chip) => {
      const hasTries =
        !chip.isConsumed && (chip.remainingTries ?? 0) > 0;
      if (!hasTries) return false;

      const hasActiveAssignment = chip.assignments.some(
        (a) => a.resolvedAt === null
      );

      // Only show chips that are free to be assigned right now
      return !hasActiveAssignment;
    });
  }, [chips]);

  // ---- Chip assignment: auto GW for "upcoming" ----

  async function handleAssignChipToMonster(monsterId: string) {
    if (!selectedChipInfo || chipAssignLoading) return;

    setChipAssignMessage(null);

    if (
      selectedChipInfo.isConsumed ||
      (selectedChipInfo.remainingTries ?? 0) <= 0
    ) {
      setChipAssignMessage("This chip has no tries left.");
      return;
    }

    const activeAssignment = selectedChipInfo.assignments?.find(
      (a) => a.resolvedAt === null
    );
    if (activeAssignment) {
      setChipAssignMessage(
        "This chip is already armed on a monster for an upcoming gameweek."
      );
      return;
    }

    // Auto-determine the "current" gameweek:
    // - If you have GW history, we assume you're now setting up for the next one.
    // - If you have no history yet, we treat it as GW 1.
    let gw: number;
    if (gwHistory.length > 0) {
      gw = gwHistory[gwHistory.length - 1].number + 1;
    } else {
      gw = 1;
    }

    setChipAssignLoading(true);
    try {
      const res = await fetch("/api/admin/chips/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userMonsterId: monsterId,
          userChipId: selectedChipInfo.id,
          gameweekNumber: gw,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any).error || "Failed to assign chip.");
      }

      setChipAssignMessage(
        `Chip "${selectedChipInfo.template.name}" armed for this upcoming gameweek.`
      );

      // After a successful assignment:
      // - Reload chips so UI reflects assignment + tries + monster mapping
      // - Clear selection so chip mode exits
      const reload = await fetch("/api/me/chips", {
        credentials: "include",
      });
      if (reload.ok) {
        const rData: MeChipsResponse = (await reload.json()) as MeChipsResponse;
        const list = rData.chips ?? [];
        setChips(list);
        setMonsterChipMap(buildMonsterChipMapFromChips(list));
      }

      setSelectedChipId(null);
    } catch (err: any) {
      setChipAssignMessage(err?.message || "Failed to assign chip.");
    } finally {
      setChipAssignLoading(false);
    }
  }

  // ---- Render ----

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
          <h2 className="text-xl font-semibold mb-2">
            Log in to manage your squad
          </h2>
          <p className="text-sm text-slate-300 mb-3">
            You need an account to build and lock your 7-monster team for the
            upcoming gameweek.
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

  return (
    <>
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-xl font-semibold mb-2">
            Build your 7-monster matchday squad
          </h2>
          <p className="text-xs text-slate-400 mb-2">
            Pick exactly 7 monsters: you must have exactly 1 Goalkeeper plus at least 1
            Defender, 1 Midfielder, and 1 Forward. All 7 monsters can score points for
            your fantasy total this gameweek.
          </p>
          <p className="text-xs text-slate-400 mb-1">
            Signed in as <span className="font-mono">{user.email}</span>
          </p>
          {chipMode && (
            <p className="text-[11px] text-emerald-300 mt-1">
              Chip mode active: click a monster on your pitch or in your collection to
              attach{" "}
              <span className="font-semibold">
                {selectedChipInfo?.template.name}
              </span>{" "}
              for this upcoming gameweek.
            </p>
          )}
        </section>

        {!hasEnoughPlayers ? (
          <section className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
            <h3 className="font-semibold text-amber-300 mb-1">
              You need more monsters
            </h3>
            <p className="text-xs text-amber-100">
              You currently own {collection.length} monsters. Open your starter
              packs on the{" "}
              <Link href="/" className="underline underline-offset-2">
                home page
              </Link>{" "}
              until you have at least 7 monsters to build a squad.
            </p>
          </section>
        ) : (
          <>
            {/* Top grid: squad status + pitch + chips sidebar */}
            <section className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.1fr)]">
              {/* Left: status + pitch */}
              <div className="space-y-4">
                {/* Squad status */}
                <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-emerald-300">
                        Squad status
                      </h3>
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
                  {success && (
                    <p className="text-xs text-emerald-300">{success}</p>
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
                      ? "Saving..."
                      : "Save Squad for Current Gameweek"}
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
                          {gwSquad!.gameweek!.name
                            ? `– ${gwSquad!.gameweek!.name}`
                            : ""}{" "}
                          (locked view)
                        </p>
                      ) : (
                        <p className="text-[11px] text-emerald-200">
                          Showing your current selection for the active
                          gameweek. Changes here update live as you pick or
                          remove monsters.
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

                      {hasGwHistoryFlag && (
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
                              gwIndex === null ||
                              gwIndex >= gwHistory.length - 1
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
                              gwIndex === null ||
                              gwIndex >= gwHistory.length - 1
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
                            <PitchCard
                              key={m.id}
                              monster={m}
                              chip={monsterChipMap[m.id]}
                              assignMode={chipMode}
                              onAssignChip={() =>
                                handleAssignChipToMonster(m.id)
                              }
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
                              chip={monsterChipMap[m.id]}
                              assignMode={chipMode}
                              onAssignChip={() =>
                                handleAssignChipToMonster(m.id)
                              }
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
                              chip={monsterChipMap[m.id]}
                              assignMode={chipMode}
                              onAssignChip={() =>
                                handleAssignChipToMonster(m.id)
                              }
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
                              chip={monsterChipMap[m.id]}
                              assignMode={chipMode}
                              onAssignChip={() =>
                                handleAssignChipToMonster(m.id)
                              }
                            />
                          ))
                        ) : (
                          <PitchPlaceholder label="FWD" />
                        )}
                      </div>
                    </div>
                  </div>

                  {!pitchSource.length && (
                    <p className="mt-3 text-[11px] text-emerald-200">
                      Select monsters from your collection below to see
                      them appear on the pitch.
                    </p>
                  )}
                </section>
              </div>

              {/* Right: Evolution chips sidebar */}
              <aside className="space-y-3">
                <section className="rounded-2xl border border-violet-500/40 bg-slate-950/70 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-violet-100">
                        Evolution chips
                      </h3>
                      <p className="text-[11px] text-slate-300">
                        Pick a chip, then click a monster on your pitch or
                        in your collection to arm it for this upcoming
                        gameweek.
                      </p>
                    </div>
                  </div>

                  {usableChips.length === 0 ? (
                    <p className="text-[11px] text-slate-400 border border-slate-700/70 bg-slate-950/60 rounded-md px-3 py-2">
                      You don&apos;t have any usable chips right now. Earn
                      more from packs, SBCs or objectives, or wait for
                      existing chips to resolve.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {usableChips.map((chip) => {
                        const status = chipStatusLabel(chip);
                        const isSelected = chip.id === selectedChipId;

                        const noTriesLeft =
                          chip.isConsumed ||
                          (chip.remainingTries ?? 0) <= 0;

                        return (
                          <button
                            key={chip.id}
                            type="button"
                            onClick={() => {
                              if (noTriesLeft) return;
                              setChipAssignMessage(null);
                              setSelectedChipId(
                                isSelected ? null : chip.id
                              );
                            }}
                            className={`w-full text-left rounded-xl border px-3 py-2.5 transition text-[11px]
                              ${
                                noTriesLeft
                                  ? "border-slate-800 bg-slate-950/50 text-slate-500 cursor-not-allowed"
                                  : isSelected
                                  ? "border-violet-400 bg-violet-950/40 shadow-[0_0_0_1px_rgba(167,139,250,0.4)]"
                                  : "border-slate-700 bg-slate-950/60 hover:border-violet-400"
                              }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <MonsterChipBadge
                                  label={chip.template.name}
                                  code={chip.template.code}
                                  size="sm"
                                />
                                <p className="text-[10px] text-slate-400">
                                  Tries left:{" "}
                                  <span className="font-semibold text-violet-200">
                                    {chip.remainingTries ?? 0}
                                  </span>
                                </p>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-medium
                                  ${
                                    status.startsWith("Available")
                                      ? "bg-emerald-900/40 text-emerald-200 border border-emerald-500/40"
                                      : chip.isConsumed
                                      ? "bg-rose-900/40 text-rose-200 border border-rose-500/40"
                                      : "bg-amber-900/40 text-amber-200 border border-amber-500/40"
                                  }`}
                              >
                                {status}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {chipAssignMessage && (
                    <p className="text-[11px] text-slate-100 border border-slate-700 bg-slate-900/70 rounded-md px-2 py-1 mt-1">
                      {chipAssignMessage}
                    </p>
                  )}

                  {chipMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedChipId(null);
                        setChipAssignMessage(null);
                      }}
                      className="w-full rounded-full border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-violet-400"
                    >
                      Cancel chip selection
                    </button>
                  )}
                </section>
              </aside>
            </section>

            {/* Search & filters */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-100 mb-1">
                Search & filters
              </h3>
              <p className="text-[11px] text-slate-400 mb-1">
                Filter your collection while picking your 7-monster squad.
                In chip mode, click any monster card to attach your
                selected chip.
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
                      onChange={(e) =>
                        setFilterRarity(e.target.value)
                      }
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
                      onChange={(e) =>
                        setFilterPosition(e.target.value)
                      }
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
                      onChange={(e) =>
                        setFilterClub(e.target.value)
                      }
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
                        const selected = selectedIds.includes(
                          monster.id
                        );
                        const disabled =
                          !selected &&
                          selectedIds.length >= maxPlayers;
                        const artUrl =
                          getArtUrlForMonster(monster);
                        const chip =
                          monsterChipMap[monster.id];

                        const handleCardClick = () => {
                          if (chipMode && selectedChipInfo) {
                            void handleAssignChipToMonster(
                              monster.id
                            );
                          } else if (!disabled) {
                            toggleSelect(monster.id);
                          }
                        };

                        return (
                          <div
                            key={monster.id}
                            onClick={handleCardClick}
                            className={`text-left rounded-xl border p-3 text-xs transition ${
                              chipMode
                                ? "cursor-crosshair"
                                : disabled
                                ? "cursor-not-allowed"
                                : "cursor-pointer"
                            } ${
                              selected
                                ? "border-emerald-400 bg-emerald-500/10"
                                : disabled
                                ? "border-slate-800 bg-slate-950/40 opacity-50"
                                : "border-slate-700 bg-slate-950/60 hover:border-emerald-400"
                            }`}
                          >
                            <div className="mb-2 relative w-full overflow-hidden rounded-lg aspect-[3/4]">
                              <img
                                src={artUrl}
                                alt={monster.displayName}
                                className={`w-full h-full object-cover ${
                                  chipMode
                                    ? "ring-1 ring-violet-400/50"
                                    : ""
                                }`}
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

                            {chip && (
                              <div className="mb-1">
                                <MonsterChipBadge
                                  label={chip.name}
                                  code={chip.code}
                                  size="sm"
                                  className="shadow-emerald-500/40"
                                />
                              </div>
                            )}

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
                              Evo Lv. {monster.evolutionLevel}
                            </p>

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
                          </div>
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

function PitchCard({
  monster,
  chip,
  assignMode,
  onAssignChip,
}: {
  monster: PitchMonster;
  chip?: ActiveChipInfo;
  assignMode?: boolean;
  onAssignChip?: () => void;
}) {
  const artUrl = getArtUrlForMonster(monster);
  const clickable = assignMode && !!onAssignChip;

  return (
    <button
      type="button"
      onClick={clickable ? onAssignChip : undefined}
      className={`min-w-[90px] rounded-lg border px-2 py-2 text-center shadow-md flex flex-col items-center transition
        ${
          clickable
            ? "border-violet-400 bg-emerald-900/80 ring-2 ring-violet-500/50 animate-pulse"
            : "border-emerald-300/70 bg-emerald-900/80"
        }`}
    >
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
      </div>

      {chip && (
        <div className="mt-1">
          <MonsterChipBadge
            label={chip.name}
            code={chip.code}
            size="sm"
            className="shadow-emerald-500/40"
          />
        </div>
      )}

      {typeof monster.gameweekPoints === "number" && (
        <div className="mt-1 rounded-full bg-emerald-800/80 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-50">
          GW pts:{" "}
          <span className="text-[12px] text-emerald-300">
            {monster.gameweekPoints}
          </span>
        </div>
      )}
    </button>
  );
}

function PitchPlaceholder({ label }: { label: string }) {
  return (
    <div className="min-w-[70px] rounded-full border border-emerald-500/40 bg-emerald-900/40 px-3 py-1 text-center text-[10px] uppercase text-emerald-200">
      {label}
    </div>
  );
}
