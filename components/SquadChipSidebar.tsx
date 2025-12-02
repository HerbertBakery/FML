// components/SquadChipSidebar.tsx
"use client";

import MonsterChipBadge from "@/components/MonsterChipBadge";

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

export type UserChipDTO = {
  id: string;
  isConsumed: boolean;
  createdAt: string;
  consumedAt: string | null;
  template: ChipTemplateDTO;
  assignments: ChipAssignmentDTO[];
};

type SquadChipSidebarProps = {
  chips: UserChipDTO[];
  onSelectChip: (chipId: string) => void;
  selectedChipId: string | null;
};

export default function SquadChipSidebar({
  chips,
  onSelectChip,
  selectedChipId,
}: SquadChipSidebarProps) {
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

  return (
    <aside className="w-full md:w-72 shrink-0 rounded-xl border border-slate-700 bg-slate-950/70 p-3 space-y-3">
      <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
        Evolution chips
      </h3>

      {chips.length === 0 && (
        <p className="text-[11px] text-slate-400">
          No chips yet. Earn them from packs, SBCs, or objectives.
        </p>
      )}

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
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
                onSelectChip(isSelected ? null : chip.id)
              }
              className={`w-full text-left rounded-lg border px-3 py-2 text-[11px] transition 
                ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-950/20"
                    : "border-slate-700 bg-slate-950/40 hover:border-slate-500"
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <MonsterChipBadge
                    name={chip.template.name}
                    code={chip.template.code}
                    gameweekNumber={
                      activeAssignment?.gameweekNumber ?? null
                    }
                  />
                  <p className="mt-1 text-slate-300 line-clamp-2">
                    {chip.template.description}
                  </p>
                  {activeAssignment && (
                    <p className="mt-1 text-[10px] text-amber-300">
                      Assigned to {activeAssignment.monsterName} (
                      {activeAssignment.monsterRealPlayerName})
                    </p>
                  )}
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium 
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
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-500">
        Select a chip, then click a monster in your squad to arm it
        for the upcoming gameweek.
      </p>
    </aside>
  );
}
