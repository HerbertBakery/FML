// lib/chipShop.ts
//
// Static config for which chips are sold in the in-game shop
// and how much they cost in coins.

export type ChipShopItem = {
  templateCode: string; // must match ChipTemplate.code in the DB
  displayName: string;
  shortDescription: string;
  price: number;
  highlight?: string;
};

export const CHIP_SHOP_ITEMS: ChipShopItem[] = [
  {
    templateCode: "GOAL_SURGE",
    displayName: "Goal Surge Chip",
    shortDescription: "Big evolution boost when your monster scores.",
    price: 2500,
    highlight: "Perfect for lethal forwards.",
  },
  {
    templateCode: "PLAYMAKER",
    displayName: "Playmaker Chip",
    shortDescription: "Rewards monsters that rack up assists.",
    price: 2200,
    highlight: "Midfield maestros love this.",
  },
  {
    templateCode: "WALL",
    displayName: "Wall Chip",
    shortDescription: "Boosts clean-sheet evolution for GKs and DEFs.",
    price: 2000,
    highlight: "Fortify your back line.",
  },
  {
    templateCode: "HEROIC_HAUL",
    displayName: "Heroic Haul Chip",
    shortDescription: "Massive bonus for monster match-winning hauls.",
    price: 3200,
    highlight: "High risk, high reward.",
  },
  {
    templateCode: "STEADY_FORM",
    displayName: "Steady Form Chip",
    shortDescription: "Rewards consistent, steady-scoring monsters.",
    price: 1800,
    highlight: "Great for reliable regulars.",
  },
];

export function getChipShopItem(templateCode: string): ChipShopItem | undefined {
  return CHIP_SHOP_ITEMS.find((item) => item.templateCode === templateCode);
}
