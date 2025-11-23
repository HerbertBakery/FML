// components/PackVfx.tsx
"use client";

import { useState, useEffect } from "react";

export type PackVariant = "starter" | "bronze" | "silver" | "gold";

type PackVfxProps = {
  label: string;
  subtitle?: string;
  variant: PackVariant;
  disabled?: boolean;
  isOpening?: boolean;   // when API call is in-flight
  isRevealed?: boolean;  // when cards are visible
  onOpen?: () => void;
};

export default function PackVfx({
  label,
  subtitle,
  variant,
  disabled,
  isOpening,
  isRevealed,
  onOpen,
}: PackVfxProps) {
  const [localOpening, setLocalOpening] = useState(false);

  // sync local anim state with parent isOpening
  useEffect(() => {
    if (!isOpening) {
      setLocalOpening(false);
    }
  }, [isOpening]);

  const canClick = !disabled && !isOpening && !localOpening;
  const opening = isOpening || localOpening;

  function handleClick() {
    if (!canClick) return;
    setLocalOpening(true);
    onOpen?.();
  }

  const variantClasses: Record<PackVariant, string> = {
    starter:
      "from-emerald-500 via-emerald-400 to-emerald-600 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.7)]",
    bronze:
      "from-amber-700 via-amber-600 to-amber-800 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.7)]",
    silver:
      "from-slate-200 via-slate-300 to-slate-100 border-slate-100 shadow-[0_0_20px_rgba(148,163,184,0.7)]",
    gold:
      "from-yellow-400 via-yellow-300 to-amber-400 border-yellow-200 shadow-[0_0_24px_rgba(250,204,21,0.8)]",
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={!canClick}
        className={`
          relative w-28 h-40 rounded-2xl border-2
          bg-gradient-to-b ${variantClasses[variant]}
          overflow-hidden
          flex items-center justify-center
          transition-transform duration-200
          ${canClick ? "hover:scale-105 active:scale-95" : "opacity-60 cursor-not-allowed"}
          ${opening ? "pack-grow" : "pack-idle"}
        `}
      >
        {/* foil streaks */}
        <div className="absolute -inset-10 opacity-25 pointer-events-none">
          <div className="h-full w-full rotate-12 bg-[repeating-linear-gradient(45deg,_rgba(255,255,255,0.25)_0,_rgba(255,255,255,0.25)_2px,_transparent_2px,_transparent_6px)]" />
        </div>

        {/* central label */}
        <div className="relative z-10 text-center px-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-900 drop-shadow">
            {label}
          </div>
          {subtitle && (
            <div className="mt-1 text-[9px] text-slate-900/80 drop-shadow">
              {subtitle}
            </div>
          )}
          {opening && (
            <div className="mt-2 text-[9px] font-semibold text-slate-900 animate-pulse">
              Ripping open...
            </div>
          )}
          {isRevealed && !opening && (
            <div className="mt-2 text-[9px] font-semibold text-slate-900 animate-bounce">
              Cards revealed!
            </div>
          )}
        </div>

        {/* rip line when opening */}
        {opening && (
          <>
            <div className="pointer-events-none absolute inset-x-1 top-1/2 h-[3px] -translate-y-1/2 bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
            <div className="pointer-events-none absolute inset-x-3 top-1/2 h-[1px] -translate-y-1/2 bg-black/40" />
          </>
        )}

        {/* top + bottom halves sliding when revealed */}
        {isRevealed && (
          <>
            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-black/40 to-transparent pack-top-rip" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pack-bottom-rip" />
          </>
        )}

        <style jsx>{`
          @keyframes packBulge {
            0% {
              transform: scale(1) translateY(0);
            }
            25% {
              transform: scale(1.03) translateY(-2px);
            }
            50% {
              transform: scale(1.06) translateY(0);
            }
            75% {
              transform: scale(1.03) translateY(2px);
            }
            100% {
              transform: scale(1) translateY(0);
            }
          }

          @keyframes packGrow {
            0% {
              transform: scale(1);
            }
            40% {
              transform: scale(1.12);
            }
            100% {
              transform: scale(1.05);
            }
          }

          @keyframes packShake {
            0% {
              transform: translateX(0);
            }
            25% {
              transform: translateX(-1px);
            }
            50% {
              transform: translateX(1px);
            }
            75% {
              transform: translateX(-1px);
            }
            100% {
              transform: translateX(0);
            }
          }

          @keyframes topRip {
            0% {
              transform: translateY(0);
              opacity: 0;
            }
            100% {
              transform: translateY(-12px);
              opacity: 1;
            }
          }

          @keyframes bottomRip {
            0% {
              transform: translateY(0);
              opacity: 0;
            }
            100% {
              transform: translateY(12px);
              opacity: 1;
            }
          }

          .pack-idle {
            animation: packBulge 1.9s ease-in-out infinite,
              packShake 0.9s ease-in-out infinite alternate;
          }

          .pack-grow {
            animation: packGrow 0.35s ease-out forwards;
          }

          .pack-top-rip {
            animation: topRip 0.25s ease-out forwards;
          }

          .pack-bottom-rip {
            animation: bottomRip 0.25s ease-out forwards;
          }
        `}</style>
      </button>
    </div>
  );
}
