"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// -------------------- Types --------------------

// Match your pack ids
export type PackId = "starter" | "bronze" | "silver" | "gold";

export type OpenedMonster = {
  id: string;
  templateCode: string;
  displayName: string;
  realPlayerName: string;
  position: string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
  evolutionLevel: number;
};

type PackOpenResponse = {
  error?: string;
  message?: string;
  packType?: string;
  coinsAfter?: number;
  monsters?: OpenedMonster[];
};

type Props = {
  packId: PackId;
  onClose?: () => void;
  onOpened?: (monsters: OpenedMonster[], coinsAfter?: number) => void;
  /**
   * If true (default): clicking "Add to squad" will navigate to /squad.
   * If false: it will just close the modal, leaving the user on the current page.
   */
  redirectToSquad?: boolean;
};

// -------------------- Theme helpers --------------------
type Theme = {
  frame: string;
  bodyFrom: string;
  bodyVia: string;
  bodyTo: string;
  sheenFrom: string;
  shredTop: string;
  shredBottom: string;
  brandText: string;
  subText: string;
  label: string;
};

const THEMES: Record<PackId, Theme> = {
  starter: {
    frame: "border-4 border-emerald-400",
    bodyFrom: "from-emerald-200",
    bodyVia: "via-emerald-400",
    bodyTo: "to-emerald-700",
    sheenFrom: "from-white/45",
    shredTop: "bg-emerald-500",
    shredBottom: "bg-emerald-700",
    brandText: "text-black",
    subText: "text-black/80",
    label: "Starter Pack",
  },
  bronze: {
    frame: "border-4 border-amber-500",
    bodyFrom: "from-amber-200",
    bodyVia: "via-amber-400",
    bodyTo: "to-amber-700",
    sheenFrom: "from-white/40",
    shredTop: "bg-amber-500",
    shredBottom: "bg-amber-700",
    brandText: "text-black",
    subText: "text-black/80",
    label: "Bronze Pack",
  },
  silver: {
    frame: "border-4 border-slate-300",
    bodyFrom: "from-slate-100",
    bodyVia: "via-slate-300",
    bodyTo: "to-sky-400",
    sheenFrom: "from-white/55",
    shredTop: "bg-slate-300",
    shredBottom: "bg-sky-500",
    brandText: "text-slate-900",
    subText: "text-slate-900/80",
    label: "Silver Pack",
  },
  gold: {
    frame: "border-4 border-yellow-400",
    bodyFrom: "from-yellow-200",
    bodyVia: "via-yellow-400",
    bodyTo: "to-amber-600",
    sheenFrom: "from-white/50",
    shredTop: "bg-amber-400",
    shredBottom: "bg-amber-600",
    brandText: "text-black",
    subText: "text-black/80",
    label: "Gold Pack",
  },
};

// -------------------- Card Visual --------------------
type RarityKey = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "DEFAULT";

const rarityStyle: Record<
  RarityKey,
  { ring: string; glow: string; label: string }
> = {
  COMMON: {
    ring: "ring-zinc-400",
    glow: "shadow-zinc-400/30",
    label: "bg-zinc-700 text-zinc-100",
  },
  RARE: {
    ring: "ring-sky-400",
    glow: "shadow-sky-400/30",
    label: "bg-sky-600 text-white",
  },
  EPIC: {
    ring: "ring-violet-400",
    glow: "shadow-violet-400/30",
    label: "bg-violet-600 text-white",
  },
  LEGENDARY: {
    ring: "ring-amber-400",
    glow: "shadow-amber-400/40",
    label: "bg-amber-500 text-black",
  },
  DEFAULT: {
    ring: "ring-emerald-400",
    glow: "shadow-emerald-400/30",
    label: "bg-emerald-600 text-white",
  },
};

function rarityKey(r: string | undefined | null): RarityKey {
  if (!r) return "DEFAULT";
  const upper = r.toUpperCase();
  if (
    upper === "COMMON" ||
    upper === "RARE" ||
    upper === "EPIC" ||
    upper === "LEGENDARY"
  ) {
    return upper;
  }
  return "DEFAULT";
}

