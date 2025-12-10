// lib/packs.ts

export type PackId = "starter" | "bronze" | "silver" | "gold" | "mythical";

export type PackDefinition = {
  id: PackId;
  name: string;
  description: string;
  cost: number; // 0 for free starter packs
  size: number; // how many monsters
  rarityBias: "normal" | "premium";

  // Optional theming knobs
  // Codes like "CHRISTMAS_TERRORS_2025" which you can map to specific
  // MonsterTemplate.setCode values when building the pack pools.
  featuredSetCodes?: string[];

  // Chance [0–1] that a card in this pack is a LIMITED 1-of-10 edition
  // (handled in the pack-opening logic).
  limitedEditionChance?: number;

  // Chance [0–1] that a card in this pack is a UNIQUE 1-of-1 edition
  // (handled in the pack-opening logic, only for non-MYTHICAL cards).
  uniqueEditionChance?: number;

  // Chance [0–1] that a card in this pack rolls from the Mythical pool
  // instead of the normal JSON players.
  mythicalChancePerCard?: number;
};

export const PACK_DEFINITIONS: PackDefinition[] = [
  {
    id: "starter",
    name: "Starter Pack",
    description:
      "Free intro pack with a mix of common monsters to get your squad going.",
    cost: 0,
    size: 4,
    rarityBias: "normal",
    featuredSetCodes: ["BASE"],
    limitedEditionChance: 0,
    uniqueEditionChance: 0,
    mythicalChancePerCard: 0, // no Mythicals in free packs
  },
  {
    id: "bronze",
    name: "Bronze Pack",
    description:
      "Budget pack with mostly common monsters and a small chance of rares.",
    cost: 400,
    size: 4,
    rarityBias: "normal",
    featuredSetCodes: ["BASE"],
    // 0.2% per card for 1-of-10
    limitedEditionChance: 0.002,
    // 0.01% per card for 1-of-1
    uniqueEditionChance: 0.0001,
    mythicalChancePerCard: 0.001, // 0.1% chance per card
  },
  {
    id: "silver",
    name: "Silver Pack",
    description:
      "Solid pack with better odds of rare and epic monsters.",
    cost: 900,
    size: 5,
    rarityBias: "premium",
    featuredSetCodes: ["BASE"],
    // 0.5% per card for 1-of-10
    limitedEditionChance: 0.005,
    // 0.02% per card for 1-of-1
    uniqueEditionChance: 0.0002,
    mythicalChancePerCard: 0.002, // 0.2% chance per card
  },
  {
    id: "gold",
    name: "Gold Pack",
    description:
      "Top-tier pack with boosted odds of epic and legendary monsters.",
    cost: 1800,
    size: 6,
    rarityBias: "premium",
    featuredSetCodes: ["BASE"], // later you can add "CHRISTMAS_TERRORS_2025"
    // 1% per card for 1-of-10
    limitedEditionChance: 0.01,
    // 0.05% per card for 1-of-1
    uniqueEditionChance: 0.0005,
    mythicalChancePerCard: 0.004, // 0.4% chance per card
  },
  {
    id: "mythical",
    name: "Mythical Pack",
    description:
      "Ultra-premium pack with very low commons, big legendary odds, and a chance at Mythicals.",
    cost: 10000,
    size: 4, // premium, focused pack
    rarityBias: "premium",
    featuredSetCodes: ["BASE", "MYTHICAL"],
    // Mythical pack still focuses on Mythicals; limiteds only apply to non-MYTHICAL cards
    // pulled from the normal pool.
    limitedEditionChance: 0.02, // 2% per card for 1-of-10
    uniqueEditionChance: 0.001, // 0.1% per card for 1-of-1
    // 5% Mythical chance per card
    mythicalChancePerCard: 0.05,
  },
];

export function getPackDefinition(
  id: string | null | undefined
): PackDefinition | undefined {
  if (!id) return undefined;
  return PACK_DEFINITIONS.find((p) => p.id === id);
}
