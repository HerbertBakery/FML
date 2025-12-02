// app/chips/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import MonsterCard, {
  MonsterCardMonster,
} from "@/components/MonsterCard";
import MonsterChipBadge from "@/components/MonsterChipBadge";

// ---- Types for chips (same as sidebar) ----

type ChipTemplateDTO = {
  id: string;
  code: string;
  name: string;
  description: string;
  conditionType: string;
  minRarity: string | null;
  maxRarity: string | null;
  allowedPositions: string | null;
};

type ChipAssignmentDTO = {
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

type UserChipDTO = {
  id: string;
  isConsumed: boolean;
  createdAt: string;
  consumedAt: string | null;
  template: ChipTemplateDTO;
  assignments: ChipAssignmentDTO[];
};

type ChipsResponse = {
  chips: UserChipDTO[];
};

// ---- Types for monsters-lite ----

type MonsterLite = {
  id: string;
  displayName: string;
  realPlayerName: string;
  club: string;
  position: string;
  rarity: string;
  evolutionLevel: number;
  artBasePath: string | null;
};

type MonstersLiteResponse = {
  monsters: MonsterLite[];
};

export default function ChipsPage() {
  const [chips, setChips] = useState<UserChipDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedChipId, setSelectedChipId] = useState<string | null>(
    null
  );

  const [monsterIdInput, setMonsterIdInput] = useState("");
  const [monsterNamePreview, setMonsterNamePreview] = useState<
    string | null
  >(null);

  const [gameweekInput, setGameweekInput] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(
    null
  );

  // Monster picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [monstersLite, setMonstersLite] = useState<MonsterLite[]>([]);
  const [monsterSearch, setMonsterSearch] = useState("");

  // Load chips on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/me/chips");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to load chips");
        }
        const data = (await res.json()) as ChipsResponse;
        setChips(data.chips || []);
      } catch (err: any) {
        setError(err?.message || "Failed to load chips.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const selectedChip = chips.find((c) => c.id === selectedChipId) || null;

  const statusForChip = (chip: UserChipDTO): string => {
    if (chip.isConsumed) return "Consumed";

    const activeAssignment = chip.assignments.find(
      (a) => a.resolvedAt === null
    );

    if (activeAssignment) {
      return `Assigned (GW ${activeAssignment.gameweekNumber})`;
    }

    return "Available";
  };

  // --- Monster picker logic ---

  const filteredMonsters: MonsterLite[] = useMemo(() => {
    if (!monsterSearch.trim()) return monstersLite;
    const q = monsterSearch.toLowerCase();
    return monstersLite.filter((m) => {
      return (
        m.displayName.toLowerCase().includes(q) ||
        m.realPlayerName.toLowerCase().includes(q) ||
        m.club.toLowerCase().includes(q)
      );
    });
  }, [monsterSearch, monstersLite]);

  const openPicker = async () => {
    setPickerOpen(true);
    if (monstersLite.length > 0) return;

    setPickerLoading(true);
    setPickerError(null);
    try {
      const res = await fetch("/api/me/monsters-lite");
      const data = (await res.json()) as MonstersLiteResponse;
      if (!res.ok) {
        throw new Error(
          (data as any).error || "Failed to load monsters."
        );
      }
      setMonstersLite(data.monsters || []);
    } catch (err: any) {
      setPickerError(err?.message || "Failed to load monsters.");
    } finally {
      setPickerLoading(false);
    }
  };

  const handlePickMonster = (m: MonsterLite) => {
    setMonsterIdInput(m.id);
    setMonsterNamePreview(`${m.displayName} (${m.realPlayerName})`);
    setPickerOpen(false);
  };

  // --- Assign chip to monster ---

  const handleAssign = async () => {
    setAssignMessage(null);

    if (!selectedChipId) {
      setAssignMessage("Select a chip from the list first.");
      return;
    }
    if (!monsterIdInput.trim()) {
      setAssignMessage("Choose a monster to attach the chip to.");
      return;
    }
    const gw = Number(gameweekInput);
    if (!gw || gw <= 0) {
      setAssignMessage("Enter a valid gameweek number.");
      return;
    }

    setAssignLoading(true);
    try {
      const res = await fetch("/api/admin/chips/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userMonsterId: monsterIdInput.trim(),
          userChipId: selectedChipId,
          gameweekNumber: gw,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Failed to assign chip.");
      }

      setAssignMessage("Chip assigned successfully.");

      // Reload chips so UI reflects assignment
      const reload = await fetch("/api/me/chips");
      if (reload.ok) {
        const rData = (await reload.json()) as ChipsResponse;
        setChips(rData.chips || []);
      }
    } catch (err: any) {
      setAssignMessage(err?.message || "Failed to assign chip.");
    } finally {
      setAssignLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-100">
          My Evolution Chips
        </h1>
        <p className="text-sm text-slate-400">
          Attach chips to your monsters before a gameweek. If the
          real-world condition hits, they evolve.
        </p>
      </header>

      {/* Errors / loading */}
      {loading && (
        <div className="text-slate-300 text-sm">Loading chips…</div>
      )}
      {error && (
        <div className="text-red-400 text-sm border border-red-500/40 bg-red-950/20 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      {!loading && !error && chips.length === 0 && (
        <div className="text-slate-300 text-sm border border-slate-700 bg-slate-950/40 rounded-md px-3 py-3">
          You don&apos;t have any chips yet. Earn them from packs, SBCs
          or objectives.
        </div>
      )}

      {/* Layout: chips list + assign panel */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)] gap-6">
        {/* Chips list */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
            Your chips
          </h2>

          <div className="space-y-3">
            {chips.map((chip) => {
              const status = statusForChip(chip);
              const isSelected = chip.id === selectedChipId;
              const activeAssignment = chip.assignments.find(
                (a) => a.resolvedAt === null
              );

              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() =>
                    setSelectedChipId(
                      isSelected ? null : chip.id
                    )
                  }
                  className={`w-full text-left rounded-xl border px-4 py-3 transition 
                    ${
                      isSelected
                        ? "border-emerald-400 bg-emerald-950/20"
                        : "border-slate-700 bg-slate-950/40 hover:border-slate-500"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <MonsterChipBadge
                        name={chip.template.name}
                        code={chip.template.code}
                        gameweekNumber={
                          activeAssignment?.gameweekNumber ?? null
                        }
                      />
                      <p className="text-xs text-slate-300">
                        {chip.template.description}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Condition:{" "}
                        <span className="font-mono text-[11px]">
                          {chip.template.conditionType}
                        </span>
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium 
                          ${
                            status === "Available"
                              ? "bg-emerald-900/50 text-emerald-200 border border-emerald-500/40"
                              : chip.isConsumed
                              ? "bg-rose-900/40 text-rose-200 border border-rose-500/40"
                              : "bg-amber-900/40 text-amber-200 border border-amber-500/40"
                          }`}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Assign panel */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
            Assign chip to a monster
          </h2>

          <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-4 space-y-3">
            {selectedChip ? (
              <div className="text-xs text-slate-300 space-y-1">
                <p>
                  Selected chip:{" "}
                  <span className="font-semibold text-emerald-300">
                    {selectedChip.template.name}
                  </span>{" "}
                  <span className="text-[10px] text-slate-400">
                    ({selectedChip.template.code})
                  </span>
                </p>
                <p>{selectedChip.template.description}</p>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Select a chip from the list on the left to assign it.
              </p>
            )}

            {/* Monster selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[11px] text-slate-300">
                    Monster
                  </p>
                  {monsterNamePreview ? (
                    <p className="text-[11px] text-emerald-300">
                      {monsterNamePreview}
                    </p>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      No monster selected yet.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openPicker}
                  className="rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-[11px] text-slate-100 hover:border-emerald-400 hover:text-emerald-200"
                >
                  Choose monster
                </button>
              </div>

              <label className="block text-[11px] text-slate-300 mt-2">
                Gameweek number
                <input
                  type="number"
                  value={gameweekInput}
                  onChange={(e) =>
                    setGameweekInput(e.target.value)
                  }
                  placeholder="e.g. 13"
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </label>
            </div>

            {assignMessage && (
              <div className="text-[11px] text-slate-200 border border-slate-700 bg-slate-900/70 rounded-md px-2 py-1">
                {assignMessage}
              </div>
            )}

            <button
              type="button"
              onClick={handleAssign}
              disabled={assignLoading || !selectedChip}
              className={`w-full rounded-md px-3 py-2 text-xs font-semibold transition
                ${
                  assignLoading || !selectedChip
                    ? "bg-slate-700 text-slate-300 cursor-not-allowed"
                    : "bg-emerald-500 text-slate-900 hover:bg-emerald-400"
                }`}
            >
              {assignLoading
                ? "Assigning…"
                : "Assign chip to monster"}
            </button>
          </div>
        </section>
      </div>

      {/* Monster picker overlay */}
      {pickerOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-3">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-100">
                Choose a monster
              </h3>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="p-3 space-y-3 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={monsterSearch}
                  onChange={(e) =>
                    setMonsterSearch(e.target.value)
                  }
                  placeholder="Search by name, player, or club…"
                  className="flex-1 rounded-md border border-slate-700 bg-slate-900/60 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {pickerLoading && (
                <p className="text-xs text-slate-300">
                  Loading monsters…
                </p>
              )}
              {pickerError && (
                <p className="text-xs text-red-400">
                  {pickerError}
                </p>
              )}

              {!pickerLoading && !pickerError && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredMonsters.map((m) => {
                    const monsterCard: MonsterCardMonster = {
                      displayName: m.displayName,
                      realPlayerName: m.realPlayerName,
                      position: m.position,
                      club: m.club,
                      rarity: m.rarity,
                      baseAttack: 0,
                      baseMagic: 0,
                      baseDefense: 0,
                      evolutionLevel: m.evolutionLevel,
                      artUrl: m.artBasePath || undefined,
                    };

                    return (
                      <button
                        key={m.id}
                        type="button"
                        className="text-left"
                        onClick={() => handlePickMonster(m)}
                      >
                        <MonsterCard monster={monsterCard} />
                      </button>
                    );
                  })}

                  {filteredMonsters.length === 0 && (
                    <p className="text-xs text-slate-400">
                      No monsters found matching your search.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
