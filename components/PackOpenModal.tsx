"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

// -------------------- Config (UI copy only) --------------------

// For the text that says how long listings last.
// This does NOT change backend TTL; that is in the API route.
const LISTING_TTL_DAYS = 2;

// -------------------- Types --------------------

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

  // allow art from backend, same as marketplace DTO
  artBasePath?: string | null;
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
  rewardPackId?: string;
  onClose?: () => void;
  onOpened?: (monsters: OpenedMonster[], coinsAfter?: number) => void;
  /**
   * If true (default): when everything in the pack is resolved, redirect to /squad.
   */
  redirectToSquad?: boolean;
  /**
   * All templateCodes the user already owns in their collection.
   * Used to mark duplicates so they CANNOT be added to a squad from here.
   */
  ownedTemplateCodes?: string[];
};

// -------------------- Shared art helper --------------------

function getArtUrlForMonster(
  m: Pick<OpenedMonster, "templateCode" | "artBasePath">
): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) {
    return `/cards/base/${m.templateCode}.png`;
  }
  return "/cards/base/test.png";
}

// -------------------- Image preloading helper --------------------

function preloadImages(urls: string[]): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

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
        if (loaded >= total) {
          resolve();
        }
      };
      img.src = url;
    });
  });
}

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
  selected?: boolean;
  isDuplicate?: boolean;
}> = ({ monster, delay = 0, selected = false, isDuplicate = false }) => {
  const style = rarityStyle[rarityKey(monster.rarity)];
  const artUrl = getArtUrlForMonster(monster);

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
      className={`relative w-60 sm:w-64 h-80 sm:h-96 rounded-2xl p-3 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 ring-2 ${
        style.ring
      } shadow-xl ${style.glow} ${
        selected ? "ring-4 ring-emerald-400 shadow-emerald-400/60" : ""
      }`}
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      <div
        className={`absolute top-3 right-3 px-2 py-0.5 rounded-md text-xs font-semibold ${style.label}`}
      >
        {monster.rarity}
      </div>
      <div className="absolute top-3 left-3 text-[10px] tracking-wide uppercase bg-black/40 text-white px-2 py-0.5 rounded">
        {monster.position} • {monster.club}
      </div>

      <div className="mt-6 mb-3 relative w-full h-44 sm:h-56 overflow-hidden rounded-xl">
        <motion.img
          src={artUrl}
          alt={monster.displayName}
          className="w-full h-full object-cover"
          style={{
            backfaceVisibility: "hidden",
            transformStyle: "preserve-3d",
          }}
        />
      </div>

      <div className="flex flex-col items-center justify-start">
        <div className="text-center">
          <div
            className="text-lg sm:text-xl font-semibold tracking-wide text-emerald-200 drop-shadow"
            style={{
              textShadow: "0 1px 8px rgba(16,185,129,0.35)",
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
          {isDuplicate && (
            <div className="mt-2 text-[10px] text-amber-300 font-semibold">
              Duplicate – cannot be added to squad
            </div>
          )}
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
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      }`}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 120,
        damping: 14,
      }}
    >
      <div
        className={`absolute inset-0 bg-gradient-to-br ${theme.bodyFrom} ${theme.bodyVia} ${theme.bodyTo}`}
      />
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
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className={`text-2xl font-extrabold drop-shadow-lg ${theme.brandText}`}>
            FANTASY MONSTER
          </h2>
          <p className={`mt-1 text-xs font-semibold uppercase tracking-wide ${theme.subText}`}>
            {theme.label}
          </p>
        </div>
      </div>
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
type Phase = "idle" | "buying" | "ready" | "opening" | "revealed" | "error";

const PackOpenModal: React.FC<Props> = ({
  packId,
  rewardPackId,
  onClose,
  onOpened,
  redirectToSquad = true,
  ownedTemplateCodes,
}) => {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [monsters, setMonsters] = useState<OpenedMonster[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // MULTI-SELECT: ids of monsters selected for actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Action state/messages for quick sell / list / add
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [acting, setActing] = useState<boolean>(false);

  // Listing flow state (price prompt inside modal)
  const [isListingMode, setIsListingMode] = useState(false);
  const [listingTargetId, setListingTargetId] = useState<string | null>(null);
  const [listingPrice, setListingPrice] = useState<string>("");

  const theme = THEMES[packId];
  const didBuyRef = useRef(false);

  const ownedTemplateSet = useMemo(
    () => new Set(ownedTemplateCodes ?? []),
    [ownedTemplateCodes]
  );

  // DUPLICATE LOGIC
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    const seenInPack = new Map<string, string>(); // templateCode -> monsterId

    if (!monsters) return ids;

    for (const m of monsters) {
      const code = m.templateCode;
      const alreadyOwned = ownedTemplateSet.has(code);

      if (alreadyOwned) {
        ids.add(m.id);
        continue;
      }

      const existingId = seenInPack.get(code);
      if (existingId) {
        ids.add(existingId);
        ids.add(m.id);
      } else {
        seenInPack.set(code, m.id);
      }
    }

    return ids;
  }, [monsters, ownedTemplateSet]);

  const selectedMonsters =
    monsters?.filter((m) => selectedIds.includes(m.id)) ?? [];
  const anySelected = selectedMonsters.length > 0;
  const anySelectedDuplicate = selectedMonsters.some((m) =>
    duplicateIds.has(m.id)
  );

  const buyPack = useCallback(async () => {
    setErr(null);
    setPhase("buying");
    setActionError(null);
    setActionMessage(null);
    setSelectedIds([]);
    setIsListingMode(false);
    setListingTargetId(null);
    setListingPrice("");

    try {
      const url = rewardPackId ? "/api/reward-packs/open" : "/api/packs/open";
      const body = rewardPackId ? { rewardPackId } : { packId };

      const r = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const j = (await r.json().catch(() => null)) as PackOpenResponse | null;

      if (!r.ok || !j || j.error) {
        throw new Error(j?.error || `Failed to open pack (HTTP ${r.status})`);
      }

      const pulled = j.monsters ?? [];

      setMonsters(pulled);
      onOpened?.(pulled, j.coinsAfter);

      const artUrls = pulled.map((m) => getArtUrlForMonster(m));
      await preloadImages(artUrls);

      setPhase("ready");
    } catch (e: any) {
      setErr(e?.message || "Failed to open pack. Please try again.");
      setPhase("error");
    }
  }, [packId, rewardPackId, onOpened]);

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

  // Toggle select/deselect a monster card
  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    // When selection changes, cancel listing mode if the target is no longer selected
    setIsListingMode(false);
    setListingTargetId(null);
    setListingPrice("");
  }

  // Select / unselect all
  function toggleSelectAll() {
    if (!monsters || monsters.length === 0) return;
    if (selectedIds.length === monsters.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(monsters.map((m) => m.id));
    }
    setIsListingMode(false);
    setListingTargetId(null);
    setListingPrice("");
  }

  // ADD TO SQUAD (KEEP):
  // - Monsters are already in the collection because pack open created them.
  // - Here "Add to squad" just means "resolve" them from this UI.
  // - Duplicates CANNOT be added from here – enforce that.
  function handleAddToSquadBatch() {
    setActionError(null);
    setActionMessage(null);

    if (!monsters || selectedIds.length === 0) return;

    if (anySelectedDuplicate) {
      setActionError(
        "One or more selected monsters are duplicates. Duplicates must be quick-sold or listed on the market from here."
      );
      return;
    }

    const remaining = monsters.filter((m) => !selectedIds.includes(m.id));
    const count = selectedIds.length;

    setMonsters(remaining);
    setSelectedIds([]);
    setIsListingMode(false);
    setListingTargetId(null);
    setListingPrice("");
    setActionMessage(
      `Added ${count} monster${count > 1 ? "s" : ""} to your collection.`
    );

    if (remaining.length === 0) {
      // Everything resolved
      if (redirectToSquad) {
        onClose?.();
        router.push("/squad");
      } else {
        onClose?.();
      }
    }
  }

  // QUICK-SELL (BATCH)
  async function handleQuickSellBatch() {
    if (!monsters || selectedIds.length === 0) return;

    setActionError(null);
    setActionMessage(null);
    setActing(true);
    setIsListingMode(false);
    setListingTargetId(null);
    setListingPrice("");

    try {
      let lastMessage: string | null = null;

      for (const id of selectedIds) {
        const res = await fetch("/api/me/monsters/quick-sell", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            userMonsterId: id,
          }),
        });

        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          coinsAfter?: number;
          message?: string;
        } | null;

        if (!res.ok || !data?.ok) {
          throw new Error(
            data?.error || "Failed to quick-sell one or more monsters."
          );
        }

        lastMessage = data.message || "Quick-sold selected monsters.";
      }

      const remaining = monsters.filter((m) => !selectedIds.includes(m.id));
      const count = selectedIds.length;

      setMonsters(remaining);
      setSelectedIds([]);
      setActionMessage(
        lastMessage ||
          `Quick-sold ${count} monster${count > 1 ? "s" : ""} for coins.`
      );

      if (typeof router.refresh === "function") {
        router.refresh();
      }

      if (remaining.length === 0) {
        if (redirectToSquad) {
          onClose?.();
          router.push("/squad");
        } else {
          onClose?.();
        }
      }
    } catch (e: any) {
      setActionError(
        e?.message || "Something went wrong quick-selling selected monsters."
      );
    } finally {
      setActing(false);
    }
  }

  // Start listing mode: prompt for price (single selected monster)
  function startListingMode() {
    if (!monsters || selectedIds.length !== 1) return;
    const id = selectedIds[0];

    setActionError(null);
    setActionMessage(null);
    setIsListingMode(true);
    setListingTargetId(id);
    setListingPrice("");
  }

  // Confirm listing
  async function confirmListing() {
    if (!monsters || !listingTargetId) return;

    const priceNum = Number(listingPrice);
    if (!priceNum || Number.isNaN(priceNum) || priceNum <= 0) {
      setActionError("Please enter a positive coin price.");
      return;
    }

    setActing(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          userMonsterId: listingTargetId,
          price: priceNum,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        listingId?: string;
        price?: number;
      } | null;

      if (!res.ok || data?.error) {
        throw new Error(data?.error || "Failed to list monster.");
      }

      const remaining = monsters.filter((m) => m.id !== listingTargetId);

      setMonsters(remaining);
      setSelectedIds((prev) => prev.filter((id) => id !== listingTargetId));
      setActionMessage(
        data?.message || "Monster listed on the marketplace."
      );
      setIsListingMode(false);
      setListingTargetId(null);
      setListingPrice("");

      if (typeof router.refresh === "function") {
        router.refresh();
      }

      if (remaining.length === 0) {
        if (redirectToSquad) {
          onClose?.();
          router.push("/squad");
        } else {
          onClose?.();
        }
      }
    } catch (e: any) {
      setActionError(e?.message || "Something went wrong listing this monster.");
    } finally {
      setActing(false);
    }
  }

  // Cancel listing mode
  function cancelListingMode() {
    setIsListingMode(false);
    setListingTargetId(null);
    setListingPrice("");
  }

  // Auto-close guard: if somehow monsters go null/empty in revealed phase
  useEffect(() => {
    if (phase === "revealed" && monsters && monsters.length === 0) {
      if (redirectToSquad) {
        onClose?.();
        router.push("/squad");
      } else {
        onClose?.();
      }
    }
  }, [monsters, phase, redirectToSquad, onClose, router]);

  const canClose = !monsters || monsters.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-3xl bg-slate-950/80 ring-1 ring-white/10 backdrop-blur-xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">
            {rewardPackId ? "Reward Pack Opening" : "Pack Opening"}
          </h3>
          <button
            onClick={canClose ? onClose : undefined}
            disabled={!canClose}
            className={`rounded-lg px-3 py-1 text-sm ${
              canClose
                ? "text-slate-300 hover:bg-white/10"
                : "text-slate-500 cursor-not-allowed"
            }`}
          >
            Close
          </button>
        </div>

        <div className="mt-1 text-[11px] text-slate-500">
          You must resolve all monsters from this pack (keep, quick-sell, or
          list on market) before leaving this screen.
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">
          <div className="grid place-items-center">
            {phase === "error" && (
              <div className="text-red-400 text-sm">{err}</div>
            )}

            {phase === "buying" && (
              <div className="flex flex-col items-center gap-4 text-slate-300">
                <div className="animate-spin h-8 w-8 border-2 border-slate-600 border-t-transparent rounded-full" />
                <div>Opening pack…</div>
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
                  <PackVisual theme={theme} onOpen={openPack} />
                </motion.div>
              )}
            </AnimatePresence>

            {phase === "opening" && (
              <div className="relative w-60 h-80">
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <PackVisual theme={theme} onOpen={() => {}} disabled />
                </motion.div>
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
                  <div className={`w-full h-full rounded-t-3xl ${theme.shredTop}`} />
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
                  <div className={`w-full h-full rounded-b-3xl ${theme.shredBottom}`} />
                </motion.div>
              </div>
            )}

            {phase === "revealed" && monsters && monsters.length > 0 && (
              <div className="mt-2 w-full">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] text-slate-300">
                    {selectedIds.length > 0
                      ? `${selectedIds.length} selected`
                      : "Tap cards to select them for an action."}
                    {anySelectedDuplicate && (
                      <span className="ml-2 text-amber-300">
                        (Selection includes duplicates that cannot be added to squad.)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-[11px] text-emerald-300 hover:text-emerald-200"
                  >
                    {monsters.length > 0 &&
                    selectedIds.length === monsters.length
                      ? "Unselect all"
                      : "Select all"}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {monsters.map((m, i) => {
                    const selected = selectedIds.includes(m.id);
                    const isDup = duplicateIds.has(m.id);

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleSelect(m.id)}
                        className={`rounded-3xl focus:outline-none focus:ring-2 focus:ring-emerald-400/70 ${
                          selected ? "ring-2 ring-emerald-400/80" : ""
                        }`}
                      >
                        <MonsterRevealCard
                          monster={m}
                          delay={i * 0.12}
                          selected={selected}
                          isDuplicate={isDup}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {phase === "revealed" && monsters && monsters.length === 0 && (
              <div className="mt-6 text-sm text-slate-200">
                All monsters from this pack have been handled.
              </div>
            )}
          </div>
        </div>

        {phase === "revealed" && monsters && monsters.length > 0 && (
          <div className="mt-8 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-slate-400">
                {anySelected ? (
                  <>
                    Choose what to do with the{" "}
                    <span className="text-emerald-300 font-semibold">
                      {selectedIds.length}
                    </span>{" "}
                    selected monster{selectedIds.length > 1 ? "s" : ""}.
                    <br />
                    Duplicates must be{" "}
                    <span className="font-semibold">quick-sold</span> or{" "}
                    <span className="font-semibold">listed on the market</span>.
                  </>
                ) : (
                  <>Tap one or more monsters above to select them, then choose an action.</>
                )}
                {actionMessage && (
                  <p className="mt-1 text-emerald-300">{actionMessage}</p>
                )}
                {actionError && (
                  <p className="mt-1 text-red-400">{actionError}</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 justify-end">
                {/* List – only when exactly one selected, opens price prompt */}
                <button
                  type="button"
                  disabled={selectedIds.length !== 1 || acting}
                  onClick={startListingMode}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    selectedIds.length !== 1 || acting
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-sky-400 text-slate-950 hover:bg-sky-300"
                  }`}
                >
                  List on market
                </button>

                {/* Quick-sell batch */}
                <button
                  type="button"
                  disabled={!anySelected || acting}
                  onClick={handleQuickSellBatch}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    !anySelected || acting
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  }`}
                >
                  Quick-sell selected
                </button>

                {/* Add to squad (keep) – disabled if any selected is duplicate */}
                <button
                  type="button"
                  disabled={!anySelected || anySelectedDuplicate || acting}
                  onClick={handleAddToSquadBatch}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${
                    !anySelected || anySelectedDuplicate || acting
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  }`}
                >
                  Add selected to squad
                </button>
              </div>
            </div>

            {/* Listing price prompt row */}
            {isListingMode && listingTargetId && (
              <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl bg-slate-900/70 px-4 py-3 border border-sky-500/40">
                <div className="text-xs text-slate-200">
                  <div className="font-semibold text-sky-300 mb-1">
                    List selected monster on the marketplace
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Enter your sale price in coins. This monster will be listed
                    for {LISTING_TTL_DAYS} days and removed from your pack
                    view.
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={listingPrice}
                    onChange={(e) => setListingPrice(e.target.value)}
                    className="w-28 rounded-lg bg-slate-800 border border-sky-500/60 px-2 py-1 text-xs text-slate-50 outline-none focus:ring-2 focus:ring-sky-400"
                    placeholder="Price"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={confirmListing}
                      disabled={acting}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        acting
                          ? "bg-sky-800 text-sky-300 cursor-not-allowed"
                          : "bg-sky-400 text-slate-950 hover:bg-sky-300"
                      }`}
                    >
                      Confirm listing
                    </button>
                    <button
                      type="button"
                      onClick={cancelListingMode}
                      disabled={acting}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PackOpenModal;
