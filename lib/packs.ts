// lib/packs.ts

export type PackId = "starter" | "bronze" | "silver" | "gold";

export type PackDefinition = {
  id: PackId;
  name: string;
  description: string;
  cost: number; // 0 for free starter packs
  size: number; // how many monsters
  rarityBias: "normal" | "premium";
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
  },
  {
    id: "bronze",
    name: "Bronze Pack",
    description:
      "Budget pack with mostly common monsters and a small chance of rares.",
    cost: 400,
    size: 4,
    rarityBias: "normal",
  },
  {
    id: "silver",
    name: "Silver Pack",
    description:
      "Solid pack with better odds of rare and epic monsters.",
    cost: 900,
    size: 5,
    rarityBias: "premium",
  },
  {
    id: "gold",
    name: "Gold Pack",
    description:
      "Top-tier pack with boosted odds of epic and legendary monsters.",
    cost: 1800,
    size: 6,
    rarityBias: "premium",
  },
];

export function getPackDefinition(
  id: string | null | undefined
): PackDefinition | undefined {
  if (!id) return undefined;
  return PACK_DEFINITIONS.find((p) => p.id === id);
}
