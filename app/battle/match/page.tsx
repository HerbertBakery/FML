"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ---- Types reused from your world ----

type UserMonsterDTO = {
  id: string;
  templateCode: string;
  displayName: string;
  realPlayerName: string;
  position: "GK" | "DEF" | "MID" | "FWD" | string;
  club: string;
  rarity: string;
  baseAttack: number;
  baseMagic: number;
  baseDefense: number;
  evolutionLevel: number;
  artBasePath?: string | null;
  setCode?: string | null;
  editionType?: string | null;
  editionLabel?: string | null;
  serialNumber?: number | null;
};

type CollectionResponse = {
  monsters: UserMonsterDTO[];
  starterPacksOpened: number;
};

// ---- Battle-specific types ----

type Position = "GK" | "DEF" | "MID" | "FWD";
type RarityTier = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";

type Keyword = "TAUNT" | "RUSH" | "STEALTH";

type BattleMonsterCard = {
  id: string;
  kind: "MONSTER";
  sourceMonsterId: string;
  name: string;
  position: Position;
  rarityTier: RarityTier;
  manaCost: number;
  attack: number;
  health: number;
  maxHealth: number;
  magic: number;
  keywords: Keyword[];
  hasSummoningSickness: boolean;
  canAttack: boolean;

  // additional status
  bypassDefendersOnce?: boolean;
  stunnedForTurns?: number;
  hasBall?: boolean; // ⚽ does this monster currently have the ball?

  // Visual info
  displayName?: string;
  realPlayerName?: string;
  club?: string;
  rarity?: string;
  evolutionLevel?: number;
  artUrl?: string;
  hoverArtUrl?: string;
  setCode?: string;
  editionType?: string;
  serialNumber?: number;
  editionLabel?: string;
};

type SpellEffectType =
  | "DAMAGE_HERO"
  | "HEAL_HERO"
  | "SHIELD_HERO"
  | "FORWARD_STUN"
  | "DRAW_CARDS"
  | "STEALTH_MINION"
  | "KILL_MINION";

type BattleSpellCard = {
  id: string;
  kind: "SPELL";
  name: string;
  description: string;
  manaCost: number;
  effect: SpellEffectType;
  value: number; // damage / heal / armor / turns stunned / cards drawn
  artUrl?: string;
};

type BattleCard = BattleMonsterCard | BattleSpellCard;

type HeroState = {
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  artUrl?: string;
};

type PlayerKey = "player" | "opponent";

type PlayerState = {
  key: PlayerKey;
  label: string;
  deck: BattleCard[];
  hand: BattleCard[];
  board: BattleMonsterCard[];
  hero: HeroState;
  mana: number;
  maxMana: number;
};

type BattleState = {
  player: PlayerState;
  opponent: PlayerState;
  active: PlayerKey;
  turn: number;
  winner: PlayerKey | "DRAW" | null;
  log: string[];
  ballAtCenter: boolean; // ⚽ true if ball is in the middle of the pitch
};

// ---- PvP queue types ----

type QueueStatus = "IDLE" | "QUEUED" | "MATCHED";

type QueueResponse =
  | { status: "QUEUED" }
  | { status: "IDLE" }
  | { status: "MATCHED"; matchId: string };

// ---- Constants ----

// 60-second turns in single-player mode
const TURN_DURATION = 60; // seconds per turn

// XI rules: 1 GK hero + 10 outfield cards
const TOTAL_XI = 11;
const OUTFIELD_REQUIRED = 10;

// Hero power: 3 mana → draw 2 cards
const HERO_POWER_COST = 3;
const HERO_POWER_DRAW = 2;

// Passing: 1 mana
const PASS_MANA_COST = 1;

// Rewards (single-player)
const SINGLE_WIN_COINS = 200;
const SINGLE_DRAW_COINS = 100;
const SINGLE_DAILY_COIN_CAP = 3000;

// ---- SFX (place files in /public/sfx/...) ----

type SfxKey =
  | "deployDEF"
  | "deployMID"
  | "deployFWD"
  | "attackMID"
  | "attackFWD"
  | "shootGK"
  | "death"
  | "pass"
  | "spell"
  | "heroPower"
  | "uiClick";

const SFX_PATHS: Record<SfxKey, string> = {
  deployDEF: "/sfx/deploy-def.mp3",
  deployMID: "/sfx/deploy-mid.mp3",
  deployFWD: "/sfx/deploy-fwd.mp3",
  attackMID: "/sfx/attack-mid.mp3",
  attackFWD: "/sfx/attack-fwd.mp3",
  shootGK: "/sfx/shoot-gk.mp3",
  death: "/sfx/death.mp3",
  pass: "/sfx/pass.mp3",
  spell: "/sfx/spell.mp3",
  heroPower: "/sfx/hero-power.mp3",
  uiClick: "/sfx/click.mp3",
};

const MUSIC_PATH = "/sfx/battle-music.mp3";

// ---- Small helpers ----

function safeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRarity(r: string): RarityTier {
  const upper = (r || "").toUpperCase().trim();
  if (upper.includes("MYTH")) return "MYTHIC";
  if (upper.includes("LEGEND")) return "LEGENDARY";
  if (upper.includes("EPIC")) return "EPIC";
  if (upper.includes("RARE")) return "RARE";
  return "COMMON";
}

function manaFromRarity(tier: RarityTier): number {
  switch (tier) {
    case "COMMON":
      return 1;
    case "RARE":
      return 2;
    case "EPIC":
      return 3;
    case "LEGENDARY":
      return 4;
    case "MYTHIC":
      return 5;
  }
}

function getArtUrlForMonster(m: UserMonsterDTO): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) return `/cards/base/${m.templateCode}.png`;
  return "/cards/base/test.png";
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function ratingForMonster(m: UserMonsterDTO): number {
  return m.baseAttack + m.baseMagic + m.baseDefense + m.evolutionLevel * 2;
}

function anyCardHasBall(state: BattleState): boolean {
  return (
    state.player.board.some((m) => m.hasBall) ||
    state.opponent.board.some((m) => m.hasBall)
  );
}

function hasKeyword(card: BattleMonsterCard, kw: Keyword): boolean {
  return card.keywords.includes(kw);
}

function addKeyword(card: BattleMonsterCard, kw: Keyword): BattleMonsterCard {
  if (card.keywords.includes(kw)) return card;
  return { ...card, keywords: [...card.keywords, kw] };
}

function removeKeyword(card: BattleMonsterCard, kw: Keyword): BattleMonsterCard {
  if (!card.keywords.includes(kw)) return card;
  return { ...card, keywords: card.keywords.filter((k) => k !== kw) };
}

function clearBallOnBoard(board: BattleMonsterCard[]): BattleMonsterCard[] {
  return board.map((m) => ({ ...m, hasBall: false }));
}

function setBallOnBoard(
  board: BattleMonsterCard[],
  indexWithBall: number
): BattleMonsterCard[] {
  return board.map((m, idx) => ({ ...m, hasBall: idx === indexWithBall }));
}

/**
 * ✅ NEW: Power curve boost for higher mana cost / rarity cards.
 * Higher mana = stronger in BOTH attack and health.
 * (Common stays baseline; Rare+ get progressively larger boosts.)
 */
function boostStatsForManaCost(
  attack: number,
  health: number,
  manaCost: number
): { attack: number; health: number } {
  // Tuned, simple curve that keeps lower costs relevant while rewarding higher costs.
  // You can tweak these numbers later without touching engine logic.
  const table: Record<number, { atk: number; hp: number }> = {
    1: { atk: 0, hp: 0 }, // COMMON
    2: { atk: 1, hp: 2 }, // RARE
    3: { atk: 2, hp: 4 }, // EPIC
    4: { atk: 3, hp: 6 }, // LEGENDARY
    5: { atk: 4, hp: 8 }, // MYTHIC
  };

  const bump = table[manaCost] ?? { atk: 0, hp: 0 };
  return {
    attack: attack + bump.atk,
    health: health + bump.hp,
  };
}

/**
 * ✅ NEW: Normalize ball state so it can NEVER "disappear".
 * Rules:
 * - If ballAtCenter === true → nobody has the ball.
 * - If ballAtCenter === false → exactly ONE monster on the pitch has the ball.
 *   - If none have it: randomly assign to any monster on the pitch (across both sides).
 *   - If multiple have it: keep one, clear the rest.
 * - If there are no monsters on the pitch: ball returns to center.
 */
function normalizeBallState(
  ballAtCenter: boolean,
  playerBoard: BattleMonsterCard[],
  opponentBoard: BattleMonsterCard[],
  log: string[]
): {
  ballAtCenter: boolean;
  playerBoard: BattleMonsterCard[];
  opponentBoard: BattleMonsterCard[];
  log: string[];
} {
  // If the ball is at center, nobody should have it.
  if (ballAtCenter) {
    const any =
      playerBoard.some((m) => m.hasBall) ||
      opponentBoard.some((m) => m.hasBall);
    if (!any) {
      return { ballAtCenter, playerBoard, opponentBoard, log };
    }
    return {
      ballAtCenter: true,
      playerBoard: clearBallOnBoard(playerBoard),
      opponentBoard: clearBallOnBoard(opponentBoard),
      log: [...log],
    };
  }

  const holders: Array<{ owner: PlayerKey; idx: number; name: string }> = [];
  playerBoard.forEach((m, idx) => {
    if (m.hasBall) holders.push({ owner: "player", idx, name: m.name });
  });
  opponentBoard.forEach((m, idx) => {
    if (m.hasBall) holders.push({ owner: "opponent", idx, name: m.name });
  });

  // If exactly one holder exists, we're good.
  if (holders.length === 1) {
    return { ballAtCenter: false, playerBoard, opponentBoard, log };
  }

  // Clear everything first
  let nextPlayer = clearBallOnBoard(playerBoard);
  let nextOpponent = clearBallOnBoard(opponentBoard);

  // If multiple holders, keep one (first) and clear the rest
  if (holders.length > 1) {
    const keep = holders[0];
    if (keep.owner === "player") {
      nextPlayer = setBallOnBoard(nextPlayer, keep.idx);
    } else {
      nextOpponent = setBallOnBoard(nextOpponent, keep.idx);
    }
    const nextLog = [
      ...log,
      `Ball state normalized: ${keep.name} is the only ball-holder.`,
    ];
    return {
      ballAtCenter: false,
      playerBoard: nextPlayer,
      opponentBoard: nextOpponent,
      log: nextLog,
    };
  }

  // holders.length === 0 → ball would "disappear" unless we assign it
  const total = nextPlayer.length + nextOpponent.length;

  if (total === 0) {
    const nextLog = [...log, "The ball returns to the center of the pitch."];
    return {
      ballAtCenter: true,
      playerBoard: nextPlayer,
      opponentBoard: nextOpponent,
      log: nextLog,
    };
  }

  const roll = Math.floor(Math.random() * total);
  if (roll < nextPlayer.length) {
    const receiver = nextPlayer[roll];
    nextPlayer = setBallOnBoard(nextPlayer, roll);
    const nextLog = [...log, `${receiver.name} grabs the loose ball.`];
    return {
      ballAtCenter: false,
      playerBoard: nextPlayer,
      opponentBoard: nextOpponent,
      log: nextLog,
    };
  } else {
    const idx = roll - nextPlayer.length;
    const receiver = nextOpponent[idx];
    nextOpponent = setBallOnBoard(nextOpponent, idx);
    const nextLog = [...log, `${receiver.name} grabs the loose ball.`];
    return {
      ballAtCenter: false,
      playerBoard: nextPlayer,
      opponentBoard: nextOpponent,
      log: nextLog,
    };
  }
}

// ---- Build battle cards from your monsters ----

function buildMonsterCard(m: UserMonsterDTO): BattleMonsterCard {
  const rarityTier = normalizeRarity(m.rarity);
  const manaCost = manaFromRarity(rarityTier);
  const baseStats = ratingForMonster(m);

  let attack =
    m.baseAttack +
    Math.floor(m.evolutionLevel / 2) +
    (rarityTier === "LEGENDARY" || rarityTier === "MYTHIC" ? 1 : 0);

  let health =
    m.baseDefense +
    5 +
    Math.floor(m.evolutionLevel / 2) +
    (rarityTier === "MYTHIC" ? 3 : 0);

  // ✅ NEW: Boost higher-mana (rare/epic/legendary/mythic) stats
  {
    const boosted = boostStatsForManaCost(attack, health, manaCost);
    attack = boosted.attack;
    health = boosted.health;
  }

  const magic = m.baseMagic;

  const keywords: Keyword[] = [];
  if (m.position === "DEF") {
    // Defenders act as a wall; keep TAUNT keyword for rules that care.
    keywords.push("TAUNT");
  }
  if (m.position === "FWD") {
    if (m.baseAttack >= 8 || baseStats >= 20) {
      keywords.push("RUSH");
    }
  }

  const artUrl = getArtUrlForMonster(m);

  return {
    id: safeId("card"),
    kind: "MONSTER",
    sourceMonsterId: m.id,
    name: m.displayName,
    position: m.position as Position,
    rarityTier,
    manaCost,
    attack,
    health,
    maxHealth: health,
    magic,
    keywords,
    hasSummoningSickness: true,
    canAttack: false,
    stunnedForTurns: 0,
    hasBall: false, // default, ball starts in center

    displayName: m.displayName,
    realPlayerName: m.realPlayerName,
    club: m.club,
    rarity: m.rarity,
    evolutionLevel: m.evolutionLevel,
    artUrl,
    hoverArtUrl: undefined,
    setCode: m.setCode ?? undefined,
    editionType: m.editionType ?? undefined,
    serialNumber: m.serialNumber ?? undefined,
    editionLabel: m.editionLabel ?? undefined,
  };
}

function buildHeroFromGK(gk: UserMonsterDTO): HeroState {
  // ✅ CHANGED: GK health lowered to 250
  const baseHp = 250;
  return {
    name: gk.displayName || gk.realPlayerName,
    hp: baseHp,
    maxHp: baseHp,
    armor: 0,
    artUrl: getArtUrlForMonster(gk),
  };
}

/**
 * SPELL ART:
 * Place PNGs like:
 *  /public/cards/spells/power-shot.png
 *  /public/cards/spells/rooted-shield.png
 *  /public/cards/spells/tackle-forward.png
 * etc.
 * These paths are referenced below in artUrl.
 */

