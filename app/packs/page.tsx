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

// Shop shows only paid packs; starter is free on homepage
const SHOP_PACKS = PACK_DEFINITIONS.filter(
  (p) => p.id !== "starter"
);

export default function PacksPage() {
  const [user, setUser] = useState<User | null>(null);
  const [coins, setCoins] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const [activePack, setActivePack] =
    useState<PackId | null>(null);
  const [status, setStatus] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  async function loadInitial() {
    setLoading(true);
    setError(null);
    setStatus(null);

    try {
      const meRes = await fetch("/api/auth/me", {
        credentials: "include",
      });

        if (!meRes.ok) {
        setUser(null);
        setCoins(0);
        return;
      }

      const meJson = (await meRes.json()) as MeResponse;

      if (!meJson.user) {
        setUser(null);
        setCoins(0);
      } else {
        setUser(meJson.user);
        setCoins(meJson.user.coins);
      }
    } catch {
      setError(
        "Failed to load pack shop. Please refresh the page."
      );
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

    if (!user) {
      setError(
        "You must be logged in to open packs."
      );
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

  function handleOpened(
    monsters: OpenedMonster[],
    coinsAfter?: number
  ) {
    if (typeof coinsAfter === "number") {
      setCoins(coinsAfter);
    }
    if (monsters.length > 0) {
      setStatus(
        `You pulled ${monsters.length} monster${monsters.length > 1 ? "s" : ""}!`
      );
    }
  }

  if (loading) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading pack shop...
          </p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <h2 className="text-xl font-semibold mb-1">
            Shop
          </h2>
          <p className="text-sm text-slate-300">
            Log in or create an account to buy packs,
            open monsters, and build your squad.
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
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold mb-1">
                Shop
              </h2>
              <p className="text-xs text-slate-400 mb-2">
                Spend coins on Bronze, Silver, and Gold
                packs to grow your Fantasy Monster
                League club.
              </p>
              <p className="text-xs text-emerald-300">
                Coins:{" "}
                <span className="font-mono font-semibold">
                  {coins}
                </span>
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
          {error && (
            <p className="mt-2 text-xs text-red-400">
              {error}
            </p>
          )}
          {status && (
            <p className="mt-2 text-xs text-emerald-300">
              {status}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <h3 className="font-semibold text-slate-100 mb-1">
            Available Packs
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {SHOP_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs flex flex-col justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100">
                    {pack.name}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {pack.description}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-300 mt-1">
                  <span>
                    {pack.size} monsters •{" "}
                    <span className="font-mono">
                      {pack.cost}
                    </span>{" "}
                    coins
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    handleClickPack(
                      pack.id as PackId,
                      pack.cost
                    )
                  }
                  className={`mt-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
                    coins < pack.cost
                      ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                      : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                  }`}
                  disabled={coins < pack.cost}
                >
                  Open Pack
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>

      {activePack && (
  <PackOpenModal
    packId={activePack}
    onClose={handleCloseModal}
    onOpened={handleOpened}
    redirectToSquad={false} // 👈 stay on the shop page
  />
)}

    </>
  );
}
