// lib/objectives/types.ts

export type ObjectiveEventType =
  | "OPEN_PACK"
  | "SUBMIT_FANTASY_SQUAD"
  | "FANTASY_POINTS_EARNED"
  | "BATTLE_PLAYED"
  | "BATTLE_WON"
  | "MONSTER_EVOLVED"
  | "MARKET_BUY"
  | "MARKET_SELL";

export type ObjectiveEvent = {
  type: ObjectiveEventType;
  amount?: number; // defaults to 1 for count-based events
};