function createSpellCards(): BattleSpellCard[] {
  const base: Omit<BattleSpellCard, "id">[] = [
    // 2 mana – big GK damage
    {
      kind: "SPELL",
      name: "Power Shot",
      description: "Deal 25 damage directly to the opponent’s Goalkeeper.",
      manaCost: 2,
      effect: "DAMAGE_HERO",
      value: 25,
      artUrl: "/cards/spells/power-shot.png",
    },
    // 3 mana – GK heal
    {
      kind: "SPELL",
      name: "Rooted Shield",
      description: "Your Goalkeeper restores 30 health (up to their max HP).",
      manaCost: 3,
      effect: "HEAL_HERO",
      value: 30,
      artUrl: "/cards/spells/rooted-shield.png",
    },
    // 3 mana – stun a forward (in code we pick an enemy FWD)
    {
      kind: "SPELL",
      name: "Tackle Forward",
      description:
        "Pick off an opponent’s Forward – it can’t attack on its next turn.",
      manaCost: 3,
      effect: "FORWARD_STUN",
      value: 1, // 1 turn of stun
      artUrl: "/cards/spells/tackle-forward.png",
    },
    // More GK damage variants
    {
      kind: "SPELL",
      name: "Long Range Strike",
      description:
        "A thunderbolt from distance. Deal 35 damage to the opponent’s Goalkeeper.",
      manaCost: 3,
      effect: "DAMAGE_HERO",
      value: 35,
      artUrl: "/cards/spells/long-range-strike.png",
    },
    {
      kind: "SPELL",
      name: "Overload Shot",
      description:
        "Channel everything into one hit. Deal 45 damage to the opponent’s Goalkeeper.",
      manaCost: 4,
      effect: "DAMAGE_HERO",
      value: 45,
      artUrl: "/cards/spells/overload-shot.png",
    },
    // Armor / shield variants
    {
      kind: "SPELL",
      name: "Iron Wall",
      description: "Reinforce your Goalkeeper. Gain 25 armor on your Goalkeeper.",
      manaCost: 3,
      effect: "SHIELD_HERO",
      value: 25,
      artUrl: "/cards/spells/iron-wall.png",
    },
    {
      kind: "SPELL",
      name: "Double Save",
      description:
        "Back-to-back reflex saves. Gain 15 armor and heal 10 health on your Goalkeeper.",
      manaCost: 3,
      effect: "SHIELD_HERO",
      value: 25, // we split in code as 15 armor + 10 heal
      artUrl: "/cards/spells/double-save.png",
    },
    {
      kind: "SPELL",
      name: "Miracle Hands",
      description: "A miracle stop. Heal 40 health on your Goalkeeper.",
      manaCost: 4,
      effect: "HEAL_HERO",
      value: 40,
      artUrl: "/cards/spells/miracle-hands.png",
    },
    // Draw spells
    {
      kind: "SPELL",
      name: "Fan Momentum",
      description: "The crowd roars you on. Draw 1 extra card.",
      manaCost: 2,
      effect: "DRAW_CARDS",
      value: 1,
      artUrl: "/cards/spells/fan-momentum.png",
    },
    {
      kind: "SPELL",
      name: "Tactical Insight",
      description: "Study the pitch. Draw 2 extra cards.",
      manaCost: 3,
      effect: "DRAW_CARDS",
      value: 2,
      artUrl: "/cards/spells/tactical-insight.png",
    },
    {
      kind: "SPELL",
      name: "Coach’s Whisper",
      description: "A clutch sideline tweak. Draw 3 cards.",
      manaCost: 4,
      effect: "DRAW_CARDS",
      value: 3,
      artUrl: "/cards/spells/coachs-whisper.png",
    },

    // ✅ NEW: STEALTH (replaces "Quick Bandage" but keeps the same artwork)
    {
      kind: "SPELL",
      name: "Stealth",
      description:
        "Give a chosen Midfielder or Forward Stealth. It can’t be attacked until it attacks.",
      manaCost: 3,
      effect: "STEALTH_MINION",
      value: 0,
      artUrl: "/cards/spells/quick-bandage.png",
    },

    // Small buffs / sustain
    {
      kind: "SPELL",
      name: "Last-Minute Surge",
      description:
        "Late-game push. Heal 20 HP and gain 10 armor on your Goalkeeper.",
      manaCost: 4,
      effect: "SHIELD_HERO",
      value: 30, // 20 heal + 10 armor
      artUrl: "/cards/spells/last-minute-surge.png",
    },

    // ✅ NEW: KILL A MONSTER (replaces "Crowd Shield" but keeps the same artwork)
    {
      kind: "SPELL",
      name: "Red Card",
      description: "Destroy a chosen monster on the pitch.",
      manaCost: 5,
      effect: "KILL_MINION",
      value: 0,
      artUrl: "/cards/spells/crowd-shield.png",
    },
  ];

  // We want 9 random spells per deck (duplicates allowed).
  const spells: BattleSpellCard[] = [];
  while (spells.length < 9) {
    const pick = base[Math.floor(Math.random() * base.length)];
    spells.push({ ...pick, id: safeId("spell") });
  }
  return spells;
}

// ---- Formation auto-pick ----

type Formation = {
  id: string;
  label: string;
  def: number;
  mid: number;
  fwd: number;
};

const FORMATIONS: Formation[] = [
  { id: "4-4-2", label: "4-4-2", def: 4, mid: 4, fwd: 2 },
  { id: "4-3-3", label: "4-3-3", def: 4, mid: 3, fwd: 3 },
  { id: "3-5-2", label: "3-5-2", def: 3, mid: 5, fwd: 2 },
  { id: "3-4-3", label: "3-4-3", def: 3, mid: 4, fwd: 3 },
  { id: "4-2-3-1", label: "4-2-3-1", def: 4, mid: 5, fwd: 1 },
  { id: "4-1-4-1", label: "4-1-4-1", def: 4, mid: 5, fwd: 1 },
  { id: "5-3-2", label: "5-3-2", def: 5, mid: 3, fwd: 2 },
  { id: "5-4-1", label: "5-4-1", def: 5, mid: 4, fwd: 1 },
  { id: "4-5-1", label: "4-5-1", def: 4, mid: 5, fwd: 1 },
  { id: "4-2-4", label: "4-2-4", def: 4, mid: 2, fwd: 4 },
];

function autoPickForFormation(
  collection: UserMonsterDTO[],
  formation: Formation
): { deckIds: string[]; heroId: string | null } {
  // Best GK as hero
  const gks = collection
    .filter((m) => m.position === "GK")
    .sort((a, b) => ratingForMonster(b) - ratingForMonster(a));
  const hero = gks[0] ?? null;

  const outfieldPool = collection.filter(
    (m) => m.id !== hero?.id && m.position !== "GK"
  );

  const byPos = (pos: Position) =>
    outfieldPool
      .filter((m) => m.position === pos)
      .sort((a, b) => ratingForMonster(b) - ratingForMonster(a));

  const chosenIds: string[] = [];

  const addTop = (list: UserMonsterDTO[], count: number) => {
    for (const m of list) {
      if (chosenIds.length >= OUTFIELD_REQUIRED) break;
      if (chosenIds.includes(m.id)) continue;
      if (count <= 0) break;
      chosenIds.push(m.id);
      count--;
    }
  };

  addTop(byPos("DEF"), formation.def);
  addTop(byPos("MID"), formation.mid);
  addTop(byPos("FWD"), formation.fwd);

  // If we're still short of 10 outfield, fill with best remaining
  if (chosenIds.length < OUTFIELD_REQUIRED) {
    const remaining = outfieldPool
      .filter((m) => !chosenIds.includes(m.id))
      .sort((a, b) => ratingForMonster(b) - ratingForMonster(a));
    for (const m of remaining) {
      if (chosenIds.length >= OUTFIELD_REQUIRED) break;
      chosenIds.push(m.id);
    }
  }

  return {
    deckIds: chosenIds.slice(0, OUTFIELD_REQUIRED),
    heroId: hero ? hero.id : null,
  };
}

// ---- Battle engine helpers ----

function drawCard(p: PlayerState): PlayerState {
  if (p.deck.length === 0) return p;
  const [top, ...rest] = p.deck;
  return {
    ...p,
    deck: rest,
    hand: [...p.hand, top],
  };
}

function startTurn(p: PlayerState, turn: number): PlayerState {
  const maxMana = Math.min(10, turn);
  const mana = maxMana;

  const board = p.board.map((m) => {
    // remove summoning sickness at the start of your turn
    let hasSummoningSickness = m.hasSummoningSickness;
    if (hasSummoningSickness) {
      hasSummoningSickness = false;
    }

    // decrement stun duration
    let stunnedForTurns = m.stunnedForTurns ?? 0;
    if (stunnedForTurns > 0) {
      stunnedForTurns -= 1;
    }

    const canAttack =
      m.position !== "DEF" && !hasSummoningSickness && stunnedForTurns === 0;

    return {
      ...m,
      hasSummoningSickness,
      stunnedForTurns,
      canAttack,
    };
  });

  const withDraw = drawCard({
    ...p,
    maxMana,
    mana,
    board,
  });

  return withDraw;
}

function endTurnSwitchActive(state: BattleState): BattleState {
  const next: PlayerKey = state.active === "player" ? "opponent" : "player";
  return {
    ...state,
    active: next,
    turn: state.turn + (next === "player" ? 1 : 0),
  };
}

function findDefenderIndices(board: BattleMonsterCard[]): number[] {
  const indices: number[] = [];
  board.forEach((m, idx) => {
    if (m.position === "DEF") indices.push(idx);
  });
  return indices;
}

function resolveBallAfterRemoval(
  state: BattleState,
  _removedOwner: PlayerKey,
  removedHadBall: boolean,
  nextPlayerBoard: BattleMonsterCard[],
  nextOpponentBoard: BattleMonsterCard[],
  log: string[]
): {
  ballAtCenter: boolean;
  playerBoard: BattleMonsterCard[];
  opponentBoard: BattleMonsterCard[];
  log: string[];
} {
  if (!removedHadBall) {
    // still normalize (cheap safety), but keep center flag as-is
    const normalized = normalizeBallState(
      state.ballAtCenter,
      nextPlayerBoard,
      nextOpponentBoard,
      log
    );
    return normalized;
  }

  // Ball becomes loose: clear it and re-assign randomly across the pitch.
  const clearedPlayer = clearBallOnBoard(nextPlayerBoard);
  const clearedOpponent = clearBallOnBoard(nextOpponentBoard);

  const normalized = normalizeBallState(false, clearedPlayer, clearedOpponent, [
    ...log,
    "The ball pops loose!",
  ]);

  return normalized;
}