const MonsterRevealCard: React.FC<{
  monster: OpenedMonster;
  delay?: number;
}> = ({ monster, delay = 0 }) => {
  const style = rarityStyle[rarityKey(monster.rarity)];
  return (
    <motion.div
      initial={{ rotateY: 180, opacity: 0, scale: 0.8 }}
      animate={{ rotateY: 0, opacity: 1, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 14,
        delay,
      }}
      className={`relative w-56 h-80 rounded-2xl p-3 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 ring-2 ${style.ring} shadow-xl ${style.glow}`}
    >
      <div
        className={`absolute top-3 right-3 px-2 py-0.5 rounded-md text-xs font-semibold ${style.label}`}
      >
        {monster.rarity}
      </div>
      <div className="absolute top-3 left-3 text-[10px] tracking-wide uppercase bg-black/40 text-white px-2 py-0.5 rounded">
        {monster.position} • {monster.club}
      </div>
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div
            className="text-lg font-semibold tracking-wide text-emerald-200 drop-shadow"
            style={{
              textShadow:
                "0 1px 8px rgba(16,185,129,0.35)",
            }}
          >
            {monster.displayName}
          </div>
          <div className="mt-1 text-xs text-slate-300">
            {monster.realPlayerName}
          </div>
          <div className="mt-3 flex justify-center gap-2 text-[11px] text-slate-200">
            <span>ATK {monster.baseAttack}</span>
            <span>MAG {monster.baseMagic}</span>
            <span>DEF {monster.baseDefense}</span>
          </div>
          <div className="mt-2 text-[10px] text-emerald-300">
            Evo Lv. {monster.evolutionLevel}
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 rounded-b-2xl bg-gradient-to-t from-white/10 to-transparent" />
    </motion.div>
  );
};

