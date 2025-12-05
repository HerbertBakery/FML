// components/MonsterCard.tsx
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";
import MonsterChipBadge from "@/components/MonsterChipBadge";

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

  artUrl?: string;
  hoverArtUrl?: string;

  setCode?: string;
  editionType?: string;
  serialNumber?: number;
  editionLabel?: string;
};

export type ActiveChipInfo = {
  name: string;
  code: string;
  gameweekNumber: number | null;
};

type MonsterCardProps = {
  monster: MonsterCardMonster;
  rightBadge?: ReactNode;
  children?: ReactNode;
  detailHref?: string;
  activeChip?: ActiveChipInfo | null;
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
  activeChip,
}: MonsterCardProps) {
  const { border, background, badge } = getRarityClasses(monster.rarity);

  const hasArt = !!monster.artUrl;
  const editionText =
    monster.editionLabel ??
    (typeof monster.serialNumber === "number"
      ? `Serial #${monster.serialNumber}`
      : undefined);

  // Preload hover art
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!monster.hoverArtUrl) return;
    const img = new window.Image();
    img.src = monster.hoverArtUrl;
  }, [monster.hoverArtUrl]);

  return (
    <div
      className={`group rounded-xl border ${border} ${background} p-3 text-xs flex flex-col justify-between gap-2 overflow-hidden`}
    >
      <div>
        {/* ART AREA */}
        {hasArt && (
          <div className="mb-2 relative w-full overflow-hidden rounded-lg aspect-[3/4]">
            {/* --- 🔥 POSITION BADGE --- */}
            <div className="absolute top-1 left-1 z-10 rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 shadow-sm">
              {monster.position}
            </div>

            {/* Base art */}
            <img
              src={monster.artUrl}
              alt={monster.displayName}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />

            {/* Hover art */}
            {monster.hoverArtUrl && (
              <img
                src={monster.hoverArtUrl}
                alt={monster.displayName}
                className="w-full h-full object-cover absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            )}
          </div>
        )}

        {/* NAME + RARITY/CHIP */}
        <div className="mb-1">
          <span className="font-semibold block">{monster.displayName}</span>

          {activeChip ? (
            <div className="mt-0.5">
              <MonsterChipBadge
                label={activeChip.name}
                code={activeChip.code}
                size="sm"
                className="shadow-emerald-500/40"
              />
            </div>
          ) : (
            <div className="mt-0.5">
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
          )}
        </div>

        {/* PLAYER INFO */}
        <p className="text-[11px] text-slate-300">
          {monster.realPlayerName} • {monster.club}
        </p>

        {/* Evolution level */}
        {typeof monster.evolutionLevel === "number" && (
          <p className="text-[10px] text-emerald-300 mt-1">
            Evo Lv. {monster.evolutionLevel}
          </p>
        )}

        {editionText && (
          <p className="text-[10px] text-amber-300 mt-1">{editionText}</p>
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