// *** Simplified + safer attack logic ***
// ⚽ updated to include ball transfer rules + Stealth
function applyAttack(
  state: BattleState,
  attackerOwner: PlayerKey,
  attackerIndex: number,
  targetType: "HERO" | "MINION",
  targetIndex?: number
): BattleState {
  if (state.winner) return state;

  const attackerPlayer =
    attackerOwner === "player" ? state.player : state.opponent;
  const defenderPlayer =
    attackerOwner === "player" ? state.opponent : state.player;

  if (!attackerPlayer.board[attackerIndex]) return state;

  let attacker = attackerPlayer.board[attackerIndex];

  if (!attacker.canAttack) return state;

  let newAttackerBoard = [...attackerPlayer.board];
  let newDefenderBoard = [...defenderPlayer.board];
  let newAttackerHero = { ...attackerPlayer.hero };
  let newDefenderHero = { ...defenderPlayer.hero };
  let log = [...state.log];

  let nextBallAtCenter = state.ballAtCenter;

  const defenderIndices = findDefenderIndices(defenderPlayer.board);
  const hasDefenders = defenderIndices.length > 0;

  // If attacker is stealthed and performs an attack, stealth breaks.
  const attackerHadStealth = hasKeyword(attacker, "STEALTH");

  if (targetType === "HERO") {
    // Only the monster with the ball can shoot the Goalkeeper
    if (!attacker.hasBall) {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} tried to shoot the Goalkeeper but does not have the ball.`
      );
      return {
        ...state,
        log,
      };
    }

    // If defenders are in play, you CANNOT hit the Goalkeeper.
    if (hasDefenders) {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} tried to attack the Goalkeeper, but defenders are still in play and must be cleared first.`
      );
      return {
        ...state,
        log,
      };
    }

    // Simple hero-shot logic: attacker damages GK, no defender retaliation.
    let remainingDamage = attacker.attack;

    if (newDefenderHero.armor > 0) {
      const absorbed = Math.min(newDefenderHero.armor, remainingDamage);
      newDefenderHero.armor -= absorbed;
      remainingDamage -= absorbed;
    }
    if (remainingDamage > 0) {
      newDefenderHero.hp -= remainingDamage;
    }

    log.push(
      `${attackerPlayer.label}'s ${attacker.name} hit ${defenderPlayer.label}'s GK for ${attacker.attack} damage`
    );

    // Midfielder attacking the Goalkeeper deals damage but is killed,
    // and if they had the ball it goes to a random monster on the defender's team.
    if (attacker.position === "MID") {
      const midfielderHadBall = !!attacker.hasBall;

      log.push(
        `${attackerPlayer.label}'s ${attacker.name} is a Midfielder and is removed from play after the shot.`
      );

      // Remove the MID from the attacker board
      newAttackerBoard.splice(attackerIndex, 1);

      if (midfielderHadBall) {
        // Ball becomes loose: normalize will assign to a random monster on the pitch (not GK).
        nextBallAtCenter = false;
        newAttackerBoard = clearBallOnBoard(newAttackerBoard);
        newDefenderBoard = clearBallOnBoard(newDefenderBoard);
        log.push("The rebound spills into open play!");
      }
    } else if (attacker.bypassDefendersOnce) {
      attacker = {
        ...attacker,
        bypassDefendersOnce: false,
      };
    }

    // Break stealth after attacking (if attacker still exists)
    if (attackerHadStealth) {
      attacker = removeKeyword(attacker, "STEALTH");
    }
  } else if (
    targetType === "MINION" &&
    typeof targetIndex === "number" &&
    defenderPlayer.board[targetIndex]
  ) {
    const target = defenderPlayer.board[targetIndex];

    // Stealth targets can't be attacked
    if (hasKeyword(target, "STEALTH")) {
      log.push(
        `${attackerPlayer.label} tried to attack ${defenderPlayer.label}'s ${target.name}, but it is in Stealth.`
      );
      return {
        ...state,
        log,
      };
    }

    // If defenders exist, you MUST attack a defender.
    if (hasDefenders && target.position !== "DEF") {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} must attack a defender while any defenders are on the pitch.`
      );
      return {
        ...state,
        log,
      };
    }

    // Minion vs minion trade (with special FWD vs Taunt rule)
    let newAttacker = { ...attacker };
    let newTarget = { ...target };

    const attackerIsForward = attacker.position === "FWD";
    const targetHasTaunt = target.keywords.includes("TAUNT");

    newTarget.health -= attacker.attack;

    // Forwards hitting Taunt don't take return damage
    if (!(attackerIsForward && targetHasTaunt)) {
      newAttacker.health -= target.attack;
    } else {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} is a Forward and takes no damage from the Taunt defender.`
      );
    }

    log.push(
      `${attackerPlayer.label}'s ${attacker.name} traded with ${defenderPlayer.label}'s ${target.name}`
    );

    const attackerHadBall = !!attacker.hasBall;
    const targetHadBall = !!target.hasBall;

    const attackerDies = newAttacker.health <= 0;
    const targetDies = newTarget.health <= 0;

    // Break stealth if attacker performed an attack and survives
    if (attackerHadStealth && !attackerDies) {
      newAttacker = removeKeyword(newAttacker, "STEALTH");
    }

    // Apply health/death to boards
    if (targetDies) {
      newDefenderBoard.splice(targetIndex, 1);
    } else {
      newDefenderBoard[targetIndex] = {
        ...newTarget,
      };
    }

    if (attackerDies) {
      newAttackerBoard.splice(attackerIndex, 1);
    } else {
      newAttacker.canAttack = false;
      newAttackerBoard[attackerIndex] = {
        ...newAttacker,
      };
      attacker = newAttacker;
    }

    // ⚽ Ball transfer logic for minion combat
    // ✅ FIX: If BOTH die and the ball was involved, it becomes "loose" and MUST be re-assigned
    // to a random monster on the pitch (not GK). If nobody is on the pitch, it goes to center.
    if (targetHadBall) {
      if (attackerDies && !targetDies) {
        // Target survives and had the ball: keep it
        if (!targetDies && newDefenderBoard[targetIndex]) {
          const updated = newDefenderBoard[targetIndex];
          newDefenderBoard[targetIndex] = { ...updated, hasBall: true };
        }
        newAttackerBoard = newAttackerBoard.map((c) => ({
          ...c,
          hasBall: false,
        }));
        nextBallAtCenter = false;
      } else if (!attackerDies && targetDies) {
        // Attacker survives, gains the ball
        const updatedIndex = newAttackerBoard.findIndex(
          (c) => c.id === attacker.id
        );
        if (updatedIndex >= 0) {
          newAttackerBoard = newAttackerBoard.map((c, idx) => ({
            ...c,
            hasBall: idx === updatedIndex,
          }));
          newDefenderBoard = newDefenderBoard.map((c) => ({
            ...c,
            hasBall: false,
          }));
        }
        nextBallAtCenter = false;
      } else if (attackerDies && targetDies) {
        // ✅ BOTH DIE with ball involved → ball becomes loose (random across pitch via normalization)
        newAttackerBoard = clearBallOnBoard(newAttackerBoard);
        newDefenderBoard = clearBallOnBoard(newDefenderBoard);
        nextBallAtCenter = false;
        log.push("Both monsters go down — the ball pops loose!");
      }
    } else if (attackerHadBall) {
      if (attackerDies && !targetDies) {
        // Attacker dies, target survives: target takes the ball
        if (!targetDies && newDefenderBoard[targetIndex]) {
          const updated = newDefenderBoard[targetIndex];
          newDefenderBoard[targetIndex] = { ...updated, hasBall: true };
        }
        newAttackerBoard = newAttackerBoard.map((c) => ({
          ...c,
          hasBall: false,
        }));
        nextBallAtCenter = false;
      } else if (!attackerDies) {
        // Attacker survives, keeps the ball
        const updatedIndex = newAttackerBoard.findIndex(
          (c) => c.id === attacker.id
        );
        if (updatedIndex >= 0) {
          newAttackerBoard = newAttackerBoard.map((c, idx) => ({
            ...c,
            hasBall: idx === updatedIndex,
          }));
          newDefenderBoard = newDefenderBoard.map((c) => ({
            ...c,
            hasBall: false,
          }));
        }
        nextBallAtCenter = false;
      } else if (attackerDies && targetDies) {
        // ✅ BOTH DIE with ball involved → ball becomes loose (random across pitch via normalization)
        newAttackerBoard = clearBallOnBoard(newAttackerBoard);
        newDefenderBoard = clearBallOnBoard(newDefenderBoard);
        nextBallAtCenter = false;
        log.push("Both monsters go down — the ball pops loose!");
      }
    }
  }

  // Mark attacker as used if still alive on board
  const updatedAttackerIndex = newAttackerBoard.findIndex(
    (c) => c.id === attacker.id
  );
  if (updatedAttackerIndex >= 0) {
    newAttackerBoard[updatedAttackerIndex] = {
      ...attacker,
      canAttack: false,
    };
  }

  const updatedAttackerPlayer: PlayerState = {
    ...attackerPlayer,
    board: newAttackerBoard,
    hero: newAttackerHero,
  };

  const updatedDefenderPlayer: PlayerState = {
    ...defenderPlayer,
    board: newDefenderBoard,
    hero: newDefenderHero,
  };

  let next: BattleState = {
    ...state,
    player:
      attackerOwner === "player" ? updatedAttackerPlayer : updatedDefenderPlayer,
    opponent:
      attackerOwner === "player" ? updatedDefenderPlayer : updatedAttackerPlayer,
    log,
    ballAtCenter: nextBallAtCenter,
  };

  // ✅ FINAL SAFETY: normalize ball state so it can never disappear.
  {
    const normalized = normalizeBallState(
      next.ballAtCenter,
      next.player.board,
      next.opponent.board,
      next.log
    );
    next = {
      ...next,
      ballAtCenter: normalized.ballAtCenter,
      player: { ...next.player, board: normalized.playerBoard },
      opponent: { ...next.opponent, board: normalized.opponentBoard },
      log: normalized.log,
    };
  }

  if (next.player.hero.hp <= 0 && next.opponent.hero.hp <= 0) {
    next = { ...next, winner: "DRAW" };
  } else if (next.player.hero.hp <= 0) {
    next = { ...next, winner: "opponent" };
  } else if (next.opponent.hero.hp <= 0) {
    next = { ...next, winner: "player" };
  }

  return next;
}

// ⚽ Helper to give the ball to a specific monster by id + owner
function giveBallToMonster(
  state: BattleState,
  owner: PlayerKey,
  monsterId: string,
  logMessage?: string
): BattleState {
  const log = logMessage ? [...state.log, logMessage] : state.log;

  const newPlayerBoard =
    owner === "player"
      ? state.player.board.map((m) =>
          m.id === monsterId
            ? { ...m, hasBall: true }
            : { ...m, hasBall: false }
        )
      : state.player.board.map((m) => ({ ...m, hasBall: false }));

  const newOpponentBoard =
    owner === "opponent"
      ? state.opponent.board.map((m) =>
          m.id === monsterId
            ? { ...m, hasBall: true }
            : { ...m, hasBall: false }
        )
      : state.opponent.board.map((m) => ({ ...m, hasBall: false }));

  return {
    ...state,
    player: { ...state.player, board: newPlayerBoard },
    opponent: { ...state.opponent, board: newOpponentBoard },
    ballAtCenter: false,
    log,
  };
}

function playTargetedSpellFromHand(
  state: BattleState,
  playerKey: PlayerKey,
  handIndex: number,
  targetOwner: PlayerKey,
  targetIndex: number
): BattleState {
  if (state.winner) return state;

  const acting = playerKey === "player" ? state.player : state.opponent;
  const other = playerKey === "player" ? state.opponent : state.player;

  const card = acting.hand[handIndex];
  if (!card || card.kind !== "SPELL") return state;
  if (card.manaCost > acting.mana) return state;

  let newActing: PlayerState = { ...acting };
  let newOther: PlayerState = { ...other };
  let log = [...state.log];

  // Validate targets
  if (card.effect === "STEALTH_MINION") {
    if (targetOwner !== playerKey) {
      log.push(`${acting.label} tried to cast ${card.name} on the wrong target.`);
      return { ...state, log };
    }
    const tgt = newActing.board[targetIndex];
    if (!tgt) return { ...state, log };
    if (tgt.position !== "MID" && tgt.position !== "FWD") {
      log.push(`${acting.label} cast ${card.name}, but it only works on MID or FWD.`);
      return { ...state, log };
    }
  } else if (card.effect === "KILL_MINION") {
    const board = targetOwner === playerKey ? newActing.board : newOther.board;
    if (!board[targetIndex]) return { ...state, log };
  } else {
    return state;
  }

  // Spend + remove card
  newActing.hand = newActing.hand.filter((_, idx) => idx !== handIndex);
  newActing.mana -= card.manaCost;

  let nextBallAtCenter = state.ballAtCenter;

  if (card.effect === "STEALTH_MINION") {
    const target = newActing.board[targetIndex];
    const updated = addKeyword(target, "STEALTH");
    newActing.board = [...newActing.board];
    newActing.board[targetIndex] = updated;

    log.push(`${acting.label} cast ${card.name}. ${target.name} enters Stealth.`);
  }

  if (card.effect === "KILL_MINION") {
    const isTargetOnActing = targetOwner === playerKey;
    const victim = isTargetOnActing
      ? newActing.board[targetIndex]
      : newOther.board[targetIndex];

    const victimHadBall = !!victim?.hasBall;

    if (isTargetOnActing) {
      newActing.board = [...newActing.board];
      newActing.board.splice(targetIndex, 1);
    } else {
      newOther.board = [...newOther.board];
      newOther.board.splice(targetIndex, 1);
    }

    log.push(`${acting.label} cast ${card.name} and destroyed ${victim?.name}.`);

    // Ball handling if the victim had it (now randomized across pitch)
    const resolved = resolveBallAfterRemoval(
      state,
      targetOwner,
      victimHadBall,
      playerKey === "player" ? newActing.board : newOther.board,
      playerKey === "player" ? newOther.board : newActing.board,
      log
    );

    nextBallAtCenter = resolved.ballAtCenter;
    log = resolved.log;

    if (playerKey === "player") {
      newActing.board = resolved.playerBoard;
      newOther.board = resolved.opponentBoard;
    } else {
      // swapped ownership
      newOther.board = resolved.playerBoard;
      newActing.board = resolved.opponentBoard;
    }
  }

  const nextState: BattleState =
    playerKey === "player"
      ? {
          ...state,
          player: newActing,
          opponent: newOther,
          log,
          ballAtCenter: nextBallAtCenter,
        }
      : {
          ...state,
          opponent: newActing,
          player: newOther,
          log,
          ballAtCenter: nextBallAtCenter,
        };

  // ✅ Normalize ball state (extra safety)
  const normalized = normalizeBallState(
    nextState.ballAtCenter,
    nextState.player.board,
    nextState.opponent.board,
    nextState.log
  );

  return {
    ...nextState,
    ballAtCenter: normalized.ballAtCenter,
    player: { ...nextState.player, board: normalized.playerBoard },
    opponent: { ...nextState.opponent, board: normalized.opponentBoard },
    log: normalized.log,
  };
}

