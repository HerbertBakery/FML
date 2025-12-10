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
  editionType?: string; // "BASE" | "THEMED" | "LIMITED"
  serialNumber?: number; // 1–N for limiteds
  editionLabel?: string; // e.g. "1 of 10"
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
  const isLimited = monster.editionType === "LIMITED";
  const { border, background, badge } = getRarityClasses(monster.rarity);
  const hasArt = !!monster.artUrl;

  // ---------- Edition text ----------
  let editionText: string | undefined;

  if (isLimited) {
    if (monster.editionLabel) {
      // Start from the raw label
      let cleaned = monster.editionLabel;

      // 1) Strip common " • #1" / " · #1" / " - #1" / " #1" endings
      cleaned = cleaned.replace(/\s*[•·-]?\s*#\d+\s*$/u, "");

      // 2) EXTRA SAFETY: if any "#" is still present, chop everything from "#" onwards
      const hashIndex = cleaned.indexOf("#");
      if (hashIndex !== -1) {
        cleaned = cleaned.slice(0, hashIndex);
      }

      editionText = cleaned.trim();
    } else {
      // No label? Just say Limited Edition (no serial)
      editionText = "Limited Edition";
    }
  } else {
    // Non-limited: same behaviour as before
    editionText =
      monster.editionLabel ??
      (typeof monster.serialNumber === "number"
        ? `Serial #${monster.serialNumber}`
        : undefined);
  }

  // Preload hover art
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!monster.hoverArtUrl) return;
    const img = new window.Image();
    img.src = monster.hoverArtUrl;
  }, [monster.hoverArtUrl]);

  return (
    <div
      className={`group rounded-xl border ${border} ${background} p-3 text-xs flex flex-col h-full gap-2 overflow-hidden
        ${
          isLimited
            ? "border-yellow-400 shadow-[0_0_24px_rgba(250,204,21,0.45)] relative before:absolute before:inset-x-0 before:top-0 before:h-10 before:bg-gradient-to-b before:from-yellow-400/15 before:to-transparent"
            : ""
        }`}
    >
      {/* TOP FLEX AREA: art, name, rarity, player info, evo, edition */}
      <div className="flex-1">
        {/* ART AREA */}
        {hasArt && (
          <div className="mb-2 relative w-full overflow-hidden rounded-lg aspect-[3/4]">
            {/* POSITION BADGE */}
            <div className="absolute top-1 left-1 z-10 rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300 shadow-sm">
              {monster.position}
            </div>

            {/* Limited edition tag on art */}
            {isLimited && (
              <div className="absolute top-1 right-1 z-10 rounded-md bg-yellow-400/90 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950 shadow">
                GOLDEN
              </div>
            )}

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

        {/* NAME + RARITY / CHIP */}
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
            <div className="mt-0.5 flex items-center gap-2">
              {rightBadge ? (
                <span className="text-[10px]">{rightBadge}</span>
              ) : (
                <span
                  className={`text-[10px] uppercase font-semibold ${
                    isLimited ? "text-yellow-300" : badge
                  }`}
                >
                  {isLimited ? "LIMITED • GOLDEN" : monster.rarity}
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

        {/* Edition line (still part of top area) */}
        {editionText && (
          <p
            className={`text-[10px] mt-1 ${
              isLimited ? "text-yellow-300 font-semibold" : "text-amber-300"
            }`}
          >
            {editionText}
          </p>
        )}
      </div>

      {/* FIXED STATS ROW: sits above buttons consistently */}
      <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-200">
        <div className="flex items-center justify-between rounded-md bg-slate-900/70 px-2 py-1">
          <span className="font-semibold text-emerald-300">ATK</span>
          <span className="font-mono font-semibold">
            {monster.baseAttack}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-slate-900/70 px-2 py-1">
          <span className="font-semibold text-red-300">DEF</span>
          <span className="font-mono font-semibold">
            {monster.baseDefense}
          </span>
        </div>
      </div>

      {/* CHILDREN (e.g. marketplace buttons) */}
      {children && <div className="mt-1">{children}</div>}

      {/* Optional "View details" link */}
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
