// lib/packs.ts

export type PackId = "starter" | "bronze" | "silver" | "gold";

export type PackDefinition = {
  id: PackId;
  name: string;
  description: string;
  cost: number; // 0 for free starter packs
  size: number; // how many monsters
  rarityBias: "normal" | "premium";

  // NEW: optional theming knobs
  // Codes like "CHRISTMAS_TERRORS_2025" which you can map to specific
  // MonsterTemplate.setCode values when building the pack pools.
  featuredSetCodes?: string[];

  // Chance [0–1] that a card in this pack is a LIMITED edition
  // (e.g. 0.05 = 5% per card roll, handled in the pack-opening logic).
  limitedEditionChance?: number;
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
    limitedEditionChance: 0.005, // 0.5% chance per card, adjust as you like
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
    limitedEditionChance: 0.01,
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
    limitedEditionChance: 0.03, // e.g. 3% per card
  },
];

export function getPackDefinition(
  id: string | null | undefined
): PackDefinition | undefined {
  if (!id) return undefined;
  return PACK_DEFINITIONS.find((p) => p.id === id);
}