function playCardFromHand(
  state: BattleState,
  playerKey: PlayerKey,
  handIndex: number
): BattleState {
  if (state.winner) return state;
  const acting = playerKey === "player" ? state.player : state.opponent;
  const other = playerKey === "player" ? state.opponent : state.player;

  const card = acting.hand[handIndex];
  if (!card) return state;
  if (card.manaCost > acting.mana) return state;

  // Global rule: max 3 monsters on board per side
  if (card.kind === "MONSTER" && acting.board.length >= 3) {
    const log = [
      ...state.log,
      `${acting.label} tried to play ${card.name} but already has the maximum 3 monsters on the pitch.`,
    ];
    return {
      ...state,
      log,
    };
  }

  // Forwards can only be played if you already have a MID on board
  if (card.kind === "MONSTER" && card.position === "FWD") {
    const hasMidfielder = acting.board.some((m) => m.position === "MID");
    if (!hasMidfielder) {
      const log = [
        ...state.log,
        `${acting.label} tried to play a Forward but has no Midfielder on the pitch.`,
      ];
      return {
        ...state,
        log,
      };
    }
  }

  let newActing: PlayerState = { ...acting };
  let newOther: PlayerState = { ...other };
  newActing.hand = newActing.hand.filter((_, idx) => idx !== handIndex);
  newActing.mana -= card.manaCost;
  let log = [...state.log];
  let nextBallAtCenter = state.ballAtCenter;

  if (card.kind === "MONSTER") {
    const hasSummoningSickness = !card.keywords.includes("RUSH");
    const canAttack = card.position !== "DEF" && card.keywords.includes("RUSH");

    // First monster to hit the pitch gets the ball if it's still in the center
    const isFirstToBall =
      state.ballAtCenter &&
      !anyCardHasBall(state) &&
      newActing.board.length === 0;

    const monster: BattleMonsterCard = {
      ...card,
      hasSummoningSickness,
      canAttack,
      stunnedForTurns: 0,
      hasBall: isFirstToBall,
    };
    newActing.board = [...newActing.board, monster];

    if (isFirstToBall) {
      nextBallAtCenter = false;
      log.push(
        `${acting.label}'s ${monster.name} takes first touch and gains the ball.`
      );
    } else {
      log.push(`${acting.label} played ${monster.name} (${monster.position})`);
    }
  } else if (card.kind === "SPELL") {
    switch (card.effect) {
      case "DAMAGE_HERO": {
        let targetHero = { ...newOther.hero };
        let remaining = card.value;
        if (targetHero.armor > 0) {
          const absorbed = Math.min(targetHero.armor, remaining);
          targetHero.armor -= absorbed;
          remaining -= absorbed;
        }
        if (remaining > 0) {
          targetHero.hp -= remaining;
        }
        log.push(
          `${acting.label} cast ${card.name} for ${card.value} damage to the Goalkeeper`
        );
        newOther = {
          ...newOther,
          hero: targetHero,
        };
        break;
      }
      case "HEAL_HERO": {
        const healedHp = Math.min(
          newActing.hero.maxHp,
          newActing.hero.hp + card.value
        );
        newActing = {
          ...newActing,
          hero: { ...newActing.hero, hp: healedHp },
        };
        log.push(
          `${acting.label} cast ${card.name} and healed ${card.value} HP on their Goalkeeper`
        );
        break;
      }
      case "SHIELD_HERO": {
        // For SHIELD_HERO we treat value as a mix of armor and heal depending on magnitude
        const armorGain = Math.floor(card.value * 0.6);
        const healGain = card.value - armorGain;
        const healedHp = Math.min(
          newActing.hero.maxHp,
          newActing.hero.hp + healGain
        );
        newActing = {
          ...newActing,
          hero: {
            ...newActing.hero,
            hp: healedHp,
            armor: newActing.hero.armor + armorGain,
          },
        };
        log.push(
          `${acting.label} cast ${card.name}, gaining ${armorGain} armor and healing ${healGain} HP on their Goalkeeper`
        );
        break;
      }
      case "FORWARD_STUN": {
        const forwards = newOther.board
          .map((m, idx) => ({ m, idx }))
          .filter(({ m }) => m.position === "FWD");
        if (forwards.length === 0) {
          log.push(
            `${acting.label} cast ${card.name} but there were no enemy Forwards to tackle.`
          );
        } else {
          // Pick the highest-attack Forward as the "selected" one
          forwards.sort((a, b) => b.m.attack - a.m.attack);
          const targetInfo = forwards[0];
          const targetIdx = targetInfo.idx;
          const target = { ...newOther.board[targetIdx] };
          const currentStun = target.stunnedForTurns ?? 0;
          target.stunnedForTurns = currentStun + card.value;
          target.canAttack = false;
          newOther.board = [...newOther.board];
          newOther.board[targetIdx] = target;

          log.push(
            `${acting.label} cast ${card.name}, stunning ${other.label}'s ${target.name} for the next turn.`
          );
        }
        break;
      }
      case "DRAW_CARDS": {
        let tempActing = { ...newActing };
        for (let i = 0; i < card.value; i++) {
          tempActing = drawCard(tempActing);
        }
        newActing = tempActing;
        log.push(
          `${acting.label} cast ${card.name} and drew ${card.value} extra card(s)`
        );
        break;
      }

      // ✅ NEW (AI-safe): if this path is hit (opponent AI), auto-target.
      case "STEALTH_MINION": {
        const candidates = newActing.board
          .map((m, idx) => ({ m, idx }))
          .filter(({ m }) => m.position === "MID" || m.position === "FWD");

        if (candidates.length === 0) {
          log.push(
            `${acting.label} cast ${card.name}, but had no MID/FWD to put into Stealth.`
          );
        } else {
          // Prefer ball-holder, else highest attack
          const ballIdx = newActing.board.findIndex((m) => m.hasBall);
          let chosenIdx = candidates[0].idx;
          if (ballIdx >= 0) {
            const ballCandidate = candidates.find((c) => c.idx === ballIdx);
            if (ballCandidate) chosenIdx = ballIdx;
          } else {
            candidates.sort((a, b) => b.m.attack - a.m.attack);
            chosenIdx = candidates[0].idx;
          }

          const target = newActing.board[chosenIdx];
          newActing.board = [...newActing.board];
          newActing.board[chosenIdx] = addKeyword(target, "STEALTH");

          log.push(`${acting.label} cast ${card.name}. ${target.name} enters Stealth.`);
        }
        break;
      }

      case "KILL_MINION": {
        if (newOther.board.length === 0) {
          log.push(
            `${acting.label} cast ${card.name}, but there were no monsters to destroy.`
          );
          break;
        }

        // Prefer killing ball-holder; else highest attack
        const ballIdx = newOther.board.findIndex((m) => m.hasBall);
        let targetIdx = ballIdx >= 0 ? ballIdx : 0;

        if (ballIdx < 0) {
          const ranked = newOther.board
            .map((m, idx) => ({ m, idx, score: m.attack + m.health }))
            .sort((a, b) => b.score - a.score);
          targetIdx = ranked[0].idx;
        }

        const victim = newOther.board[targetIdx];
        const victimHadBall = !!victim.hasBall;

        newOther.board = [...newOther.board];
        newOther.board.splice(targetIdx, 1);

        log.push(`${acting.label} cast ${card.name} and destroyed ${victim.name}.`);

        // Ball handling if victim had ball (random across pitch)
        const resolved = resolveBallAfterRemoval(
          state,
          playerKey === "player" ? "opponent" : "player",
          victimHadBall,
          playerKey === "player" ? newActing.board : newOther.board,
          playerKey === "player" ? newOther.board : newActing.board,
          log
        );

        nextBallAtCenter = resolved.ballAtCenter;
        log = resolved.log;

        if (playerKey === "player") {
          newActing.board = resolved.playerBoard;
          newOther.board = resolved.opponentBoard;
        } else {
          newOther.board = resolved.playerBoard;
          newActing.board = resolved.opponentBoard;
        }

        break;
      }
    }

    // After any spell, check if someone died
    let nextAfterSpell: BattleState =
      playerKey === "player"
        ? {
            ...state,
            player: newActing,
            opponent: newOther,
            log,
            ballAtCenter: nextBallAtCenter,
          }
        : {
            ...state,
            opponent: newActing,
            player: newOther,
            log,
            ballAtCenter: nextBallAtCenter,
          };

    // ✅ Normalize ball state
    {
      const normalized = normalizeBallState(
        nextAfterSpell.ballAtCenter,
        nextAfterSpell.player.board,
        nextAfterSpell.opponent.board,
        nextAfterSpell.log
      );
      nextAfterSpell = {
        ...nextAfterSpell,
        ballAtCenter: normalized.ballAtCenter,
        player: { ...nextAfterSpell.player, board: normalized.playerBoard },
        opponent: { ...nextAfterSpell.opponent, board: normalized.opponentBoard },
        log: normalized.log,
      };
    }

    if (nextAfterSpell.player.hero.hp <= 0 && nextAfterSpell.opponent.hero.hp <= 0) {
      nextAfterSpell = { ...nextAfterSpell, winner: "DRAW" };
    } else if (nextAfterSpell.player.hero.hp <= 0) {
      nextAfterSpell = { ...nextAfterSpell, winner: "opponent" };
    } else if (nextAfterSpell.opponent.hero.hp <= 0) {
      nextAfterSpell = { ...nextAfterSpell, winner: "player" };
    }

    return nextAfterSpell;
  }

  let nextState =
    playerKey === "player"
      ? {
          ...state,
          player: newActing,
          opponent: newOther,
          log,
          ballAtCenter: nextBallAtCenter,
        }
      : {
          ...state,
          opponent: newActing,
          player: newOther,
          log,
          ballAtCenter: nextBallAtCenter,
        };

  // ✅ Normalize ball state
  {
    const normalized = normalizeBallState(
      nextState.ballAtCenter,
      nextState.player.board,
      nextState.opponent.board,
      nextState.log
    );
    nextState = {
      ...nextState,
      ballAtCenter: normalized.ballAtCenter,
      player: { ...nextState.player, board: normalized.playerBoard },
      opponent: { ...nextState.opponent, board: normalized.opponentBoard },
      log: normalized.log,
    };
  }

  return nextState;
}

// ---- Hero Power ----
// 3 mana: draw 2 cards for the acting side.

function useHeroPower(state: BattleState, playerKey: PlayerKey): BattleState {
  if (state.winner) return state;

  const acting = playerKey === "player" ? state.player : state.opponent;
  const other = playerKey === "player" ? state.opponent : state.player;

  if (acting.mana < HERO_POWER_COST) return state;

  let newActing = { ...acting, mana: acting.mana - HERO_POWER_COST };
  for (let i = 0; i < HERO_POWER_DRAW; i++) {
    newActing = drawCard(newActing);
  }

  const log = [
    ...state.log,
    `${acting.label} used their Hero Power and drew ${HERO_POWER_DRAW} cards.`,
  ];

  return playerKey === "player"
    ? { ...state, player: newActing, opponent: other, log }
    : { ...state, opponent: newActing, player: other, log };
}

// ---- AI TURN: fixed to avoid infinite loop + ⚽ aware ----
function runOpponentTurn(state: BattleState): BattleState {
  if (state.winner) return state;

  let s: BattleState = {
    ...state,
    active: "opponent",
  };

  s = {
    ...s,
    opponent: startTurn(s.opponent, s.turn),
  };
  s.log.push("Opponent starts their turn.");

  let playedSomething = true;
  let safety = 0;

  while (playedSomething && safety < 50) {
    safety++;
    playedSomething = false;

    // Only consider monsters that are actually playable
    const idxMonster = s.opponent.hand.findIndex((c) => {
      if (c.kind !== "MONSTER") return false;
      if (c.manaCost > s.opponent.mana) return false;
      // Board full -> this monster is NOT playable
      if (s.opponent.board.length >= 3) return false;
      // FWD needs a MID already on the pitch
      if (c.position === "FWD") {
        const hasMidfielder = s.opponent.board.some((m) => m.position === "MID");
        if (!hasMidfielder) return false;
      }
      return true;
    });

    if (idxMonster >= 0) {
      s = playCardFromHand(s, "opponent", idxMonster);
      playedSomething = true;
      continue;
    }

    // Spells: just need enough mana
    const idxSpell = s.opponent.hand.findIndex(
      (c) => c.kind === "SPELL" && c.manaCost <= s.opponent.mana
    );
    if (idxSpell >= 0) {
      s = playCardFromHand(s, "opponent", idxSpell);
      playedSomething = true;
    }
  }

  if (s.winner) return s;

  // Simple AI:
  // - If defenders on your side, clear them.
  // - Otherwise, if you have the ball, shoot GK.
  // - If you don't have the ball but player does, tackle their ball-holder (unless stealthed).
  // - Else, trade into any minion.
  s.opponent.board.forEach((m, idx) => {
    if (!m.canAttack) return;

    const defenderIndices = findDefenderIndices(s.player.board);

    const rawPlayerBallIdx = s.player.board.findIndex((bm) => bm.hasBall);
    const playerBallIdx =
      rawPlayerBallIdx >= 0 && hasKeyword(s.player.board[rawPlayerBallIdx], "STEALTH")
        ? s.player.board.findIndex((bm) => !hasKeyword(bm, "STEALTH"))
        : rawPlayerBallIdx;

    const thisHasBall = !!m.hasBall;

    if (defenderIndices.length > 0) {
      const targetIdx = defenderIndices[0];
      s = applyAttack(s, "opponent", idx, "MINION", targetIdx);
      return;
    }

    if (!thisHasBall && playerBallIdx >= 0) {
      // Try to tackle the ball-holder (if possible)
      s = applyAttack(s, "opponent", idx, "MINION", playerBallIdx);
      return;
    }

    if (thisHasBall && s.player.board.length === 0) {
      // Clean shot on GK
      s = applyAttack(s, "opponent", idx, "HERO");
      return;
    }

    if (s.player.board.length > 0) {
      // Trade into first non-stealth minion if possible
      const nonStealthIdx = s.player.board.findIndex((bm) => !hasKeyword(bm, "STEALTH"));
      const targetIdx = nonStealthIdx >= 0 ? nonStealthIdx : 0;
      s = applyAttack(s, "opponent", idx, "MINION", targetIdx);
      return;
    }

    if (thisHasBall) {
      s = applyAttack(s, "opponent", idx, "HERO");
    }
  });

  if (s.winner) return s;

  let s2 = endTurnSwitchActive(s);
  s2.player = startTurn(s2.player, s2.turn);
  s2.log.push("Your turn starts.");

  return s2;
}

// ---- Initial battle creation (using chosen XI & selected GK) ----

function createInitialBattleFromXI(xi: UserMonsterDTO[], heroMonster: UserMonsterDTO): BattleState {
  const hero = buildHeroFromGK(heroMonster);
  return createBattleFromBase(xi, hero);
}

function createBattleFromBase(xi: UserMonsterDTO[], hero: HeroState): BattleState {
  const monstersAsCards = xi.map(buildMonsterCard);
  const spells = createSpellCards(); // 9 random spells
  const deck: BattleCard[] = shuffle([...monstersAsCards, ...spells]);
  // NOTE: Deck has 10 monster cards + 9 spells = 19 drawables.
  // Plus the GK hero on board gives you effectively 20 "pieces" in play.

  const playerDeck = [...deck];
  const opponentDeck = [...deck];

  const basePlayer: PlayerState = {
    key: "player",
    label: "Player 1",
    deck: playerDeck,
    hand: [],
    board: [],
    hero: { ...hero },
    mana: 0,
    maxMana: 0,
  };

  const baseOpponent: PlayerState = {
    key: "opponent",
    label: "Player 2",
    deck: opponentDeck,
    hand: [],
    board: [],
    hero: { ...hero, name: hero.name },
    mana: 0,
    maxMana: 0,
  };

  let s: BattleState = {
    player: basePlayer,
    opponent: baseOpponent,
    active: "player",
    turn: 1,
    winner: null,
    log: ["Battle started. Player 1's turn."],
    ballAtCenter: true, // ⚽ ball starts in the center of the pitch
  };

  // Initial 3-card deal each
  let p = { ...s.player };
  let o = { ...s.opponent };
  for (let i = 0; i < 3; i++) {
    p = drawCard(p);
    o = drawCard(o);
  }
  s = { ...s, player: p, opponent: o };

  // Player's first turn
  s.player = startTurn(s.player, s.turn);

  return s;
}

// ---- React component ----

type PositionFilter = "ALL" | Position;

export default function BattleMatchPage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-4">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-sm text-slate-200">Loading battle mode…</p>
          </section>
        </main>
      }
    >
      <BattleMatchInner />
    </Suspense>
  );
}

function BattleMatchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPvP = (searchParams?.get("mode") || "").toLowerCase() === "pvp";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collection, setCollection] = useState<UserMonsterDTO[]>([]);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [selectedAttacker, setSelectedAttacker] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [turnTimer, setTurnTimer] = useState<number>(TURN_DURATION);

  // ✅ Targeted spell state (Stealth / Red Card)
  const [pendingSpell, setPendingSpell] = useState<{
    handIndex: number;
    name: string;
    effect: SpellEffectType;
  } | null>(null);

  // Pre-game XI selection
  const [deckSelection, setDeckSelection] = useState<string[]>([]); // outfield only
  const [deckError, setDeckError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [heroId, setHeroId] = useState<string | null>(null); // selected GK hero
  const [formationId, setFormationId] = useState<string>(FORMATIONS[0].id);
  const maxDeckSize = OUTFIELD_REQUIRED; // 10 outfield

  // PvP queue state (only meaningful when isPvP = true)
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("IDLE");
  const [queueError, setQueueError] = useState<string | null>(null);

  // --- SFX + Music ---
  const [isMuted, setIsMuted] = useState(false);
  const sfxRef = useRef<Record<SfxKey, HTMLAudioElement> | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicStartedRef = useRef(false);

  // --- Reward state (single-player) ---
  const [rewardInfo, setRewardInfo] = useState<{
    requested: number;
    granted: number;
    capRemaining: number;
    status: "IDLE" | "GRANTED" | "ERROR";
    message?: string;
  } | null>(null);

  const playSfx = (key: SfxKey) => {
    if (isMuted) return;
    const a = sfxRef.current?.[key];
    if (!a) return;
    try {
      a.currentTime = 0;
      void a.play();
    } catch {
      // ignore
    }
  };

  const startMusic = () => {
    if (isMuted) return;
    const m = musicRef.current;
    if (!m) return;
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    try {
      m.currentTime = 0;
      void m.play();
    } catch {
      // Autoplay restrictions: we'll keep trying on the next user interaction
      musicStartedRef.current = false;
    }
  };

  const stopMusic = () => {
    const m = musicRef.current;
    if (!m) return;
    try {
      m.pause();
      m.currentTime = 0;
    } catch {
      // ignore
    } finally {
      musicStartedRef.current = false;
    }
  };

  const getTorontoDateKey = () => {
    try {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
    } catch {
      // fallback
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  };

  const applyDailyCapAndPersist = (requested: number) => {
    const day = getTorontoDateKey();
    const key = `fml_single_battle_coins_${day}`;
    let earned = 0;

    try {
      const raw = localStorage.getItem(key);
      earned = raw ? Number(raw) || 0 : 0;
    } catch {
      earned = 0;
    }

    const remaining = Math.max(0, SINGLE_DAILY_COIN_CAP - earned);
    const granted = Math.max(0, Math.min(requested, remaining));
    const nextEarned = earned + granted;

    try {
      localStorage.setItem(key, String(nextEarned));
    } catch {
      // ignore
    }

    return { granted, remainingAfter: Math.max(0, SINGLE_DAILY_COIN_CAP - nextEarned) };
  };

  const tryGrantCoinsServer = async (amount: number) => {
    // NOTE: If your backend route differs, update this path.
    // This is wrapped in try/catch so it never breaks battle mode.
    await fetch("/api/me/coins/earn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        amount,
        source: "SINGLE_BATTLE",
      }),
    });
  };

  // Preload audio on mount
  useEffect(() => {
    // Load mute preference
    try {
      const raw = localStorage.getItem("fml_battle_muted");
      if (raw === "1") setIsMuted(true);
    } catch {
      // ignore
    }

    const loaded: Record<SfxKey, HTMLAudioElement> = {
      deployDEF: new Audio(SFX_PATHS.deployDEF),
      deployMID: new Audio(SFX_PATHS.deployMID),
      deployFWD: new Audio(SFX_PATHS.deployFWD),
      attackMID: new Audio(SFX_PATHS.attackMID),
      attackFWD: new Audio(SFX_PATHS.attackFWD),
      shootGK: new Audio(SFX_PATHS.shootGK),
      death: new Audio(SFX_PATHS.death),
      pass: new Audio(SFX_PATHS.pass),
      spell: new Audio(SFX_PATHS.spell),
      heroPower: new Audio(SFX_PATHS.heroPower),
      uiClick: new Audio(SFX_PATHS.uiClick),
    };

    // Small per-SFX volume tuning
    (Object.keys(loaded) as SfxKey[]).forEach((k) => {
      loaded[k].volume = k === "death" ? 0.7 : 0.55;
      loaded[k].preload = "auto";
    });

    sfxRef.current = loaded;

    const music = new Audio(MUSIC_PATH);
    music.loop = true;
    music.volume = 0.22;
    music.preload = "auto";
    musicRef.current = music;

    return () => {
      try {
        music.pause();
      } catch {
        // ignore
      }
      sfxRef.current = null;
      musicRef.current = null;
    };
  }, []);

  // Persist mute + start/stop music accordingly
  useEffect(() => {
    try {
      localStorage.setItem("fml_battle_muted", isMuted ? "1" : "0");
    } catch {
      // ignore
    }
    if (isMuted) {
      stopMusic();
    } else {
      // if a battle is active, try to start music (requires user interaction; will retry)
      if (battle && !battle.winner) startMusic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMuted]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/me/collection", {
          credentials: "include",
        });
        if (!res.ok) {
          setError("Failed to load your collection.");
          return;
        }
        const data: CollectionResponse = await res.json();
        setCollection(data.monsters);
      } catch {
        setError("Failed to load your collection.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const activeFormation = useMemo(
    () => FORMATIONS.find((f) => f.id === formationId) ?? FORMATIONS[0],
    [formationId]
  );

  // Auto-pick XI once collection is loaded (formation-based), only if nothing picked yet
  useEffect(() => {
    if (!loading && !error && collection.length > 0 && deckSelection.length === 0 && !heroId) {
      const result = autoPickForFormation(collection, activeFormation);
      setDeckSelection(result.deckIds);
      setHeroId(result.heroId);
    }
  }, [loading, error, collection, deckSelection.length, heroId, activeFormation]);

  // Turn timer for single-player battle
  useEffect(() => {
    if (!battle || battle.winner) return;

    setTurnTimer(TURN_DURATION);
    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPendingSpell(null);
          setSelectedAttacker(null);
          setActionMessage(null);
          setBattle((prevBattle) => {
            if (!prevBattle || prevBattle.winner) return prevBattle;
            if (prevBattle.active !== "player") return prevBattle;
            return runOpponentTurn(prevBattle);
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [battle?.active, battle?.turn, battle?.winner]);

  // Clear pending spell when it's not your turn
  useEffect(() => {
    if (!battle) return;
    if (battle.active !== "player" && pendingSpell) {
      setPendingSpell(null);
    }
  }, [battle?.active, pendingSpell, battle]);

  // PvP queue polling (only if isPvP and not in a local battle)
  useEffect(() => {
    if (!isPvP) return;
    if (queueStatus !== "QUEUED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/battle/queue", {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: QueueResponse = await res.json();

        if (data.status === "MATCHED") {
          setQueueStatus("MATCHED");
          setQueueError(null);
          router.push(`/battle/pvp/${data.matchId}`);
        } else if (data.status === "IDLE") {
          setQueueStatus("IDLE");
        } else {
          setQueueStatus("QUEUED");
        }
      } catch (err) {
        console.error("Error polling PvP queue:", err);
        setQueueError("Lost connection to queue. Try again.");
        setQueueStatus("IDLE");
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [queueStatus, isPvP, router]);

  const selectedMonstersForDeck = useMemo(
    () => collection.filter((m) => deckSelection.includes(m.id)),
    [collection, deckSelection]
  );

  const heroCandidates = useMemo(() => collection.filter((m) => m.position === "GK"), [collection]);

  const deckCounts = useMemo(() => {
    const c: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const m of selectedMonstersForDeck) {
      if (c[m.position] !== undefined) c[m.position]++;
    }
    return c;
  }, [selectedMonstersForDeck]);

  const filteredCollection = useMemo(
    () => collection.filter((m) => (positionFilter === "ALL" ? true : m.position === positionFilter)),
    [collection, positionFilter]
  );

  const totalSelectedCount = deckSelection.length + (heroId ? 1 : 0); // outfield + GK hero

  const handleToggleDeckMonster = (id: string) => {
    setDeckError(null);
    setActionMessage(null);
    playSfx("uiClick");
    setDeckSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= maxDeckSize) return prev;
      return [...prev, id];
    });
  };

  const handleAutoPickXI = () => {
    setDeckError(null);
    setActionMessage(null);
    if (collection.length === 0) return;
    playSfx("uiClick");
    const result = autoPickForFormation(collection, activeFormation);
    setDeckSelection(result.deckIds);
    setHeroId(result.heroId);
  };

  const handleStartBattle = async () => {
    setDeckError(null);
    setActionMessage(null);
    setQueueError(null);
    setRewardInfo(null);

    playSfx("uiClick");

    if (deckSelection.length !== OUTFIELD_REQUIRED) {
      setDeckError(`You must pick exactly ${OUTFIELD_REQUIRED} outfield monsters to start the battle.`);
      return;
    }

    if (!heroId) {
      setDeckError("You must choose a Goalkeeper hero for your XI before starting.");
      return;
    }

    if (totalSelectedCount !== TOTAL_XI) {
      setDeckError(
        `You must have exactly ${TOTAL_XI} players selected (1 GK hero + ${OUTFIELD_REQUIRED} outfield).`
      );
      return;
    }

    const xiOutfield = collection.filter((m) => deckSelection.includes(m.id));
    if (xiOutfield.length !== OUTFIELD_REQUIRED) {
      setDeckError("Some selected outfield monsters could not be found.");
      return;
    }

    const heroMonster = collection.find((m) => m.id === heroId);
    if (!heroMonster) {
      setDeckError("Your chosen Goalkeeper could not be found.");
      return;
    }

    if (heroMonster.position !== "GK") {
      setDeckError("Your chosen hero must be a Goalkeeper (GK).");
      return;
    }

    // --- PvP mode: join queue instead of creating a local AI battle (unchanged) ---
    if (isPvP) {
      try {
        setQueueStatus("IDLE");
        const res = await fetch("/api/battle/queue", {
          method: "POST",
          credentials: "include",
        });

        if (res.status === 401) {
          setQueueError("You must be logged in to play online.");
          return;
        }

        if (!res.ok) {
          setQueueError("Failed to join PvP queue. Try again.");
          return;
        }

        const data: QueueResponse = await res.json();

        if (data.status === "MATCHED") {
          setQueueStatus("MATCHED");
          router.push(`/battle/pvp/${data.matchId}`);
        } else if (data.status === "QUEUED") {
          setQueueStatus("QUEUED");
        } else {
          setQueueStatus("IDLE");
        }
      } catch (err) {
        console.error("Error joining PvP queue from XI screen:", err);
        setQueueError("Failed to join PvP queue. Try again.");
        setQueueStatus("IDLE");
      }
      return;
    }

    // --- Single-player vs AI mode ---
    const next = createInitialBattleFromXI(xiOutfield, heroMonster);
    setSelectedAttacker(null);
    setActionMessage(null);
    setPendingSpell(null);
    setBattle(next);

    // Start background music on user interaction (Start Battle click counts)
    startMusic();
  };

  const handlePlayCard = (handIndex: number) => {
    if (!battle) return;
    if (battle.winner) return;

    const actingKey: PlayerKey = battle.active;
    const acting = actingKey === "player" ? battle.player : battle.opponent;
    const card = acting.hand[handIndex];

    // ✅ If a targeted spell is played, enter targeting mode (player only).
    if (
      card &&
      card.kind === "SPELL" &&
      actingKey === "player" &&
      (card.effect === "STEALTH_MINION" || card.effect === "KILL_MINION")
    ) {
      playSfx("uiClick");
      setSelectedAttacker(null);
      setPendingSpell({ handIndex, name: card.name, effect: card.effect });
      setActionMessage(
        card.effect === "STEALTH_MINION"
          ? `Select a MID or FWD on your side to receive Stealth.`
          : `Select any monster on the pitch to destroy.`
      );
      return;
    }

    if (card && card.kind === "MONSTER" && acting.board.length >= 3) {
      setActionMessage("You already have 3 monsters on the pitch. (Max 3 per side.)");
      return;
    }

    if (card && card.kind === "MONSTER" && card.position === "FWD") {
      const hasMidfielder = acting.board.some((m) => m.position === "MID");
      if (!hasMidfielder) {
        setActionMessage("You need a Midfielder on your side of the pitch before you can play a Forward.");
        return;
      }
    }

    // --- SFX for playing cards (player only) ---
    if (actingKey === "player" && card) {
      if (card.kind === "MONSTER") {
        if (card.position === "DEF") playSfx("deployDEF");
        if (card.position === "MID") playSfx("deployMID");
        if (card.position === "FWD") playSfx("deployFWD");
      } else {
        playSfx("spell");
      }
    }

    setSelectedAttacker(null);
    setPendingSpell(null);
    setActionMessage(null);
    setBattle((prev) => (prev ? playCardFromHand(prev, actingKey, handIndex) : prev));

    // If unmuted, attempt to start music once the user starts interacting during battle
    startMusic();
  };

  // ✅ Cancel targeting if needed
  const handleCancelTargeting = () => {
    playSfx("uiClick");
    setPendingSpell(null);
    setActionMessage(null);
  };

  // ✅ NEW: Forfeit match (player loses immediately)
  const handleForfeitMatch = () => {
    playSfx("uiClick");
    stopMusic();
    setSelectedAttacker(null);
    setPendingSpell(null);
    setActionMessage(null);
    setBattle((prev) => {
      if (!prev || prev.winner) return prev;
      return {
        ...prev,
        winner: "opponent",
        log: [...prev.log, "Player forfeited the match."],
      };
    });
  };

  // ⚽ Handle clicking *your own* monsters: select attacker OR pass the ball OR target a spell
  const handlePlayerBoardClick = (idx: number) => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
      return;
    }

    // ✅ Targeted spell resolution (your side)
    if (pendingSpell) {
      const target = battle.player.board[idx];
      if (!target) return;

      if (pendingSpell.effect === "STEALTH_MINION") {
        if (target.position !== "MID" && target.position !== "FWD") {
          setActionMessage("Stealth only works on Midfielders (MID) and Forwards (FWD).");
          return;
        }
      }

      playSfx("spell");
      setBattle((prev) =>
        prev ? playTargetedSpellFromHand(prev, "player", pendingSpell.handIndex, "player", idx) : prev
      );
      setPendingSpell(null);
      setActionMessage(null);
      setSelectedAttacker(null);
      startMusic();
      return;
    }

    const card = battle.player.board[idx];
    if (!card) return;

    // No selection yet: select this monster (attacker or potential passer)
    if (selectedAttacker === null) {
      setActionMessage(null);
      setSelectedAttacker(idx);
      return;
    }

    // Clicking the same monster toggles selection off
    if (idx === selectedAttacker) {
      setSelectedAttacker(null);
      setActionMessage(null);
      return;
    }

    const source = battle.player.board[selectedAttacker];
    if (!source) {
      setSelectedAttacker(null);
      setActionMessage("That monster is no longer on the pitch.");
      return;
    }

    // If source does NOT have the ball, just switch selected attacker/passer
    if (!source.hasBall) {
      setSelectedAttacker(idx);
      setActionMessage(null);
      return;
    }

    // Source has the ball → attempt a PASS to idx
    if (battle.player.mana < PASS_MANA_COST) {
      setActionMessage(`Not enough mana to pass. Passing costs ${PASS_MANA_COST} mana.`);
      return;
    }

    setBattle((prev) => {
      if (!prev) return prev;
      if (prev.winner || prev.active !== "player") return prev;

      const currentSource = prev.player.board[selectedAttacker];
      const currentTarget = prev.player.board[idx];
      if (!currentSource || !currentTarget) return prev;
      if (!currentSource.hasBall) return prev;

      const newPlayer = { ...prev.player };
      newPlayer.mana = Math.max(0, newPlayer.mana - PASS_MANA_COST);
      newPlayer.board = newPlayer.board.map((m, i) => {
        if (i === selectedAttacker) return { ...m, hasBall: false };
        if (i === idx) return { ...m, hasBall: true };
        return { ...m, hasBall: false };
      });

      const newLog = [
        ...prev.log,
        `${prev.player.label}'s ${currentSource.name} passed the ball to ${currentTarget.name}.`,
      ];

      return {
        ...prev,
        player: newPlayer,
        opponent: {
          ...prev.opponent,
          board: prev.opponent.board.map((m) => ({ ...m, hasBall: false })),
        },
        ballAtCenter: false,
        log: newLog,
      };
    });

    playSfx("pass");
    startMusic();

    setSelectedAttacker(idx);
    setActionMessage(null);
  };

  const handleAttackHero = () => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
      return;
    }
    if (pendingSpell) {
      setActionMessage("Finish selecting your spell target (or cancel targeting) first.");
      return;
    }
    if (selectedAttacker === null) {
      setActionMessage("Select an attacking monster first.");
      return;
    }

    const attacker = battle.player.board[selectedAttacker];
    if (!attacker) {
      setSelectedAttacker(null);
      setActionMessage("That monster is no longer on the pitch.");
      return;
    }
    if (!attacker.canAttack || attacker.position === "DEF") {
      setActionMessage("This monster can’t attack right now.");
      return;
    }
    if (!attacker.hasBall) {
      setActionMessage("Only the monster with the ball can shoot at the Goalkeeper.");
      return;
    }

    const opponentHasDefender = battle.opponent.board.some((m) => m.position === "DEF");

    if (opponentHasDefender) {
      setActionMessage("You must attack the defenders before you can target the Goalkeeper.");
      return;
    }

    // SFX: attacker shooting GK (MID/FWD)
    if (attacker.position === "MID") playSfx("attackMID");
    if (attacker.position === "FWD") playSfx("attackFWD");
    playSfx("shootGK");
    startMusic();

    setActionMessage(null);
    setBattle((prev) => (prev ? applyAttack(prev, "player", selectedAttacker, "HERO") : prev));
    setSelectedAttacker(null);
  };

  const handleAttackMinion = (enemyIdx: number) => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
      return;
    }

    // ✅ Targeted spell resolution (enemy side)
    if (pendingSpell) {
      playSfx("spell");
      startMusic();
      setBattle((prev) =>
        prev ? playTargetedSpellFromHand(prev, "player", pendingSpell.handIndex, "opponent", enemyIdx) : prev
      );
      setPendingSpell(null);
      setActionMessage(null);
      setSelectedAttacker(null);
      return;
    }

    if (selectedAttacker === null) {
      setActionMessage("Select an attacking monster first.");
      return;
    }
    const attacker = battle.player.board[selectedAttacker];
    if (!attacker) {
      setSelectedAttacker(null);
      setActionMessage("That monster is no longer on the pitch.");
      return;
    }
    if (!attacker.canAttack || attacker.position === "DEF") {
      setActionMessage("This monster can’t attack right now.");
      return;
    }

    const enemy = battle.opponent.board[enemyIdx];
    if (!enemy) {
      setActionMessage("That target is no longer on the pitch.");
      return;
    }

    const opponentHasDefender = battle.opponent.board.some((m) => m.position === "DEF");
    if (opponentHasDefender && enemy.position !== "DEF") {
      setActionMessage("While defenders are on the pitch, you must target a defender.");
      return;
    }

    // UI-friendly message if target is stealthed
    if (enemy.keywords.includes("STEALTH")) {
      setActionMessage("That monster is in Stealth and can’t be attacked right now.");
      return;
    }

    // SFX: attacker combat (MID/FWD)
    if (attacker.position === "MID") playSfx("attackMID");
    if (attacker.position === "FWD") playSfx("attackFWD");
    startMusic();

    setActionMessage(null);
    setBattle((prev) => (prev ? applyAttack(prev, "player", selectedAttacker, "MINION", enemyIdx) : prev));
    setSelectedAttacker(null);
  };

  const handleEndTurn = () => {
    playSfx("uiClick");
    startMusic();
    setSelectedAttacker(null);
    setPendingSpell(null);
    setActionMessage(null);
    setBattle((prev) => {
      if (!prev) return prev;
      if (prev.winner) return prev;
      if (prev.active !== "player") return prev;
      return runOpponentTurn(prev);
    });
  };

  const handleHeroPowerClick = () => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
      return;
    }
    if (pendingSpell) {
      setActionMessage("Finish selecting your spell target (or cancel targeting) first.");
      return;
    }
    if (battle.player.mana < HERO_POWER_COST) {
      setActionMessage(`Not enough mana. Hero Power costs ${HERO_POWER_COST}.`);
      return;
    }

    playSfx("heroPower");
    startMusic();

    setActionMessage(null);
    setSelectedAttacker(null);
    setBattle((prev) => (prev ? useHeroPower(prev, "player") : prev));
  };

  const handleRestart = () => {
    playSfx("uiClick");
    startMusic();

    setRewardInfo(null);
    setPendingSpell(null);
    if (deckSelection.length === OUTFIELD_REQUIRED && heroId) {
      const xiOutfield = collection.filter((m) => deckSelection.includes(m.id));
      const heroMonster = collection.find((m) => m.id === heroId);
      if (xiOutfield.length === OUTFIELD_REQUIRED && heroMonster && heroMonster.position === "GK") {
        const next = createInitialBattleFromXI(xiOutfield, heroMonster);
        setSelectedAttacker(null);
        setActionMessage(null);
        setBattle(next);
        return;
      }
    }
    // Fallback: if for some reason GK or XI invalid, go back to squad selection
    setBattle(null);
    setActionMessage("Your XI or Goalkeeper selection is no longer valid. Please re-pick your squad.");
  };

  const playerBoard = battle?.player.board ?? [];
  const opponentBoard = battle?.opponent.board ?? [];
  const logView = useMemo(() => battle?.log.slice(-8) ?? [], [battle]);

  // ✅ NEW: Auto-draw detection for stalemate:
  // If BOTH sides have no cards left (deck+hand) and there are no attackers left on the pitch
  // (i.e. only DEF remain, or empty boards), then nobody can ever score → DRAW.
  useEffect(() => {
    if (!battle) return;
    if (battle.winner) return;

    const noCardsLeft = (p: PlayerState) => p.deck.length === 0 && p.hand.length === 0;
    const hasAnyAttacker = (p: PlayerState) => p.board.some((m) => m.position !== "DEF");

    const stalemate =
      noCardsLeft(battle.player) &&
      noCardsLeft(battle.opponent) &&
      !hasAnyAttacker(battle.player) &&
      !hasAnyAttacker(battle.opponent);

    if (stalemate) {
      setBattle((prev) => {
        if (!prev || prev.winner) return prev;
        return {
          ...prev,
          winner: "DRAW",
          log: [
            ...prev.log,
            "Only defenders remain and both sides are out of cards — nobody can attack, so the match ends in a draw.",
          ],
        };
      });
    }
  }, [battle]);

  // --- Reward payout on battle end (single-player only) ---
  useEffect(() => {
    if (!battle) return;
    if (!battle.winner) return;
    if (isPvP) return;
    if (rewardInfo?.status === "GRANTED" || rewardInfo?.status === "ERROR") return;

    const requested =
      battle.winner === "player"
        ? SINGLE_WIN_COINS
        : battle.winner === "DRAW"
        ? SINGLE_DRAW_COINS
        : 0;

    if (requested <= 0) {
      setRewardInfo({
        requested: 0,
        granted: 0,
        capRemaining: SINGLE_DAILY_COIN_CAP,
        status: "GRANTED",
      });
      return;
    }

    const { granted, remainingAfter } = applyDailyCapAndPersist(requested);

    const run = async () => {
      try {
        if (granted > 0) {
          // Attempt to grant on server (safe-fail).
          await tryGrantCoinsServer(granted);
        }
        setRewardInfo({
          requested,
          granted,
          capRemaining: remainingAfter,
          status: "GRANTED",
          message:
            granted === 0
              ? "Daily cap reached (0 coins awarded)."
              : granted < requested
              ? `Daily cap applied (${granted}/${requested} coins awarded).`
              : undefined,
        });
      } catch (e) {
        // Still keep local cap tracking; show error for server sync.
        setRewardInfo({
          requested,
          granted,
          capRemaining: remainingAfter,
          status: "ERROR",
          message: "Coins were capped locally, but server crediting failed (check /api/me/coins/earn).",
        });
      }
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.winner, isPvP]);

  // --- SFX: detect deaths + GK shots + opponent deploys automatically (no engine side-effects) ---
  const prevBattleRef = useRef<BattleState | null>(null);
  useEffect(() => {
    if (!battle) {
      prevBattleRef.current = null;
      return;
    }

    const prev = prevBattleRef.current;
    if (prev) {
      // Monster death SFX (either side)
      const playerDeaths = battle.player.board.length < prev.player.board.length;
      const oppDeaths = battle.opponent.board.length < prev.opponent.board.length;
      if (playerDeaths || oppDeaths) playSfx("death");

      // GK shot SFX (either GK took damage)
      const playerGkHit = battle.player.hero.hp < prev.player.hero.hp;
      const oppGkHit = battle.opponent.hero.hp < prev.opponent.hero.hp;
      if (playerGkHit || oppGkHit) playSfx("shootGK");

      // Opponent deploy SFX
      if (battle.opponent.board.length > prev.opponent.board.length) {
        const added = battle.opponent.board.find(
          (m) => !prev.opponent.board.some((x) => x.id === m.id)
        );
        if (added) {
          if (added.position === "DEF") playSfx("deployDEF");
          if (added.position === "MID") playSfx("deployMID");
          if (added.position === "FWD") playSfx("deployFWD");
        }
      }
    }

    prevBattleRef.current = battle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle]);

  if (loading) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-sm text-slate-200">Loading battle mode…</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-red-500/40 bg-red-950/60 p-4">
          <h2 className="mb-1 text-sm font-semibold text-red-200">Battle mode error</h2>
          <p className="mb-2 text-xs text-red-200">{error}</p>
          <p className="text-xs text-red-100">
            Make sure you&apos;re logged in and have at least a few monsters in your collection.
          </p>
        </section>
      </main>
    );
  }

  if (collection.length === 0) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <p className="text-sm text-slate-200">
            You don&apos;t have any monsters yet. Open some packs before entering battle.
          </p>
        </section>
      </main>
    );
  }

  // ---- Pre-game XI selection ----
  if (!battle && !isPvP) {
    // Normal single-player vs AI flow
    return (
      <main className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-100">Pick your XI for Battle Mode</h2>
              <p className="text-[11px] text-emerald-200">
                Choose 10 outfield monsters and 1 Goalkeeper hero from your FML collection to form your XI.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/60 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold text-emerald-200">
              Vs AI
            </div>
          </div>

          <p className="text-[10px] text-emerald-300">You play as Player 1 against an AI-controlled Player 2.</p>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-emerald-100">
            <span>
              Selected: <span className="font-mono font-semibold">{totalSelectedCount}/{TOTAL_XI}</span>
            </span>
            <span>
              GK: <span className="font-mono">{heroId ? 1 : 0}</span>
            </span>
            <span>
              DEF: <span className="font-mono">{deckCounts.DEF}</span>
            </span>
            <span>
              MID: <span className="font-mono">{deckCounts.MID}</span>
            </span>
            <span>
              FWD: <span className="font-mono">{deckCounts.FWD}</span>
            </span>
          </div>

          {/* Formation + auto pick */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-emerald-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Formation</span>
              <select
                value={formationId}
                onChange={(e) => setFormationId(e.target.value)}
                className="rounded-full border border-emerald-500/60 bg-emerald-950/70 px-2 py-1 text-[11px] text-emerald-100"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAutoPickXI}
              className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Auto pick XI for this formation
            </button>
          </div>

          {/* GK selection */}
          <div className="mt-2 space-y-1 text-[11px] text-emerald-100">
            <p className="font-semibold">Goalkeeper hero (counts in XI)</p>
            {heroCandidates.length === 0 ? (
              <p className="text-[10px] text-emerald-300">
                You don&apos;t have any Goalkeepers yet. Open more packs to unlock a GK hero.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={heroId ?? ""}
                  onChange={(e) => {
                    playSfx("uiClick");
                    setHeroId(e.target.value || null);
                  }}
                  className="rounded-full border border-emerald-500/60 bg-emerald-950/70 px-2 py-1 text-[11px] text-emerald-100"
                >
                  <option value="">Select your Goalkeeper…</option>
                  {heroCandidates.map((gk) => (
                    <option key={gk.id} value={gk.id}>
                      {gk.displayName || gk.realPlayerName}
                    </option>
                  ))}
                </select>
                {heroId && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                    GK selected (1)
                  </span>
                )}
              </div>
            )}
          </div>

          {deckError && <p className="mt-1 text-[11px] text-red-300">{deckError}</p>}

          {/* Start button */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleStartBattle}
              disabled={deckSelection.length !== OUTFIELD_REQUIRED || !heroId}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                deckSelection.length !== OUTFIELD_REQUIRED || !heroId
                  ? "cursor-not-allowed bg-emerald-900 text-emerald-400/70"
                  : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              }`}
            >
              Start Battle
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-100">Your collection</h3>
              <p className="mb-2 text-[11px] text-slate-400">
                Tap cards to add/remove them from your XI. Max {OUTFIELD_REQUIRED} outfield monsters. Goalkeepers are chosen
                as your hero and cannot be used as outfield cards.
              </p>
            </div>
            {/* Position filter */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {(["ALL", "GK", "DEF", "MID", "FWD"] as PositionFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    playSfx("uiClick");
                    setPositionFilter(f);
                  }}
                  className={`rounded-full px-2 py-0.5 ${
                    positionFilter === f ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {f === "ALL" ? "All" : f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {filteredCollection.map((monster) => {
              const selected = deckSelection.includes(monster.id);
              const isGK = monster.position === "GK";
              const disabledBase = !selected && deckSelection.length >= maxDeckSize;
              // Goalkeepers can never be selected into the outfield XI
              const disabled = disabledBase || isGK;
              return (
                <DeckSelectionCard
                  key={monster.id}
                  monster={monster}
                  selected={!!selected}
                  disabled={disabled}
                  onToggle={() => !disabled && handleToggleDeckMonster(monster.id)}
                />
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  // ---- Pre-game XI selection in PvP mode ----
  if (!battle && isPvP) {
    const isSearching = queueStatus === "QUEUED";

    return (
      <main className="space-y-4">
        {/* (unchanged PvP XI UI) */}
        {/* ... your existing PvP selection UI remains unchanged ... */}
        <section className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-100">Pick your XI for Online PvP</h2>
              <p className="text-[11px] text-emerald-200">
                Choose 10 outfield monsters and 1 Goalkeeper hero from your FML collection. Once ready, you&apos;ll join the online queue and be
                matched against another manager.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/60 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold text-emerald-200">
              Online PvP
            </div>
          </div>

          <p className="text-[10px] text-emerald-300">
            You&apos;ll take this XI into a real-time PvP battle. When a match is found, we&apos;ll drop you straight into the pitch.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-emerald-100">
            <span>
              Selected: <span className="font-mono font-semibold">{totalSelectedCount}/{TOTAL_XI}</span>
            </span>
            <span>
              GK: <span className="font-mono">{heroId ? 1 : 0}</span>
            </span>
            <span>
              DEF: <span className="font-mono">{deckCounts.DEF}</span>
            </span>
            <span>
              MID: <span className="font-mono">{deckCounts.MID}</span>
            </span>
            <span>
              FWD: <span className="font-mono">{deckCounts.FWD}</span>
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-emerald-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Formation</span>
              <select
                value={formationId}
                onChange={(e) => {
                  playSfx("uiClick");
                  setFormationId(e.target.value);
                }}
                className="rounded-full border border-emerald-500/60 bg-emerald-950/70 px-2 py-1 text-[11px] text-emerald-100"
              >
                {FORMATIONS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAutoPickXI}
              className="rounded-full border border-emerald-400/70 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
            >
              Auto pick XI for this formation
            </button>
          </div>

          <div className="mt-2 space-y-1 text-[11px] text-emerald-100">
            <p className="font-semibold">Goalkeeper hero (counts in XI)</p>
            {heroCandidates.length === 0 ? (
              <p className="text-[10px] text-emerald-300">
                You don&apos;t have any Goalkeepers yet. Open more packs to unlock a GK hero.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={heroId ?? ""}
                  onChange={(e) => {
                    playSfx("uiClick");
                    setHeroId(e.target.value || null);
                  }}
                  className="rounded-full border border-emerald-500/60 bg-emerald-950/70 px-2 py-1 text-[11px] text-emerald-100"
                >
                  <option value="">Select your Goalkeeper…</option>
                  {heroCandidates.map((gk) => (
                    <option key={gk.id} value={gk.id}>
                      {gk.displayName || gk.realPlayerName}
                    </option>
                  ))}
                </select>
                {heroId && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-200">
                    GK selected (1)
                  </span>
                )}
              </div>
            )}
          </div>

          {deckError && <p className="mt-1 text-[11px] text-red-300">{deckError}</p>}
          {queueError && <p className="mt-1 text-[11px] text-red-300">{queueError}</p>}
          {isSearching && (
            <p className="mt-1 text-[10px] text-emerald-200">
              Searching for opponent… keep this tab open. You&apos;ll jump into the match as soon as another manager is ready.
            </p>
          )}

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleStartBattle}
              disabled={deckSelection.length !== OUTFIELD_REQUIRED || !heroId || isSearching}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                deckSelection.length !== OUTFIELD_REQUIRED || !heroId || isSearching
                  ? "cursor-not-allowed bg-emerald-900 text-emerald-400/70"
                  : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              }`}
            >
              {isSearching ? "Searching for opponent…" : "Find Online Match"}
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-100">Your collection</h3>
              <p className="mb-2 text-[11px] text-slate-400">
                Tap cards to add/remove them from your XI. Max {OUTFIELD_REQUIRED} outfield monsters. Goalkeepers are chosen
                as your hero and cannot be used as outfield cards.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 text-[10px]">
              {(["ALL", "GK", "DEF", "MID", "FWD"] as PositionFilter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    playSfx("uiClick");
                    setPositionFilter(f);
                  }}
                  className={`rounded-full px-2 py-0.5 ${
                    positionFilter === f ? "bg-emerald-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {f === "ALL" ? "All" : f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {filteredCollection.map((monster) => {
              const selected = deckSelection.includes(monster.id);
              const isGK = monster.position === "GK";
              const disabledBase = !selected && deckSelection.length >= maxDeckSize;
              const disabled = disabledBase || isGK;
              return (
                <DeckSelectionCard
                  key={monster.id}
                  monster={monster}
                  selected={!!selected}
                  disabled={disabled}
                  onToggle={() => !disabled && handleToggleDeckMonster(monster.id)}
                />
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  // ---- Main battle UI (single-player vs AI only) ----
  const opponentHeroArt = battle!.opponent.hero.artUrl ?? "/cards/base/test.png";
  const playerHeroArt = battle!.player.hero.artUrl ?? "/cards/base/test.png";

  return (
    <>
      <style jsx global>{`
        @keyframes deal-in {
          0% {
            transform: translateY(16px) scale(0.85);
            opacity: 0;
          }
          60% {
            transform: translateY(-6px) scale(1.03);
            opacity: 1;
          }
          100% {
            transform: translateY(0px) scale(1);
            opacity: 1;
          }
        }
      `}</style>

      <main className="space-y-4">
        {/* Top info (no End Turn / Restart here anymore) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
          <div className="space-y-1">
            <p className="text-[11px] text-slate-300">
              Turn <span className="font-mono font-semibold text-slate-50">{battle!.turn}</span> • Active:{" "}
              <span className="font-semibold text-emerald-300">
                {battle!.active === "player" ? "You" : "Opponent (AI)"}
              </span>
            </p>

            <div className="flex flex-wrap items-center gap-3">
              {/* Mana indicator */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-sky-200">Mana</span>
                <div className="flex gap-1">
                  {Array.from({ length: Math.max(battle!.player.maxMana, 1) }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-4 w-3 rounded-full border border-sky-400/60 shadow-sm ${
                        i < battle!.player.mana ? "bg-sky-400/90" : "bg-slate-800"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] text-sky-300">
                  {battle!.player.mana}/{battle!.player.maxMana}
                </span>
              </div>

              {/* Turn timer */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-amber-200">Turn timer</span>
                <div className="relative h-5 w-24 overflow-hidden rounded-full border border-amber-400/60 bg-slate-800">
                  <div
                    className={`h-full ${turnTimer <= 5 ? "bg-red-500" : "bg-amber-400"}`}
                    style={{
                      width: `${(Math.max(turnTimer, 0) / TURN_DURATION) * 100}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-slate-950">
                    {Math.max(turnTimer, 0)}s
                  </div>
                </div>
              </div>
            </div>

            {pendingSpell && (
              <p className="mt-1 text-[11px] text-indigo-200">
                Targeting: <span className="font-semibold">{pendingSpell.name}</span>
              </p>
            )}

            {actionMessage && <p className="mt-1 text-[11px] text-amber-300">{actionMessage}</p>}
          </div>
        </section>

        {/* ✅ UPDATED: Bigger, "Hearthstone-like" right-side controls (End Turn + Forfeit) */}
        <aside className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2 flex-col items-stretch gap-2 pr-2">
          {pendingSpell && (
            <button
              type="button"
              onClick={handleCancelTargeting}
              className="w-40 rounded-l-2xl border border-indigo-400/70 bg-slate-950/90 px-4 py-3 text-sm font-extrabold text-indigo-200 shadow-2xl hover:bg-indigo-500/20"
            >
              Cancel Target
            </button>
          )}

          <button
            type="button"
            disabled={!!battle!.winner || battle!.active !== "player"}
            onClick={handleEndTurn}
            className="w-40 rounded-l-2xl border border-emerald-400/80 bg-slate-950/90 px-4 py-5 text-base font-extrabold text-emerald-200 shadow-2xl hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            End Turn
          </button>

          <button
            type="button"
            disabled={!!battle!.winner}
            onClick={handleForfeitMatch}
            className="w-40 rounded-l-2xl border border-red-400/70 bg-slate-950/90 px-4 py-4 text-sm font-extrabold text-red-200 shadow-2xl hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Forfeit Match
          </button>

          <button
            type="button"
            onClick={handleRestart}
            className="w-40 rounded-l-2xl border border-slate-600/70 bg-slate-950/90 px-4 py-2 text-[11px] font-semibold text-slate-200 shadow-xl hover:bg-slate-800"
          >
            Restart Battle
          </button>

          <button
            type="button"
            onClick={() => {
              playSfx("uiClick");
              setIsMuted((v) => !v);
            }}
            className="w-40 rounded-l-2xl border border-slate-700 bg-slate-950/90 px-4 py-2 text-[11px] font-semibold text-slate-200 shadow-xl hover:bg-slate-800"
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </aside>

        {/* Shared pitch */}
        <section className="relative space-y-4 overflow-hidden rounded-3xl border border-emerald-500/60 bg-gradient-to-b from-emerald-900 via-emerald-950 to-emerald-900 p-4">
          {/* Pitch markings */}
          <div className="pointer-events-none absolute inset-4 rounded-[32px] border border-emerald-600/40" />
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 border-t border-emerald-500/50" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/40" />
          <div className="pointer-events-none absolute inset-x-10 top-6 h-16 rounded-[999px] border border-emerald-500/40" />
          <div className="pointer-events-none absolute inset-x-10 bottom-6 h-16 rounded-[999px] border border-emerald-500/40" />

          {/* ⚽ Ball in the center when free */}
          {battle!.ballAtCenter && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-300/80 bg-slate-950/80 text-xs">
              ⚽
            </div>
          )}

          <div className="relative flex flex-col gap-6">
            {/* Opponent GK (click to shoot) */}
            <button
              type="button"
              onClick={handleAttackHero}
              className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-900/50 px-3 py-3 text-center transition hover:border-emerald-300 hover:bg-emerald-800/60"
            >
              <div className="flex flex-col items-center gap-1">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-emerald-400 bg-emerald-700/60 shadow-lg">
                  <img src={opponentHeroArt} alt={battle!.opponent.hero.name} className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-950/70" />
                  <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950">
                    GK
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-100">{battle!.opponent.hero.name}</p>
              </div>
              <HeroHealth hero={battle!.opponent.hero} />
            </button>

            {/* Opponent board */}
            <div className="flex min-h-[3rem] flex-wrap justify-center gap-3">
              {opponentBoard.length === 0 ? (
                <div className="h-4" />
              ) : (
                opponentBoard.map((m, idx) => (
                  <BattleMonsterCardView
                    key={m.id}
                    card={m}
                    owner="opponent"
                    isSelected={false}
                    onClick={() => {
                      if (battle!.active === "player") {
                        // If targeting a spell, clicking an enemy minion resolves it
                        if (pendingSpell) {
                          handleAttackMinion(idx);
                          return;
                        }
                        if (selectedAttacker !== null) {
                          handleAttackMinion(idx);
                        }
                      }
                    }}
                    showStatusOverlay
                  />
                ))
              )}
            </div>

            {/* Player board */}
            <div className="flex min-h-[3rem] flex-wrap justify-center gap-3">
              {playerBoard.length === 0 ? (
                <div className="h-4" />
              ) : (
                playerBoard.map((m, idx) => (
                  <BattleMonsterCardView
                    key={m.id}
                    card={m}
                    owner="player"
                    isSelected={selectedAttacker === idx}
                    onClick={() => handlePlayerBoardClick(idx)}
                    showStatusOverlay
                  />
                ))
              )}
            </div>

            {/* ✅ CHANGED: Player GK is clickable to use Hero Power */}
            <button
              type="button"
              onClick={handleHeroPowerClick}
              disabled={!!battle!.winner || battle!.active !== "player" || battle!.player.mana < HERO_POWER_COST}
              className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-900/50 px-3 py-3 text-center transition hover:border-emerald-300 hover:bg-emerald-800/60 disabled:cursor-not-allowed disabled:opacity-50"
              title="Hero Power: Draw 2 cards (3 mana)"
            >
              <div className="flex flex-col items-center gap-1">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-emerald-400 bg-emerald-700/60 shadow-lg">
                  <img src={playerHeroArt} alt={battle!.player.hero.name} className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-950/70" />
                  <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950">
                    GK
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-100">{battle!.player.hero.name}</p>
                <p className="text-[10px] text-emerald-200">Tap GK: Draw 2 (3 Mana)</p>
              </div>
              <HeroHealth hero={battle!.player.hero} />
            </button>
          </div>
        </section>

        {/* Hand */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="mb-1 text-[11px] text-slate-300">Your hand (Player 1)</p>
          <div className="flex flex-wrap gap-2">
            {renderHand(battle!.player.hand, battle!.player.mana, !!battle!.winner, (idx) => handlePlayCard(idx))}
          </div>
        </section>

        {/* Log */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="mb-1 text-[11px] font-semibold text-slate-100">Battle log</p>
          {logView.length === 0 ? (
            <p className="text-[11px] text-slate-400">Actions will appear here as the battle unfolds.</p>
          ) : (
            <ul className="max-h-40 space-y-0.5 overflow-y-auto text-[11px] text-slate-300">
              {logView.map((entry, idx) => (
                <li key={idx} className="whitespace-pre-wrap">
                  • {entry}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* ✅ End-of-game overlay (win/lose/draw) + Play Again */}
      {battle?.winner && (
        <BattleEndOverlay
          winner={battle.winner}
          rewardInfo={rewardInfo}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted((v) => !v)}
          onPlayAgain={handleRestart}
          onExitToSquad={() => {
            playSfx("uiClick");
            stopMusic();
            setBattle(null);
            setRewardInfo(null);
            setSelectedAttacker(null);
            setPendingSpell(null);
            setActionMessage(null);
          }}
        />
      )}
    </>
  );
}

// ---- View components ----

function HeroHealth({ hero }: { hero: HeroState }) {
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-wide text-emerald-100">HP</span>
        <span className="text-sm font-mono font-semibold text-red-300">
          {Math.max(hero.hp, 0)}/{hero.maxHp}
        </span>
        {hero.armor > 0 && <span className="text-[10px] font-mono text-sky-300">Armor: {hero.armor}</span>}
      </div>
      <div className="h-3 w-20 overflow-hidden rounded-full border border-emerald-700/80 bg-emerald-900">
        <div className="h-full bg-red-500" style={{ width: `${hpPct}%` }} />
      </div>
    </div>
  );
}

function BattleMonsterCardView(props: {
  card: BattleMonsterCard;
  owner: PlayerKey;
  isSelected: boolean;
  onClick?: () => void;
  showStatusOverlay?: boolean;
}) {
  const { card, owner, isSelected, onClick, showStatusOverlay = true } = props;

  const artUrl = card.artUrl || "/cards/base/test.png";

  const rarityBorder = (() => {
    const tier = card.rarityTier;
    switch (tier) {
      case "COMMON":
        return "border-slate-600";
      case "RARE":
        return "border-sky-500/80";
      case "EPIC":
        return "border-purple-500/80";
      case "LEGENDARY":
        return "border-amber-400/90";
      case "MYTHIC":
        return "border-pink-400/90";
      default:
        return "border-slate-600";
    }
  })();

  const positionColor = (() => {
    switch (card.position) {
      case "GK":
        return "bg-emerald-700/90";
      case "DEF":
        return "bg-sky-700/90";
      case "MID":
        return "bg-purple-700/90";
      case "FWD":
        return "bg-rose-700/90";
      default:
        return "bg-slate-700/90";
    }
  })();

  const attack = card.attack;
  const health = card.health;
  const canAttackNow = card.canAttack && card.position !== "DEF";

  const isStunned = (card.stunnedForTurns ?? 0) > 0;

  return (
    <div
      onClick={onClick}
      className={`relative cursor-pointer transition-transform ${
        owner === "player" ? "hover:-translate-y-1" : "hover:translate-y-1"
      } ${isSelected ? "rounded-2xl ring-2 ring-emerald-400" : ""}`}
    >
      <div className={`relative h-32 w-24 overflow-hidden rounded-2xl border ${rarityBorder} bg-slate-900 shadow-md`}>
        <img src={artUrl} alt={card.name} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-950/10" />

        <div className={`absolute left-1 top-1 rounded-full px-2 py-0.5 ${positionColor}`}>
          <span className="text-[9px] font-semibold uppercase text-slate-50">{card.position}</span>
        </div>

        {card.hasBall && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/80 bg-slate-900/95 px-2 py-1 text-[13px] shadow-lg">
            ⚽
          </div>
        )}

        <div className="absolute right-1 top-1 flex flex-col items-end gap-0.5">
          {card.keywords.map((kw) => (
            <span
              key={kw}
              className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${
                kw === "STEALTH" ? "bg-indigo-900/80 text-indigo-200" : "bg-slate-900/80 text-emerald-200"
              }`}
            >
              {kw}
            </span>
          ))}
        </div>

        {typeof card.evolutionLevel === "number" && card.evolutionLevel > 0 && (
          <div className="absolute bottom-9 left-1/2 -translate-x-1/2 text-center text-[9px] text-slate-200">
            Evo {card.evolutionLevel}
          </div>
        )}

        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/80 bg-emerald-900/90">
            <span className="text-[11px] font-bold text-emerald-300">{attack}</span>
          </div>

          <div className="flex min-w-[1.9rem] items-center justify-center rounded-full border border-sky-300/80 bg-sky-500 px-2 shadow">
            <span className="text-[11px] font-bold text-slate-950">{card.manaCost}</span>
          </div>

          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-red-400/80 bg-red-900/90">
            <span className="text-[11px] font-bold text-red-300">{health}</span>
          </div>
        </div>

        {showStatusOverlay && (!canAttackNow || isStunned) && (
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-slate-950/35">
            <div className="absolute inset-x-0 bottom-1 flex justify-center">
              {isStunned ? (
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-amber-100">Stunned</span>
              ) : card.hasSummoningSickness ? (
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-emerald-100">Rest</span>
              ) : card.position !== "DEF" ? (
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-slate-100">Used</span>
              ) : (
                <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-sky-100">Wall</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function renderHand(
  hand: BattleCard[],
  currentMana: number,
  isBattleOver: boolean,
  onPlay: (index: number) => void
) {
  if (hand.length === 0) {
    return (
      <p className="text-[11px] text-slate-400">
        Your hand is empty. Draw more cards with your Hero Power or wait for the next turn.
      </p>
    );
  }

  return hand.map((card, idx) => {
    const isPlayable = !isBattleOver && card.manaCost <= currentMana;
    const disabled = !isPlayable;

    if (card.kind === "MONSTER") {
      const monster = card as BattleMonsterCard;
      const artUrl = monster.artUrl || "/cards/base/test.png";

      const rarityBorder = (() => {
        const tier = monster.rarityTier;
        switch (tier) {
          case "COMMON":
            return "border-slate-600";
          case "RARE":
            return "border-sky-500/80";
          case "EPIC":
            return "border-purple-500/80";
          case "LEGENDARY":
            return "border-amber-400/90";
          case "MYTHIC":
            return "border-pink-400/90";
          default:
            return "border-slate-600";
        }
      })();

      const positionColor = (() => {
        switch (monster.position) {
          case "GK":
            return "bg-emerald-700/90";
          case "DEF":
            return "bg-sky-700/90";
          case "MID":
            return "bg-purple-700/90";
          case "FWD":
            return "bg-rose-700/90";
          default:
            return "bg-slate-700/90";
        }
      })();

      return (
        <button
          key={card.id}
          type="button"
          onClick={() => !disabled && onPlay(idx)}
          disabled={disabled}
          className={`group relative h-32 w-24 rounded-2xl border ${rarityBorder} bg-slate-900 shadow-md transition-transform ${
            disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:-translate-y-1"
          }`}
        >
          <img src={artUrl} alt={monster.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-950/10" />

          <div className={`absolute left-1 top-1 rounded-full px-2 py-0.5 ${positionColor}`}>
            <span className="text-[9px] font-semibold uppercase text-slate-50">{monster.position}</span>
          </div>

          <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/80 bg-emerald-900/90">
              <span className="text-[11px] font-bold text-emerald-300">{monster.attack}</span>
            </div>

            <div className="flex min-w-[1.9rem] items-center justify-center rounded-full border border-sky-300/80 bg-sky-500 px-2 shadow">
              <span className="text-[11px] font-bold text-slate-950">{monster.manaCost}</span>
            </div>

            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-red-400/80 bg-red-900/90">
              <span className="text-[11px] font-bold text-red-300">{monster.health}</span>
            </div>
          </div>
        </button>
      );
    }

    const spell = card as BattleSpellCard;
    const artUrl = spell.artUrl || "/cards/base/test.png";

    return (
      <div key={spell.id} className="group relative">
        <button
          type="button"
          onClick={() => !disabled && onPlay(idx)}
          disabled={disabled}
          className={`relative h-32 w-24 overflow-hidden rounded-2xl border border-indigo-400/80 bg-slate-900 shadow-md transition-transform ${
            disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:-translate-y-1"
          }`}
        >
          <img src={artUrl} alt={spell.name} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-950/10" />

          <div className="absolute left-1 top-1 rounded-full bg-indigo-600/90 px-2 py-0.5">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-50">Spell</span>
          </div>

          <div className="absolute inset-x-1 bottom-1 flex items-center justify-center">
            <div className="flex min-w-[1.9rem] items-center justify-center rounded-full border border-sky-300/80 bg-sky-500 px-2 shadow">
              <span className="text-[11px] font-bold text-slate-950">{spell.manaCost}</span>
            </div>
          </div>
        </button>

        <div className="pointer-events-none absolute -top-1 left-1/2 z-20 hidden w-56 -translate-x-1/2 -translate-y-full flex-col rounded-xl border border-slate-700 bg-slate-950/95 p-2 text-left shadow-xl group-hover:flex">
          <p className="text-[11px] font-semibold text-indigo-100">{spell.name}</p>
          <p className="mt-1 text-[10px] text-slate-200">{spell.description}</p>
          <p className="mt-1 text-[9px] text-slate-400">
            Mana cost: <span className="font-mono text-sky-300">{spell.manaCost}</span>
          </p>
        </div>
      </div>
    );
  });
}

function DeckSelectionCard(props: {
  monster: UserMonsterDTO;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { monster, selected, disabled, onToggle } = props;
  const artUrl = getArtUrlForMonster(monster);

  const rarityTier = normalizeRarity(monster.rarity);
  const rarityBorder = (() => {
    switch (rarityTier) {
      case "COMMON":
        return "border-slate-600";
      case "RARE":
        return "border-sky-500/80";
      case "EPIC":
        return "border-purple-500/80";
      case "LEGENDARY":
        return "border-amber-400/90";
      case "MYTHIC":
        return "border-pink-400/90";
      default:
        return "border-slate-600";
    }
  })();

  const positionColor = (() => {
    switch (monster.position) {
      case "GK":
        return "bg-emerald-700/90";
      case "DEF":
        return "bg-sky-700/90";
      case "MID":
        return "bg-purple-700/90";
      case "FWD":
        return "bg-rose-700/90";
      default:
        return "bg-slate-700/90";
    }
  })();

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`group relative flex items-stretch gap-2 rounded-2xl border ${rarityBorder} bg-slate-900/80 p-2 text-left shadow-md transition ${
        disabled && !selected
          ? "cursor-not-allowed opacity-40"
          : "cursor-pointer hover:-translate-y-1 hover:border-emerald-400"
      }`}
    >
      <div className="relative h-20 w-16 overflow-hidden rounded-xl">
        <img src={artUrl} alt={monster.displayName || monster.realPlayerName} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-slate-950/10" />
        <div className={`absolute left-1 top-1 rounded-full px-2 py-0.5 ${positionColor}`}>
          <span className="text-[9px] font-semibold uppercase text-slate-50">{monster.position}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div className="space-y-0.5">
          <p className="truncate text-[12px] font-semibold text-slate-100">
            {monster.displayName || monster.realPlayerName}
          </p>
          <p className="truncate text-[10px] text-slate-400">{monster.club}</p>
          <p className="text-[10px] text-slate-400">
            ATK {monster.baseAttack} • MAG {monster.baseMagic} • DEF {monster.baseDefense}
          </p>
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px]">
          <span className="rounded-full bg-slate-800/90 px-2 py-0.5 text-slate-200">{monster.rarity}</span>
          {typeof monster.evolutionLevel === "number" && monster.evolutionLevel > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-200">Evo {monster.evolutionLevel}</span>
          )}
        </div>
      </div>

      <div className="absolute right-2 top-2">
        {selected ? (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-semibold text-slate-950">
            In XI
          </span>
        ) : monster.position === "GK" ? (
          <span className="rounded-full bg-emerald-900/80 px-2 py-0.5 text-[9px] text-emerald-200">GK (hero only)</span>
        ) : (
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[9px] text-slate-200">Tap to add</span>
        )}
      </div>
    </button>
  );
}

function BattleEndOverlay(props: {
  winner: PlayerKey | "DRAW";
  rewardInfo: {
    requested: number;
    granted: number;
    capRemaining: number;
    status: "IDLE" | "GRANTED" | "ERROR";
    message?: string;
  } | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onPlayAgain: () => void;
  onExitToSquad: () => void;
}) {
  const { winner, rewardInfo, isMuted, onToggleMute, onPlayAgain, onExitToSquad } = props;

  const title =
    winner === "DRAW" ? "Draw" : winner === "player" ? "You win!" : "You lose";

  const rewardLine =
    winner === "player"
      ? `+${SINGLE_WIN_COINS} coins (single-player win)`
      : winner === "DRAW"
      ? `+${SINGLE_DRAW_COINS} coins (draw)`
      : `No coins for a loss`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/40 bg-slate-950/90 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-emerald-200">{title}</h2>
            <p className="mt-1 text-[12px] text-slate-300">{rewardLine}</p>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800"
          >
            {isMuted ? "Unmute" : "Mute"}
          </button>
        </div>

        <div className="mt-4 space-y-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <p className="text-[11px] text-slate-200">
            Daily cap (single-player): <span className="font-mono font-semibold">{SINGLE_DAILY_COIN_CAP}</span> coins
          </p>
          <p className="text-[11px] text-slate-200">
            Remaining today:{" "}
            <span className="font-mono font-semibold">
              {rewardInfo ? rewardInfo.capRemaining : "…"}
            </span>
          </p>

          {winner !== "opponent" && (
            <p className="text-[11px] text-emerald-200">
              Awarded:{" "}
              <span className="font-mono font-semibold">
                {rewardInfo ? rewardInfo.granted : "…"}
              </span>{" "}
              coins
              {rewardInfo?.message ? (
                <span className="ml-2 text-[11px] text-amber-200">({rewardInfo.message})</span>
              ) : null}
            </p>
          )}

          {rewardInfo?.status === "ERROR" && (
            <p className="text-[11px] text-red-300">
              Server sync failed — check /api/me/coins/earn (local cap tracking still applied).
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onExitToSquad}
            className="rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800"
          >
            Change XI
          </button>
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-2xl border border-emerald-400 bg-emerald-400 px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-emerald-300"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
