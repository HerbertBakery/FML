// components/MonsterCard.tsx
import Link from "next/link";
import type { ReactNode } from "react";

export type MonsterCardMonster = {
  displayName: string;
  realPlayerName: string;
  position: string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
  evolutionLevel?: number;
};

type MonsterCardProps = {
  monster: MonsterCardMonster;
  /** Optional badge shown in top-right instead of rarity text */
  rightBadge?: ReactNode;
  /** Extra content rendered below the stats (price, buttons, etc.) */
  children?: ReactNode;
  /**
   * Optional link to a monster detail/history page.
   * If provided, a "View details" link will appear at the bottom of the card.
   */
  detailHref?: string;
};

function getRarityClasses(rarityRaw: string | undefined) {
  const rarity = (rarityRaw || "").toLowerCase().trim();

  switch (rarity) {
    case "common":
      return {
        border: "border-slate-700",
        background: "bg-slate-950/70",
        badge: "text-slate-300",
      };
    case "rare":
      return {
        border: "border-sky-500/60",
        background: "bg-sky-950/40",
        badge: "text-sky-300",
      };
    case "epic":
      return {
        border: "border-purple-500/70",
        background: "bg-purple-950/40",
        badge: "text-purple-300",
      };
    case "legendary":
      return {
        border: "border-amber-400/80",
        background: "bg-amber-950/40",
        badge: "text-amber-300",
      };
    default:
      return {
        border: "border-slate-800",
        background: "bg-slate-950/70",
        badge: "text-emerald-300",
      };
  }
}

export default function MonsterCard({
  monster,
  rightBadge,
  children,
  detailHref,
}: MonsterCardProps) {
  const { border, background, badge } = getRarityClasses(
    monster.rarity
  );

  return (
    <div
      className={`rounded-xl border ${border} ${background} p-3 text-xs flex flex-col justify-between gap-2`}
    >
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold">
            {monster.displayName}
          </span>
          {rightBadge ? (
            <span className="text-[10px]">{rightBadge}</span>
          ) : (
            <span
              className={`text-[10px] uppercase font-semibold ${badge}`}
            >
              {monster.rarity}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-300">
          {monster.realPlayerName} • {monster.club}
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          {monster.position} • ATK {monster.baseAttack} • MAG{" "}
          {monster.baseMagic} • DEF {monster.baseDefense}
        </p>
        {typeof monster.evolutionLevel === "number" && (
          <p className="text-[10px] text-emerald-300 mt-1">
            Evo Lv. {monster.evolutionLevel}
          </p>
        )}
      </div>

      {children && <div className="mt-1">{children}</div>}

      {detailHref && (
        <div className="mt-1 flex justify-end">
          <Link
            href={detailHref}
            className="text-[10px] text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
          >
            View details
          </Link>
        </div>
      )}
    </div>
  );
}
