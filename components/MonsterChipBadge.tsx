// components/MonsterChipBadge.tsx
"use client";

import type { ReactNode } from "react";

export type ChipRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHICAL";

type MonsterChipBadgeProps = {
  label: string;
  rarity?: ChipRarity | string | null;
  code?: string;
  icon?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
};

function rarityClasses(rarity?: string | null) {
  switch (rarity) {
    case "RARE":
      return "from-sky-500/80 to-sky-700/80 border-sky-300 text-sky-50 shadow-sky-500/40";
    case "EPIC":
      return "from-violet-500/80 to-fuchsia-700/80 border-violet-300 text-violet-50 shadow-violet-500/40";
    case "LEGENDARY":
      return "from-amber-400/90 to-orange-600/90 border-amber-200 text-slate-950 shadow-amber-400/60";
    case "MYTHICAL":
      return "from-rose-500/90 to-pink-700/90 border-rose-200 text-rose-50 shadow-rose-500/50";
    case "COMMON":
    default:
      return "from-slate-700/90 to-slate-900/90 border-slate-400/70 text-slate-50 shadow-slate-700/40";
  }
}

function sizeClasses(size: "sm" | "md" | "lg") {
  switch (size) {
    case "lg":
      return "px-4 py-2 text-xs sm:text-sm gap-2";
    case "md":
      return "px-3 py-1.5 text-[11px] sm:text-xs gap-1.5";
    case "sm":
    default:
      return "px-2.5 py-1 text-[10px] gap-1.5";
  }
}

export default function MonsterChipBadge({
  label,
  rarity,
  code,
  icon,
  size = "md",
  className = "",
}: MonsterChipBadgeProps) {
  return (
    <div
      className={[
        "inline-flex items-center rounded-full border bg-gradient-to-br shadow-lg",
        "backdrop-blur-sm",
        rarityClasses(rarity || undefined),
        sizeClasses(size),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Left icon / rarity dot */}
      <div className="flex items-center justify-center rounded-full bg-black/20 px-1.5 py-0.5">
        {icon ?? (
          <div className="h-2.5 w-2.5 rounded-full bg-white/70 shadow-inner" />
        )}
      </div>

      <div className="flex flex-col leading-tight">
        <span className="font-semibold uppercase tracking-wide">
          {label}
        </span>
        {code && (
          <span className="text-[9px] opacity-80 font-mono">
            {code}
          </span>
        )}
      </div>

      {rarity && (
        <span className="ml-1 rounded-full bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
          {rarity}
        </span>
      )}
    </div>
  );
}
