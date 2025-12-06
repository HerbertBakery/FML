// app/packs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PACK_DEFINITIONS } from "@/lib/packs";
import PackOpenModal, {
  OpenedMonster,
  PackId,
} from "@/components/PackOpenModal";

type User = {
  id: string;
  email: string;
  coins: number;
};

type MeResponse = {
  user: User | null;
};

type ChipShopItem = {
  templateCode: string;
  name: string;
  description: string;
  price: number;
  maxTries: number;
  conditionType: string;
};

// Shop shows only paid packs; starter is free on homepage
const SHOP_PACKS = PACK_DEFINITIONS.filter((p) => p.id !== "starter");

function getPackCardClasses(packId: string) {
  switch (packId) {
    case "bronze":
      return "border-amber-500 bg-gradient-to-b from-slate-950 via-amber-900/50 to-slate-950 shadow-[0_0_18px_rgba(245,158,11,0.35)]";
    case "silver":
      return "border-slate-300 bg-gradient-to-b from-slate-950 via-slate-700/60 to-slate-950 shadow-[0_0_18px_rgba(148,163,184,0.35)]";
    case "gold":
      return "border-yellow-400 bg-gradient-to-b from-slate-950 via-yellow-800/60 to-slate-950 shadow-[0_0_20px_rgba(250,204,21,0.45)]";
    case "mythical":
      return "border-fuchsia-400 bg-gradient-to-b from-slate-950 via-fuchsia-900/60 to-slate-950 shadow-[0_0_24px_rgba(232,121,249,0.45)]";
    default:
      return "border-slate-800 bg-slate-950/70";
  }
}

