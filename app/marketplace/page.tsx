// app/marketplace/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MonsterCard from "@/components/MonsterCard";
import MonsterDetailModal from "@/components/MonsterDetailModal";

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

  // Optional fields if/when you start sending them from the API
  artBasePath?: string | null;
  setCode?: string | null;
  editionType?: string | null;
  editionLabel?: string | null;
  serialNumber?: number | null;
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

// Helper to decide which art URL to use for a monster
function getArtUrlForMonster(m: UserMonsterDTO): string {
  // If backend already provides a path, use it
  if (m.artBasePath) return m.artBasePath;

  // Otherwise derive from templateCode
  if (m.templateCode) {
    return `/cards/base/${m.templateCode}.png`;
  }

  // Fallback if nothing else available
  return "/cards/base/test.png";
}

// ---------------------------
// Rarity sort helper
// ---------------------------
const rarityOrder: Record<string, number> = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4,
};

function rarityScore(r: string | undefined | null): number {
  if (!r) return 0;
  const key = r.toUpperCase().trim();
  return rarityOrder[key] ?? 0;
}

export default function MarketplacePage() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);

  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const [marketListings, setMarketListings] = useState<MarketListingDTO[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // which monster to show in the modal
  const [detailMonsterId, setDetailMonsterId] = useState<string | null>(null);

  // ---------------------------
  // Filters / search / sort
  // ---------------------------
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRarity, setFilterRarity] = useState<string>("ALL");
  const [filterPosition, setFilterPosition] = useState<string>("ALL");
  const [filterClub, setFilterClub] = useState<string>("ALL");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("newest");

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
        const colJson = (await colRes.json()) as CollectionResponse;
        setCollection(colJson.monsters || []);
      } else {
        setCollection([]);
      }

      if (marketRes.ok) {
        const marketJson = (await marketRes.json()) as MarketResponse;
        setMarketListings(marketJson.listings || []);
      } else {
        setMarketListings([]);
      }
    } catch {
      setError("Failed to load marketplace data. Please try again.");
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

  async function handleListForSale(userMonsterId: string) {
    setActionMessage(null);
    setError(null);

    const raw = window.prompt("Enter price in coins for this monster:");
    if (!raw) return;

    const price = parseInt(raw.trim(), 10);
    if (!Number.isFinite(price) || price <= 0) {
      window.alert("Price must be a positive number.");
      return;
    }

    try {
      const res = await fetch("/api/marketplace/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userMonsterId,
          price,
        }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        const msg = data?.error || "Failed to list monster for sale.";
        setError(msg);
        window.alert(msg);
        return;
      }

      setActionMessage("Monster listed for sale.");
      await loadAll();
    } catch {
      const msg = "Error listing monster for sale. Please try again.";
      setError(msg);
      window.alert(msg);
    }
  }

  async function handleBuy(listingId: string) {
    setActionMessage(null);
    setError(null);

    const confirmBuy = window.confirm("Are you sure you want to buy this monster?");
    if (!confirmBuy) return;

    try {
      const res = await fetch("/api/marketplace/buy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ listingId }),
      });

      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        const msg = data?.error || "Failed to complete purchase.";
        setError(msg);
        window.alert(msg);
        return;
      }

      setActionMessage("Purchase successful!");
      await loadAll();
    } catch {
      const msg = "Error completing purchase. Please try again.";
      setError(msg);
      window.alert(msg);
    }
  }

  // ---------------------------
  // Derived filter options
  // ---------------------------
  const availableClubs = useMemo(() => {
    const set = new Set<string>();
    for (const l of marketListings) {
      if (l.userMonster.club) {
        set.add(l.userMonster.club);
      }
    }
    return Array.from(set).sort();
  }, [marketListings]);

  const availableRarities = useMemo(() => {
    const set = new Set<string>();
    for (const l of marketListings) {
      if (l.userMonster.rarity) {
        set.add(l.userMonster.rarity.toUpperCase());
      }
    }
    return Array.from(set).sort((a, b) => rarityScore(b) - rarityScore(a));
  }, [marketListings]);

  // ---------------------------
  // Filtered + sorted listings
  // ---------------------------
  const filteredListings = useMemo(() => {
    let list = [...marketListings];

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      list = list.filter((l) => {
        const m = l.userMonster;
        return (
          m.displayName.toLowerCase().includes(term) ||
          m.realPlayerName.toLowerCase().includes(term) ||
          m.club.toLowerCase().includes(term)
        );
      });
    }

    if (filterRarity !== "ALL") {
      list = list.filter(
        (l) => l.userMonster.rarity.toUpperCase().trim() === filterRarity
      );
    }

    if (filterPosition !== "ALL") {
      list = list.filter(
        (l) => l.userMonster.position.toUpperCase().trim() === filterPosition
      );
    }

    if (filterClub !== "ALL") {
      list = list.filter((l) => l.userMonster.club === filterClub);
    }

    const minP = parseInt(minPrice, 10);
    if (!Number.isNaN(minP)) {
      list = list.filter((l) => l.price >= minP);
    }

    const maxP = parseInt(maxPrice, 10);
    if (!Number.isNaN(maxP)) {
      list = list.filter((l) => l.price <= maxP);
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case "price_low":
          return a.price - b.price;
        case "price_high":
          return b.price - a.price;
        case "rarity_high":
          return rarityScore(b.userMonster.rarity) - rarityScore(a.userMonster.rarity);
        case "oldest":
          return 0; // we'll reverse after sort
        case "newest":
        default:
          return 0;
      }
    });

    if (sortBy === "oldest") {
      list.reverse();
    }

    return list;
  }, [
    marketListings,
    searchTerm,
    filterRarity,
    filterPosition,
    filterClub,
    minPrice,
    maxPrice,
    sortBy,
  ]);

  if (checkingUser) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-sm text-slate-300">Loading marketplace...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="space-y-6">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <h2 className="text-xl font-semibold mb-1">Monster Marketplace</h2>
          <p className="text-sm text-slate-300">
            Log in or create an account to buy and sell monsters.
          </p>
          <p className="text-xs text-slate-400">
            The marketplace lets you trade monsterized Premier League players using in-game
            coins.
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
      {/* Header + balance */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Monster Marketplace</h2>
            <p className="text-xs text-slate-400 mb-2">
              Buy and sell monsterized Premier League players using in-game coins.
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
            className="self-start rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
          >
            Refresh
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        {actionMessage && (
          <p className="mt-2 text-xs text-emerald-300">{actionMessage}</p>
        )}
      </section>

      {/* Filters + search */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-100 mb-1">Search & filters</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Search */}
          <div className="sm:col-span-1">
            <label className="block text-[11px] text-slate-300 mb-1">
              Search by name or club
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="e.g. Haaland, MCI, Bruno..."
              className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
          </div>

          {/* Rarity + position */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] text-slate-300 mb-1">
                Rarity
              </label>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="ALL">All</option>
                {availableRarities.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-slate-300 mb-1">
                Position
              </label>
              <select
                value={filterPosition}
                onChange={(e) => setFilterPosition(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="ALL">All</option>
                <option value="GK">GK</option>
                <option value="DEF">DEF</option>
                <option value="MID">MID</option>
                <option value="FWD">FWD</option>
              </select>
            </div>
          </div>

          {/* Club + sort */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[11px] text-slate-300 mb-1">
                Club
              </label>
              <select
                value={filterClub}
                onChange={(e) => setFilterClub(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="ALL">All</option>
                {availableClubs.map((club) => (
                  <option key={club} value={club}>
                    {club}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-slate-300 mb-1">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="price_low">Price: Low → High</option>
                <option value="price_high">Price: High → Low</option>
                <option value="rarity_high">Rarity: High → Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Price range */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-2 sm:col-span-1">
            <div className="flex-1">
              <label className="block text-[11px] text-slate-300 mb-1">
                Min price
              </label>
              <input
                type="number"
                min={0}
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] text-slate-300 mb-1">
                Max price
              </label>
              <input
                type="number"
                min={0}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
            </div>
          </div>
          <div className="sm:col-span-2 flex items-end justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setFilterRarity("ALL");
                setFilterPosition("ALL");
                setFilterClub("ALL");
                setMinPrice("");
                setMaxPrice("");
                setSortBy("newest");
              }}
              className="rounded-full border border-slate-600 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
            >
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {/* Listings */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 mb-1">
          Listings
        </h3>
        {loadingMarket ? (
          <p className="text-xs text-slate-400">Loading listings...</p>
        ) : filteredListings.length === 0 ? (
          <p className="text-xs text-slate-400">
            No monsters match your filters. Try clearing some filters or check back later.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {filteredListings.map((listing) => {
              const isMine = listing.sellerId === user.id;
              const m = listing.userMonster;
              const artUrl = getArtUrlForMonster(m);

              return (
                <MonsterCard
                  key={listing.id}
                  monster={{
                    displayName: m.displayName,
                    realPlayerName: m.realPlayerName,
                    position: m.position,
                    club: m.club,
                    rarity: m.rarity,
                    baseAttack: m.baseAttack,
                    baseMagic: m.baseMagic,
                    baseDefense: m.baseDefense,
                    evolutionLevel: m.evolutionLevel,
                    artUrl,
                    setCode: m.setCode ?? undefined,
                    editionType: m.editionType ?? undefined,
                    editionLabel: m.editionLabel ?? undefined,
                    serialNumber: m.serialNumber ?? undefined,
                  }}
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
                  <div className="mt-2 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailMonsterId(m.id)}
                      className="w-full rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                    >
                      View details
                    </button>
                    {isMine ? (
                      <span className="text-[10px] text-amber-300 text-center">
                        Your listing
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleBuy(listing.id)}
                        className="w-full rounded-full bg-emerald-400 px-3 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-300"
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

      {/* Your Monsters */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        <h3 className="font-semibold text-slate-100 mb-1">
          Your Monsters
        </h3>
        {collection.length === 0 ? (
          <p className="text-xs text-slate-400">
            You don&apos;t own any monsters yet. Open your starter packs on the{" "}
            <Link href="/" className="underline underline-offset-2">
              home page
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {collection.map((m) => {
              const artUrl = getArtUrlForMonster(m);

              return (
                <MonsterCard
                  key={m.id}
                  monster={{
                    displayName: m.displayName,
                    realPlayerName: m.realPlayerName,
                    position: m.position,
                    club: m.club,
                    rarity: m.rarity,
                    baseAttack: m.baseAttack,
                    baseMagic: m.baseMagic,
                    baseDefense: m.baseDefense,
                    evolutionLevel: m.evolutionLevel,
                    artUrl,
                    setCode: m.setCode ?? undefined,
                    editionType: m.editionType ?? undefined,
                    editionLabel: m.editionLabel ?? undefined,
                    serialNumber: m.serialNumber ?? undefined,
                  }}
                >
                  <div className="mt-2 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => setDetailMonsterId(m.id)}
                      className="w-full rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                    >
                      View details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleListForSale(m.id)}
                      className="w-full rounded-full border border-slate-600 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300"
                    >
                      List for Sale
                    </button>
                  </div>
                </MonsterCard>
              );
            })}
          </div>
        )}
      </section>

      {detailMonsterId && (
        <MonsterDetailModal
          monsterId={detailMonsterId}
          onClose={() => setDetailMonsterId(null)}
        />
      )}
    </main>
  );
}
