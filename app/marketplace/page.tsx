"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MonsterCard from "@/components/MonsterCard";

type User = {
  id: string;
  email: string;
  coins: number;
};

type UserMonsterDTO = {
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

type CollectionResponse = {
  monsters: UserMonsterDTO[];
};

type MarketListingDTO = {
  id: string;
  price: number;
  sellerId: string;
  sellerEmail: string;
  userMonster: UserMonsterDTO;
};

type MarketResponse = {
  listings: MarketListingDTO[];
};

export default function MarketplacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  const [collection, setCollection] =
    useState<UserMonsterDTO[]>([]);
  const [marketListings, setMarketListings] =
    useState<MarketListingDTO[]>([]);
  const [loadingMarket, setLoadingMarket] =
    useState(true);
  const [error, setError] =
    useState<string | null>(null);
  const [actionMessage, setActionMessage] =
    useState<string | null>(null);

  async function loadAll() {
    setError(null);
    setActionMessage(null);
    setCheckingUser(true);
    setLoadingMarket(true);

    try {
      const [meRes, colRes, marketRes] = await Promise.all([
        fetch("/api/auth/me", {
          credentials: "include",
        }),
        fetch("/api/me/collection", {
          credentials: "include",
        }),
        fetch("/api/marketplace", {
          credentials: "include",
        }),
      ]);

      if (!meRes.ok) {
        setUser(null);
        setCollection([]);
        setMarketListings([]);
        return;
      }

      const meJson = (await meRes.json()) as {
        user: User | null;
      };
      setUser(meJson.user);

      if (!meJson.user) {
        setCollection([]);
        setMarketListings([]);
        return;
      }

      if (colRes.ok) {
        const colJson =
          (await colRes.json()) as CollectionResponse;
        setCollection(colJson.monsters || []);
      } else {
        setCollection([]);
      }

      if (marketRes.ok) {
        const marketJson =
          (await marketRes.json()) as MarketResponse;
        setMarketListings(marketJson.listings || []);
      } else {
        setMarketListings([]);
      }
    } catch {
      setError(
        "Failed to load marketplace data. Please try again."
      );
      setCollection([]);
      setMarketListings([]);
    } finally {
      setCheckingUser(false);
      setLoadingMarket(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleListForSale(monsterId: string) {
    setActionMessage(null);
    setError(null);

    const raw = window.prompt(
      "Enter price in coins for this monster:"
    );
    if (!raw) return;

    const price = parseInt(raw.trim(), 10);
    if (!Number.isFinite(price) || price <= 0) {
      window.alert("Price must be a positive number.");
      return;
    }

    try {
      const res = await fetch(
        "/api/marketplace/list",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            monsterId,
            price,
          }),
        }
      );

      const data = (await res
        .json()
        .catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        const msg =
          data?.error ||
          "Failed to list monster for sale.";
        setError(msg);
        window.alert(msg);
        return;
      }

      setActionMessage("Monster listed for sale.");
      await loadAll();
    } catch {
      const msg =
        "Error listing monster for sale. Please try again.";
      setError(msg);
      window.alert(msg);
    }
  }

  async function handleBuy(listingId: string) {
    setActionMessage(null);
    setError(null);

    const confirmBuy = window.confirm(
      "Are you sure you want to buy this monster?"
    );
    if (!confirmBuy) return;

    try {
      const res = await fetch(
        "/api/marketplace/buy",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ listingId }),
        }
      );

      const data = (await res
        .json()
        .catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        const msg =
          data?.error ||
          "Failed to complete purchase.";
        setError(msg);
        window.alert(msg);
        return;
      }

      setActionMessage("Purchase successful!");
      await loadAll();
    } catch {
      const msg =
        "Error completing purchase. Please try again.";
      setError(msg);
      window.alert(msg);
    }
  }

  if (checkingUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">
            Loading marketplace...
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
            Monster Marketplace
          </h2>
          <p className="text-sm text-slate-300">
            Log in or create an account to buy and sell
            monsters.
          </p>
          <p className="text-xs text-slate-400">
            The marketplace lets you trade monsterized
            Premier League players using in-game coins.
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
    <main className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              Monster Marketplace
            </h2>
            <p className="text-xs text-slate-400 mb-2">
              Buy and sell monsterized Premier League
              players using in-game coins.
            </p>
            <p className="text-xs text-emerald-300">
              Balance:{" "}
              <span className="font-mono font-semibold">
                {user.coins} coins
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={loadAll}
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
        {actionMessage && (
          <p className="mt-2 text-xs text-emerald-300">
            {actionMessage}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 mb-1">
          Listings
        </h3>
        {loadingMarket ? (
          <p className="text-xs text-slate-400">
            Loading listings...
          </p>
        ) : marketListings.length === 0 ? (
          <p className="text-xs text-slate-400">
            No monsters are listed for sale yet. Be the
            first to list one!
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {marketListings.map((listing) => {
              const isMine =
                listing.sellerId === user.id;
              const m = listing.userMonster;

              return (
                <MonsterCard
                  key={listing.id}
                  monster={m}
                  rightBadge={
                    <span className="uppercase text-[10px] text-emerald-300">
                      {m.rarity}
                    </span>
                  }
                >
                  <p className="text-[11px] text-slate-200 mt-1">
                    Price:{" "}
                    <span className="font-mono font-semibold">
                      {listing.price}
                    </span>{" "}
                    coins
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Seller: {listing.sellerEmail}
                  </p>
                  <div className="mt-2">
                    {isMine ? (
                      <span className="text-[10px] text-amber-300">
                        Your listing
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          handleBuy(listing.id)
                        }
                        className="mt-1 w-full rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-300"
                      >
                        Buy Monster
                      </button>
                    )}
                  </div>
                </MonsterCard>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 mb-1">
          Your Monsters
        </h3>
        {collection.length === 0 ? (
          <p className="text-xs text-slate-400">
            You don&apos;t own any monsters yet. Open your
            starter packs on the{" "}
            <Link
              href="/"
              className="underline underline-offset-2"
            >
              home page
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {collection.map((m) => (
              <MonsterCard key={m.id} monster={m}>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      handleListForSale(m.id)
                    }
                    className="w-full rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                  >
                    List for Sale
                  </button>
                </div>
              </MonsterCard>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
