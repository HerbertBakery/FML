// components/MonsterChipBadge.tsx
"use client";

type MonsterChipBadgeProps = {
  name: string;
  code: string;
  gameweekNumber: number | null;
};

export default function MonsterChipBadge({
  name,
  code,
  gameweekNumber,
}: MonsterChipBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-cyan-400/60 bg-cyan-950/40 px-2 py-0.5">
      <span className="text-[9px] font-semibold uppercase text-cyan-200">
        {name}
      </span>
      <span className="text-[9px] text-cyan-300/80">
        {code}
        {typeof gameweekNumber === "number"
          ? ` • GW ${gameweekNumber}`
          : ""}
      </span>
    </div>
  );
}