export default function PacksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [activePack, setActivePack] = useState<PackId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chip shop state
  const [chipItems, setChipItems] = useState<ChipShopItem[]>([]);
  const [chipStatus, setChipStatus] = useState<string | null>(null);
  const [chipError, setChipError] = useState<string | null>(null);
  const [buyingChipCode, setBuyingChipCode] = useState<string | null>(null);

  async function loadInitial() {
    setLoading(true);
    setError(null);
    setStatus(null);
    setChipError(null);
    setChipStatus(null);

    try {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include",
      });

      if (!meRes.ok) {
        setUser(null);
        setCoins(0);
      } else {
        const meJson = (await meRes.json()) as MeResponse;
        if (!meJson.user) {
          setUser(null);
          setCoins(0);
        } else {
          setUser(meJson.user);
          setCoins(meJson.user.coins);
        }
      }

      // Load shop chips
      const chipRes = await fetch("/api/chips/shop", {
        credentials: "include",
      });

      if (chipRes.ok) {
        const chipJson = (await chipRes.json()) as {
          items?: ChipShopItem[];
          error?: string;
        };
        if (chipJson.items && Array.isArray(chipJson.items)) {
          setChipItems(chipJson.items);
        } else if (chipJson.error) {
          setChipError(chipJson.error);
        }
      } else {
        // Silent fail; only set a small error for chips section
        const errJson = (await chipRes.json().catch(() => null)) as
          | { error?: string }
          | null;
        setChipError(
          errJson?.error || "Failed to load evolution chips."
        );
      }
    } catch {
      setError("Failed to load pack shop. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  function handleClickPack(packId: PackId, cost: number) {
    setStatus(null);
    setError(null);
    setChipStatus(null);
    setChipError(null);

    if (!user) {
      setError("You must be logged in to open packs.");
      return;
    }
    if (coins < cost) {
      setError("Not enough coins for this pack.");
      return;
    }

    setActivePack(packId);
  }

  function handleCloseModal() {
    setActivePack(null);
  }

  function handleOpened(monsters: OpenedMonster[], coinsAfter?: number) {
    if (typeof coinsAfter === "number") {
      setCoins(coinsAfter);
    }
    if (monsters.length > 0) {
      setStatus(
        `You pulled ${monsters.length} monster${
          monsters.length > 1 ? "s" : ""
        }!`
      );
    }
  }

  async function handleBuyChip(templateCode: string, price: number) {
    setChipStatus(null);
    setChipError(null);
    setStatus(null);
    setError(null);

    if (!user) {
      setChipError("You must be logged in to buy chips.");
      return;
    }

    if (coins < price) {
      setChipError("Not enough coins for this chip.");
      return;
    }

    setBuyingChipCode(templateCode);
    try {
      const res = await fetch("/api/chips/buy", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ templateCode }),
      });

      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        message?: string;
        coinsAfter?: number;
      } | null;

      if (!res.ok || !data || data.error) {
        throw new Error(data?.error || "Failed to buy chip.");
      }

      if (typeof data.coinsAfter === "number") {
        setCoins(data.coinsAfter);
      }

      setChipStatus(data.message || "Chip purchased.");
    } catch (err: any) {
      setChipError(err?.message || "Failed to buy chip.");
    } finally {
      setBuyingChipCode(null);
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">Loading pack shop...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <h2 className="text-xl font-semibold mb-1">Shop</h2>
          <p className="text-sm text-slate-300">
            Log in or create an account to buy packs, open monsters, and build
            your squad.
          </p>
          <div className="flex gap-3">
            <Link
              href="/register"
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Sign Up
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-300"
            >
              Log In
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <main className="space-y-6">
        {/* Header / balance */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">Shop</h2>
              <p className="text-xs text-slate-400 mb-2">
                Spend coins on Bronze, Silver, Gold and Mythical packs, or pick
                up evolution chips to supercharge your monsters.
              </p>
              <p className="text-xs text-emerald-300">
                Coins:{" "}
                <span className="font-mono font-semibold">{coins}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={loadInitial}
              className="rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
            >
              Refresh
            </button>
          </div>
          {(error || status || chipError || chipStatus) && (
            <div className="mt-2 space-y-1 text-xs">
              {error && <p className="text-red-400">{error}</p>}
              {status && <p className="text-emerald-300">{status}</p>}
              {chipError && <p className="text-red-400">{chipError}</p>}
              {chipStatus && <p className="text-sky-300">{chipStatus}</p>}
            </div>
          )}
        </section>

        {/* Packs section */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="font-semibold text-slate-100 mb-1">Available Packs</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {SHOP_PACKS.map((pack) => {
              const cardClasses = getPackCardClasses(pack.id);

              const notEnoughCoins = coins < pack.cost;

              return (
                <div
                  key={pack.id}
                  className={`rounded-xl border p-3 text-xs flex flex-col justify-between gap-3 relative overflow-hidden ${cardClasses}`}
                >
                  {/* subtle inner sheen */}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-60" />
                  <div className="relative">
                    {/* "FML PACK" branding strip */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] uppercase text-slate-100">
                        FML PACK
                      </div>
                      <div className="text-[9px] font-mono uppercase text-slate-300/80">
                        {pack.id.toUpperCase()}
                      </div>
                    </div>

                    <p className="text-sm font-semibold text-slate-50 drop-shadow">
                      {pack.name}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-200/80">
                      {pack.description}
                    </p>
                  </div>

                  <div className="relative mt-2 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-100/90">
                      <span>
                        {pack.size} monsters •{" "}
                        <span className="font-mono">{pack.cost}</span> coins
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleClickPack(pack.id as PackId, pack.cost)
                      }
                      className={`mt-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
                        notEnoughCoins
                          ? "bg-black/40 text-slate-500 cursor-not-allowed"
                          : pack.id === "mythical"
                          ? "bg-fuchsia-400 text-slate-950 hover:bg-fuchsia-300"
                          : pack.id === "gold"
                          ? "bg-yellow-400 text-slate-950 hover:bg-yellow-300"
                          : pack.id === "silver"
                          ? "bg-slate-200 text-slate-900 hover:bg-slate-100"
                          : "bg-amber-400 text-slate-950 hover:bg-amber-300"
                      }`}
                      disabled={notEnoughCoins}
                    >
                      Open Pack
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Chips section */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="font-semibold text-slate-100 mb-1">Evolution Chips</h3>
          <p className="text-[11px] text-slate-400 mb-1">
            Spend coins on special evolution chips to boost your monsters.
          </p>

          {chipItems.length === 0 && !chipError && (
            <p className="text-[11px] text-slate-500">
              No evolution chips are currently for sale.
            </p>
          )}

          {chipError && (
            <p className="text-[11px] text-red-400">{chipError}</p>
          )}

          {chipItems.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-3">
              {chipItems.map((chip) => {
                const notEnoughCoins = coins < chip.price;
                const isBuying = buyingChipCode === chip.templateCode;

                return (
                  <div
                    key={chip.templateCode}
                    className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs flex flex-col justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {chip.name}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {chip.description}
                      </p>
                      <p className="mt-2 text-[10px] text-sky-300">
                        Condition: {chip.conditionType} • Max tries:{" "}
                        {chip.maxTries}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
                      <span>
                        <span className="font-mono">{chip.price}</span> coins
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleBuyChip(chip.templateCode, chip.price)
                      }
                      className={`mt-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
                        notEnoughCoins || isBuying
                          ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                          : "bg-sky-400 text-slate-950 hover:bg-sky-300"
                      }`}
                      disabled={notEnoughCoins || isBuying}
                    >
                      {isBuying ? "Buying..." : "Buy Chip"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {activePack && (
        <PackOpenModal
          packId={activePack}
          onClose={handleCloseModal}
          onOpened={handleOpened}
          redirectToSquad={false} // stay on the shop page
        />
      )}
    </>
  );
}