// -------------------- Pack Visual --------------------
const PackVisual: React.FC<{
  theme: Theme;
  onOpen: () => void;
  disabled?: boolean;
}> = ({ theme, onOpen, disabled }) => {
  return (
    <motion.button
      disabled={disabled}
      onClick={onOpen}
      className={`relative w-60 h-80 select-none rounded-3xl ${theme.frame} shadow-2xl overflow-hidden ${
        disabled
          ? "opacity-60 cursor-not-allowed"
          : "cursor-pointer"
      }`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 14,
      }}
    >
      {/* Solid themed foil background */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.bodyFrom} ${theme.bodyVia} ${theme.bodyTo}`}
      />

      {/* Shiny moving highlight */}
      <motion.div
        className={`absolute -left-1/3 top-0 h-full w-1/3 bg-gradient-to-r ${theme.sheenFrom} to-transparent`}
        animate={{ left: ["-35%", "120%"] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{ mixBlendMode: "screen" }}
      />

      {/* Branding */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-4">
          <h2
            className={`text-2xl font-extrabold drop-shadow-lg ${theme.brandText}`}
          >
            FANTASY MONSTER
          </h2>
          <p
            className={`mt-1 text-xs font-semibold uppercase tracking-wide ${theme.subText}`}
          >
            {theme.label}
          </p>
        </div>
      </div>

      {/* Bottom hint */}
      {!disabled && (
        <div
          className={`absolute bottom-3 left-0 right-0 text-center text-xs font-semibold ${theme.subText}`}
        >
          Tap to rip open
        </div>
      )}
    </motion.button>
  );
};

// -------------------- Main Flow --------------------
type Phase =
  | "idle"
  | "buying"
  | "ready"
  | "opening"
  | "revealed"
  | "error";

const PackOpenModal: React.FC<Props> = ({
  packId,
  onClose,
  onOpened,
  redirectToSquad = true,
}) => {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [monsters, setMonsters] = useState<
    OpenedMonster[] | null
  >(null);
  const [err, setErr] = useState<string | null>(null);

  const theme = THEMES[packId];

  const didBuyRef = useRef(false);

  const buyPack = useCallback(async () => {
    setErr(null);
    setPhase("buying");
    try {
      const r = await fetch("/api/packs/open", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ packId }),
      });
      const j =
        (await r.json().catch(() => null)) as
          | PackOpenResponse
          | null;

      if (!r.ok || !j || j.error) {
        throw new Error(
          j?.error ||
            `Failed to open pack (HTTP ${r.status})`
        );
      }

      const pulled = j.monsters ?? [];
      setMonsters(pulled);
      onOpened?.(pulled, j.coinsAfter);
      setPhase("ready");
    } catch (e: any) {
      setErr(
        e?.message ||
          "Failed to open pack. Please try again."
      );
      setPhase("error");
    }
  }, [packId, onOpened]);

  useEffect(() => {
    if (didBuyRef.current) return;
    didBuyRef.current = true;
    void buyPack();
  }, [buyPack]);

  const openPack = useCallback(() => {
    if (phase !== "ready") return;
    setPhase("opening");
    setTimeout(() => {
      setPhase("revealed");
    }, 800);
  }, [phase]);

  function handleAddToSquad() {
    // Monsters are already in collection.
    // If redirectToSquad is true, go to /squad; otherwise just close the modal.
    if (redirectToSquad) {
      onClose?.();
      router.push("/squad");
    } else {
      onClose?.();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-slate-950/80 ring-1 ring-white/10 backdrop-blur-xl p-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            Pack Opening
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        {/* Body (scrollable on mobile) */}
        <div className="mt-6 flex-1 overflow-y-auto">
          <div className="grid place-items-center">
            {phase === "error" && (
              <div className="text-red-400 text-sm">
                {err}
              </div>
            )}

            {phase === "buying" && (
              <div className="flex flex-col items-center gap-4 text-slate-300">
                <div className="animate-spin h-8 w-8 border-2 border-slate-600 border-t-transparent rounded-full" />
                <div>Purchasing pack…</div>
              </div>
            )}

            <AnimatePresence>
              {phase === "ready" && (
                <motion.div
                  key="pack"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{
                    type: "spring",
                    stiffness: 120,
                    damping: 16,
                  }}
                >
                  <PackVisual
                    theme={theme}
                    onOpen={openPack}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {phase === "opening" && (
              <div className="relative w-60 h-80">
                {/* faint pack underlay */}
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <PackVisual
                    theme={theme}
                    onOpen={() => {}}
                    disabled
                  />
                </motion.div>
                {/* shred halves */}
                <motion.div
                  className="absolute top-0 left-0 right-0 h-1/2"
                  initial={{
                    opacity: 0,
                    rotate: 0,
                    x: 0,
                    y: 0,
                  }}
                  animate={{
                    opacity: 1,
                    rotate: -18,
                    x: -80,
                    y: -100,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                >
                  <div
                    className={`w-full h-full rounded-t-3xl ${theme.shredTop}`}
                  />
                </motion.div>
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-1/2"
                  initial={{
                    opacity: 0,
                    rotate: 0,
                    x: 0,
                    y: 0,
                  }}
                  animate={{
                    opacity: 1,
                    rotate: 18,
                    x: 80,
                    y: 100,
                  }}
                  transition={{
                    duration: 0.5,
                    ease: "easeOut",
                  }}
                >
                  <div
                    className={`w-full h-full rounded-b-3xl ${theme.shredBottom}`}
                  />
                </motion.div>
              </div>
            )}

            {phase === "revealed" && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
                {monsters?.map((m, i) => (
                  <MonsterRevealCard
                    key={m.id}
                    monster={m}
                    delay={i * 0.12}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-end gap-2">
          {phase === "revealed" && (
            <>
              <button
                onClick={onClose}
                className="rounded-xl px-4 py-2 bg-white/5 hover:bg-white/10 text-sm text-slate-200"
              >
                Close
              </button>
              <button
                onClick={handleAddToSquad}
                className="rounded-xl px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-sm font-semibold text-slate-950"
              >
                Add to squad
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PackOpenModal;
