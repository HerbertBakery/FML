// app/battle/match/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

type Keyword = "TAUNT" | "RUSH";

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
  | "DRAW_CARDS";

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
  return (
    m.baseAttack + m.baseMagic + m.baseDefense + m.evolutionLevel * 2
  );
}

// ---- Build battle cards from your monsters ----

function buildMonsterCard(m: UserMonsterDTO): BattleMonsterCard {
  const rarityTier = normalizeRarity(m.rarity);
  const manaCost = manaFromRarity(rarityTier);
  const baseStats = ratingForMonster(m);

  const attack =
    m.baseAttack +
    Math.floor(m.evolutionLevel / 2) +
    (rarityTier === "LEGENDARY" || rarityTier === "MYTHIC" ? 1 : 0);

  const health =
    m.baseDefense +
    5 +
    Math.floor(m.evolutionLevel / 2) +
    (rarityTier === "MYTHIC" ? 3 : 0);

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
  const baseHp = 300;
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
      description:
        "Your Goalkeeper restores 30 health (up to their max HP).",
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
      description:
        "Reinforce your Goalkeeper. Gain 25 armor on your Goalkeeper.",
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
      description:
        "A miracle stop. Heal 40 health on your Goalkeeper.",
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
    // Small buffs / sustain
    {
      kind: "SPELL",
      name: "Quick Bandage",
      description: "Patch things up. Heal 15 health on your Goalkeeper.",
      manaCost: 2,
      effect: "HEAL_HERO",
      value: 15,
      artUrl: "/cards/spells/quick-bandage.png",
    },
    {
      kind: "SPELL",
      name: "Crowd Shield",
      description:
        "The fans form a wall. Gain 10 armor and heal 10 HP on your Goalkeeper.",
      manaCost: 2,
      effect: "SHIELD_HERO",
      value: 20, // 10 armor + 10 heal
      artUrl: "/cards/spells/crowd-shield.png",
    },
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
      m.position !== "DEF" &&
      !hasSummoningSickness &&
      stunnedForTurns === 0;

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

// *** Simplified + safer attack logic ***
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
  const log = [...state.log];

  const defenderIndices = findDefenderIndices(defenderPlayer.board);
  const hasDefenders = defenderIndices.length > 0;

  if (targetType === "HERO") {
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

    // Midfielder attacking the Goalkeeper deals damage but is killed.
    if (attacker.position === "MID") {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} is a Midfielder and is removed from play after the shot.`
      );
      newAttackerBoard.splice(attackerIndex, 1);
    } else if (attacker.bypassDefendersOnce) {
      attacker = {
        ...attacker,
        bypassDefendersOnce: false,
      };
    }
  } else if (
    targetType === "MINION" &&
    typeof targetIndex === "number" &&
    defenderPlayer.board[targetIndex]
  ) {
    const target = defenderPlayer.board[targetIndex];

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

    if (newTarget.health <= 0) {
      newDefenderBoard.splice(targetIndex, 1);
    } else {
      newDefenderBoard[targetIndex] = newTarget;
    }

    if (newAttacker.health <= 0) {
      newAttackerBoard.splice(attackerIndex, 1);
      attacker = newAttacker;
    } else {
      newAttacker.canAttack = false;
      newAttackerBoard[attackerIndex] = newAttacker;
      attacker = newAttacker;
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
      attackerOwner === "player"
        ? updatedAttackerPlayer
        : updatedDefenderPlayer,
    opponent:
      attackerOwner === "player"
        ? updatedDefenderPlayer
        : updatedAttackerPlayer,
    log,
  };

  if (next.player.hero.hp <= 0 && next.opponent.hero.hp <= 0) {
    next = { ...next, winner: "DRAW" };
  } else if (next.player.hero.hp <= 0) {
    next = { ...next, winner: "opponent" };
  } else if (next.opponent.hero.hp <= 0) {
    next = { ...next, winner: "player" };
  }

  return next;
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
  const log = [...state.log];

  if (card.kind === "MONSTER") {
    const hasSummoningSickness = !card.keywords.includes("RUSH");
    const canAttack =
      card.position !== "DEF" && card.keywords.includes("RUSH");

    const monster: BattleMonsterCard = {
      ...card,
      hasSummoningSickness,
      canAttack,
      stunnedForTurns: 0,
    };
    newActing.board = [...newActing.board, monster];
    log.push(`${acting.label} played ${monster.name} (${monster.position})`);
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
    }

    // After any spell, check if someone died
    let nextAfterSpell: BattleState =
      playerKey === "player"
        ? {
            ...state,
            player: newActing,
            opponent: newOther,
            log,
          }
        : {
            ...state,
            opponent: newActing,
            player: newOther,
            log,
          };

    if (nextAfterSpell.player.hero.hp <= 0 && nextAfterSpell.opponent.hero.hp <= 0) {
      nextAfterSpell = { ...nextAfterSpell, winner: "DRAW" };
    } else if (nextAfterSpell.player.hero.hp <= 0) {
      nextAfterSpell = { ...nextAfterSpell, winner: "opponent" };
    } else if (nextAfterSpell.opponent.hero.hp <= 0) {
      nextAfterSpell = { ...nextAfterSpell, winner: "player" };
    }

    return nextAfterSpell;
  }

  return playerKey === "player"
    ? {
        ...state,
        player: newActing,
        opponent: newOther,
        log,
      }
    : {
        ...state,
        opponent: newActing,
        player: newOther,
        log,
      };
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

// ---- AI TURN: fixed to avoid infinite loop ----
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
        const hasMidfielder = s.opponent.board.some(
          (m) => m.position === "MID"
        );
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
  // If you have defenders on the enemy board, hit them.
  // Otherwise, go face.
  s.opponent.board.forEach((m, idx) => {
    if (!m.canAttack) return;

    const defenderIndices = findDefenderIndices(s.player.board);
    if (defenderIndices.length > 0) {
      const targetIdx = defenderIndices[0];
      s = applyAttack(s, "opponent", idx, "MINION", targetIdx);
    } else {
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

function createInitialBattleFromXI(
  xi: UserMonsterDTO[],
  heroMonster: UserMonsterDTO
): BattleState {
  const hero = buildHeroFromGK(heroMonster);
  return createBattleFromBase(xi, hero);
}

function createBattleFromBase(
  xi: UserMonsterDTO[],
  hero: HeroState
): BattleState {
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
  const [selectedAttacker, setSelectedAttacker] = useState<number | null>(
    null
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [turnTimer, setTurnTimer] = useState<number>(TURN_DURATION);

  // Pre-game XI selection
  const [deckSelection, setDeckSelection] = useState<string[]>([]); // outfield only
  const [deckError, setDeckError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] =
    useState<PositionFilter>("ALL");
  const [heroId, setHeroId] = useState<string | null>(null); // selected GK hero
  const [formationId, setFormationId] = useState<string>(
    FORMATIONS[0].id
  );
  const maxDeckSize = OUTFIELD_REQUIRED; // 10 outfield

  // PvP queue state (only meaningful when isPvP = true)
  const [queueStatus, setQueueStatus] = useState<QueueStatus>("IDLE");
  const [queueError, setQueueError] = useState<string | null>(null);

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
    () =>
      FORMATIONS.find((f) => f.id === formationId) ?? FORMATIONS[0],
    [formationId]
  );

  // Auto-pick XI once collection is loaded (formation-based), only if nothing picked yet
  useEffect(() => {
    if (
      !loading &&
      !error &&
      collection.length > 0 &&
      deckSelection.length === 0 &&
      !heroId
    ) {
      const result = autoPickForFormation(collection, activeFormation);
      setDeckSelection(result.deckIds);
      setHeroId(result.heroId);
    }
  }, [
    loading,
    error,
    collection,
    deckSelection.length,
    heroId,
    activeFormation,
  ]);

  // Turn timer for single-player battle
  useEffect(() => {
    if (!battle || battle.winner) return;

    setTurnTimer(TURN_DURATION);
    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
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

  const heroCandidates = useMemo(
    () => collection.filter((m) => m.position === "GK"),
    [collection]
  );

  const deckCounts = useMemo(() => {
    const c: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    for (const m of selectedMonstersForDeck) {
      if (c[m.position] !== undefined) c[m.position]++;
    }
    return c;
  }, [selectedMonstersForDeck]);

  const filteredCollection = useMemo(
    () =>
      collection.filter((m) =>
        positionFilter === "ALL" ? true : m.position === positionFilter
      ),
    [collection, positionFilter]
  );

  const totalSelectedCount =
    deckSelection.length + (heroId ? 1 : 0); // outfield + GK hero

  const handleToggleDeckMonster = (id: string) => {
    setDeckError(null);
    setActionMessage(null);
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
    const result = autoPickForFormation(collection, activeFormation);
    setDeckSelection(result.deckIds);
    setHeroId(result.heroId);
  };

  const handleStartBattle = async () => {
    setDeckError(null);
    setActionMessage(null);
    setQueueError(null);

    if (deckSelection.length !== OUTFIELD_REQUIRED) {
      setDeckError(
        `You must pick exactly ${OUTFIELD_REQUIRED} outfield monsters to start the battle.`
      );
      return;
    }

    if (!heroId) {
      setDeckError(
        "You must choose a Goalkeeper hero for your XI before starting."
      );
      return;
    }

    if (totalSelectedCount !== TOTAL_XI) {
      setDeckError(
        `You must have exactly ${TOTAL_XI} players selected (1 GK hero + ${OUTFIELD_REQUIRED} outfield).`
      );
      return;
    }

    const xiOutfield = collection.filter((m) =>
      deckSelection.includes(m.id)
    );
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

    // --- PvP mode: join queue instead of creating a local AI battle ---
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
    setBattle(next);
  };

  const handlePlayCard = (handIndex: number) => {
    if (!battle) return;
    if (battle.winner) return;

    const actingKey: PlayerKey = battle.active;
    const acting =
      actingKey === "player" ? battle.player : battle.opponent;
    const card = acting.hand[handIndex];

    if (card && card.kind === "MONSTER" && acting.board.length >= 3) {
      setActionMessage(
        "You already have 3 monsters on the pitch. (Max 3 per side.)"
      );
      return;
    }

    if (card && card.kind === "MONSTER" && card.position === "FWD") {
      const hasMidfielder = acting.board.some(
        (m) => m.position === "MID"
      );
      if (!hasMidfielder) {
        setActionMessage(
          "You need a Midfielder on your side of the pitch before you can play a Forward."
        );
        return;
      }
    }

    setSelectedAttacker(null);
    setActionMessage(null);
    setBattle((prev) =>
      prev ? playCardFromHand(prev, actingKey, handIndex) : prev
    );
  };

  const handleSelectAttacker = (idx: number) => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
      return;
    }
    const m = battle.player.board[idx];
    if (!m) return;
    if (!m.canAttack) {
      setActionMessage("This monster can’t attack right now.");
      return;
    }
    if (m.position === "DEF") {
      setActionMessage("Defenders block but cannot attack.");
      return;
    }
    setActionMessage(null);
    setSelectedAttacker(idx === selectedAttacker ? null : idx);
  };

  const handleAttackHero = () => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
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

    const opponentHasDefender = battle.opponent.board.some(
      (m) => m.position === "DEF"
    );

    if (opponentHasDefender) {
      setActionMessage(
        "You must attack the defenders before you can target the Goalkeeper."
      );
      return;
    }

    setActionMessage(null);
    setBattle((prev) =>
      prev ? applyAttack(prev, "player", selectedAttacker, "HERO") : prev
    );
    setSelectedAttacker(null);
  };

  const handleAttackMinion = (enemyIdx: number) => {
    if (!battle) return;
    if (battle.winner) return;
    if (battle.active !== "player") {
      setActionMessage("It is not your turn.");
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

    const opponentHasDefender = battle.opponent.board.some(
      (m) => m.position === "DEF"
    );
    if (opponentHasDefender && enemy.position !== "DEF") {
      setActionMessage(
        "While defenders are on the pitch, you must target a defender."
      );
      return;
    }

    setActionMessage(null);
    setBattle((prev) =>
      prev
        ? applyAttack(prev, "player", selectedAttacker, "MINION", enemyIdx)
        : prev
    );
    setSelectedAttacker(null);
  };

  const handleEndTurn = () => {
    setSelectedAttacker(null);
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
    if (battle.player.mana < HERO_POWER_COST) {
      setActionMessage(
        `Not enough mana. Hero Power costs ${HERO_POWER_COST}.`
      );
      return;
    }
    setActionMessage(null);
    setSelectedAttacker(null);
    setBattle((prev) => (prev ? useHeroPower(prev, "player") : prev));
  };

  const handleRestart = () => {
    if (deckSelection.length === OUTFIELD_REQUIRED && heroId) {
      const xiOutfield = collection.filter((m) =>
        deckSelection.includes(m.id)
      );
      const heroMonster = collection.find((m) => m.id === heroId);
      if (
        xiOutfield.length === OUTFIELD_REQUIRED &&
        heroMonster &&
        heroMonster.position === "GK"
      ) {
        const next = createInitialBattleFromXI(xiOutfield, heroMonster);
        setSelectedAttacker(null);
        setActionMessage(null);
        setBattle(next);
        return;
      }
    }
    // Fallback: if for some reason GK or XI invalid, go back to squad selection
    setBattle(null);
    setActionMessage(
      "Your XI or Goalkeeper selection is no longer valid. Please re-pick your squad."
    );
  };

  const playerBoard = battle?.player.board ?? [];
  const opponentBoard = battle?.opponent.board ?? [];
  const logView = useMemo(() => battle?.log.slice(-8) ?? [], [battle]);

  if (loading) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
          <p className="text-sm text-slate-200">Loading battle mode…</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-red-500/40 bg-red-950/60 p-4">
          <h2 className="mb-1 text-sm font-semibold text-red-200">
            Battle mode error
          </h2>
          <p className="mb-2 text-xs text-red-200">{error}</p>
          <p className="text-xs text-red-100">
            Make sure you&apos;re logged in and have at least a few monsters in
            your collection.
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
            You don&apos;t have any monsters yet. Open some packs before
            entering battle.
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
              <h2 className="text-lg font-semibold text-emerald-100">
                Pick your XI for Battle Mode
              </h2>
              <p className="text-[11px] text-emerald-200">
                Choose 10 outfield monsters and 1 Goalkeeper hero from your FML
                collection to form your XI.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/60 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold text-emerald-200">
              Vs AI
            </div>
          </div>

          <p className="text-[10px] text-emerald-300">
            You play as Player 1 against an AI-controlled Player 2.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-emerald-100">
            <span>
              Selected:{" "}
              <span className="font-mono font-semibold">
                {totalSelectedCount}/{TOTAL_XI}
              </span>
            </span>
            <span>
              GK:{" "}
              <span className="font-mono">{heroId ? 1 : 0}</span>
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
                You don&apos;t have any Goalkeepers yet. Open more packs to
                unlock a GK hero.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={heroId ?? ""}
                  onChange={(e) =>
                    setHeroId(e.target.value || null)
                  }
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

          {deckError && (
            <p className="mt-1 text-[11px] text-red-300">{deckError}</p>
          )}

          {/* Start button */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleStartBattle}
              disabled={
                deckSelection.length !== OUTFIELD_REQUIRED || !heroId
              }
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
              <h3 className="mb-1 text-sm font-semibold text-slate-100">
                Your collection
              </h3>
              <p className="mb-2 text-[11px] text-slate-400">
                Tap cards to add/remove them from your XI. Max{" "}
                {OUTFIELD_REQUIRED} outfield monsters. Goalkeepers are chosen
                as your hero and cannot be used as outfield cards.
              </p>
            </div>
            {/* Position filter */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {(["ALL", "GK", "DEF", "MID", "FWD"] as PositionFilter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPositionFilter(f)}
                    className={`rounded-full px-2 py-0.5 ${
                      positionFilter === f
                        ? "bg-emerald-400 text-slate-950"
                        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {f === "ALL" ? "All" : f}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {filteredCollection.map((monster) => {
              const selected = deckSelection.includes(monster.id);
              const isGK = monster.position === "GK";
              const disabledBase =
                !selected && deckSelection.length >= maxDeckSize;
              // Goalkeepers can never be selected into the outfield XI
              const disabled = disabledBase || isGK;
              return (
                <DeckSelectionCard
                  key={monster.id}
                  monster={monster}
                  selected={!!selected}
                  disabled={disabled}
                  onToggle={() =>
                    !disabled && handleToggleDeckMonster(monster.id)
                  }
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
        <section className="space-y-3 rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-100">
                Pick your XI for Online PvP
              </h2>
              <p className="text-[11px] text-emerald-200">
                Choose 10 outfield monsters and 1 Goalkeeper hero from your FML
                collection. Once ready, you&apos;ll join the online queue and be
                matched against another manager.
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/60 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold text-emerald-200">
              Online PvP
            </div>
          </div>

          <p className="text-[10px] text-emerald-300">
            You&apos;ll take this XI into a real-time PvP battle. When a match
            is found, we&apos;ll drop you straight into the pitch.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-emerald-100">
            <span>
              Selected:{" "}
              <span className="font-mono font-semibold">
                {totalSelectedCount}/{TOTAL_XI}
              </span>
            </span>
            <span>
              GK:{" "}
              <span className="font-mono">{heroId ? 1 : 0}</span>
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
                You don&apos;t have any Goalkeepers yet. Open more packs to
                unlock a GK hero.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={heroId ?? ""}
                  onChange={(e) =>
                    setHeroId(e.target.value || null)
                  }
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

          {deckError && (
            <p className="mt-1 text-[11px] text-red-300">{deckError}</p>
          )}
          {queueError && (
            <p className="mt-1 text-[11px] text-red-300">{queueError}</p>
          )}
          {isSearching && (
            <p className="mt-1 text-[10px] text-emerald-200">
              Searching for opponent… keep this tab open. You&apos;ll jump into
              the match as soon as another manager is ready.
            </p>
          )}

          {/* Find Match button */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleStartBattle}
              disabled={
                deckSelection.length !== OUTFIELD_REQUIRED ||
                !heroId ||
                isSearching
              }
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                deckSelection.length !== OUTFIELD_REQUIRED ||
                !heroId ||
                isSearching
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
              <h3 className="mb-1 text-sm font-semibold text-slate-100">
                Your collection
              </h3>
              <p className="mb-2 text-[11px] text-slate-400">
                Tap cards to add/remove them from your XI. Max{" "}
                {OUTFIELD_REQUIRED} outfield monsters. Goalkeepers are chosen
                as your hero and cannot be used as outfield cards.
              </p>
            </div>
            {/* Position filter */}
            <div className="flex flex-wrap gap-1 text-[10px]">
              {(["ALL", "GK", "DEF", "MID", "FWD"] as PositionFilter[]).map(
                (f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPositionFilter(f)}
                    className={`rounded-full px-2 py-0.5 ${
                      positionFilter === f
                        ? "bg-emerald-400 text-slate-950"
                        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {f === "ALL" ? "All" : f}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {filteredCollection.map((monster) => {
              const selected = deckSelection.includes(monster.id);
              const isGK = monster.position === "GK";
              const disabledBase =
                !selected && deckSelection.length >= maxDeckSize;
              const disabled = disabledBase || isGK;
              return (
                <DeckSelectionCard
                  key={monster.id}
                  monster={monster}
                  selected={!!selected}
                  disabled={disabled}
                  onToggle={() =>
                    !disabled && handleToggleDeckMonster(monster.id)
                  }
                />
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  // ---- Main battle UI (single-player vs AI only) ----
  const opponentHeroArt =
    battle!.opponent.hero.artUrl ?? "/cards/base/test.png";
  const playerHeroArt =
    battle!.player.hero.artUrl ?? "/cards/base/test.png";

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
        {/* Top controls: mana + timer + Hero Power + End Turn + Restart */}
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] text-slate-300">
              Turn{" "}
              <span className="font-mono font-semibold text-slate-50">
                {battle!.turn}
              </span>{" "}
              • Active:{" "}
              <span className="font-semibold text-emerald-300">
                {battle!.active === "player" ? "You" : "Opponent (AI)"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {/* Mana indicator */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-sky-200">
                  Mana
                </span>
                <div className="flex gap-1">
                  {Array.from({
                    length: Math.max(battle!.player.maxMana, 1),
                  }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-4 w-3 rounded-full border border-sky-400/60 shadow-sm ${
                        i < battle!.player.mana
                          ? "bg-sky-400/90"
                          : "bg-slate-800"
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
                <span className="text-[10px] uppercase tracking-wide text-amber-200">
                  Turn timer
                </span>
                <div className="relative h-5 w-24 overflow-hidden rounded-full border border-amber-400/60 bg-slate-800">
                  <div
                    className={`h-full ${
                      turnTimer <= 5 ? "bg-red-500" : "bg-amber-400"
                    }`}
                    style={{
                      width: `${
                        (Math.max(turnTimer, 0) / TURN_DURATION) * 100
                      }%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center font-mono text-[11px] text-slate-950">
                    {Math.max(turnTimer, 0)}s
                  </div>
                </div>
              </div>
            </div>
            {battle!.winner && (
              <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                {battle!.winner === "DRAW"
                  ? "Draw!"
                  : battle!.winner === "player"
                  ? "You win!"
                  : "Opponent wins!"}
              </p>
            )}
            {actionMessage && (
              <p className="mt-1 text-[11px] text-amber-300">
                {actionMessage}
              </p>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={
                !!battle!.winner ||
                battle!.active !== "player" ||
                battle!.player.mana < HERO_POWER_COST
              }
              onClick={handleHeroPowerClick}
              className="rounded-full border border-emerald-500/70 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Hero Power (3 Mana)
            </button>

            <button
              type="button"
              disabled={!!battle!.winner}
              onClick={handleEndTurn}
              className="rounded-full border border-slate-500/70 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              End Turn
            </button>

            <button
              type="button"
              onClick={handleRestart}
              className="rounded-full border border-emerald-500/70 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
            >
              Restart Battle
            </button>
          </div>
        </section>

        {/* Shared pitch */}
        <section className="relative space-y-4 overflow-hidden rounded-3xl border border-emerald-500/60 bg-gradient-to-b from-emerald-900 via-emerald-950 to-emerald-900 p-4">
          {/* Pitch markings */}
          <div className="pointer-events-none absolute inset-4 rounded-[32px] border border-emerald-600/40" />
          <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px -translate-y-1/2 border-t border-emerald-500/50" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-500/40" />
          <div className="pointer-events-none absolute inset-x-10 top-6 h-16 rounded-[999px] border border-emerald-500/40" />
          <div className="pointer-events-none absolute inset-x-10 bottom-6 h-16 rounded-[999px] border border-emerald-500/40" />

          <div className="relative flex flex-col gap-6">
            {/* Opponent GK (click to shoot) */}
            <button
              type="button"
              onClick={handleAttackHero}
              className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-900/50 px-3 py-3 text-center transition hover:border-emerald-300 hover:bg-emerald-800/60"
            >
              <div className="flex flex-col items-center gap-1">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-emerald-400 bg-emerald-700/60 shadow-lg">
                  <img
                    src={opponentHeroArt}
                    alt={battle!.opponent.hero.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-950/70" />
                  <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950">
                    GK
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-100">
                  {battle!.opponent.hero.name}
                </p>
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
                      if (
                        battle!.active === "player" &&
                        selectedAttacker !== null
                      ) {
                        handleAttackMinion(idx);
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
                    onClick={() => handleSelectAttacker(idx)}
                    showStatusOverlay
                  />
                ))
              )}
            </div>

            {/* Player GK */}
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-900/50 px-3 py-3 text-center">
              <div className="flex flex-col items-center gap-1">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-emerald-400 bg-emerald-700/60 shadow-lg">
                  <img
                    src={playerHeroArt}
                    alt={battle!.player.hero.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-950/70" />
                  <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950">
                    GK
                  </div>
                </div>
                <p className="text-[11px] font-semibold text-emerald-100">
                  {battle!.player.hero.name}
                </p>
              </div>
              <HeroHealth hero={battle!.player.hero} />
            </div>
          </div>
        </section>

        {/* Hand */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="mb-1 text-[11px] text-slate-300">
            Your hand (Player 1)
          </p>
          <div className="flex flex-wrap gap-2">
            {renderHand(
              battle!.player.hand,
              battle!.player.mana,
              !!battle!.winner,
              (idx) => handlePlayCard(idx)
            )}
          </div>
        </section>

        {/* Log */}
        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
          <p className="mb-1 text-[11px] font-semibold text-slate-100">
            Battle log
          </p>
          {logView.length === 0 ? (
            <p className="text-[11px] text-slate-400">
              Actions will appear here as the battle unfolds.
            </p>
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
    </>
  );
}

// ---- View components ----

function HeroHealth({ hero }: { hero: HeroState }) {
  const hpPct = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-wide text-emerald-100">
          HP
        </span>
        <span className="text-sm font-mono font-semibold text-red-300">
          {Math.max(hero.hp, 0)}/{hero.maxHp}
        </span>
        {hero.armor > 0 && (
          <span className="text-[10px] font-mono text-sky-300">
            Armor: {hero.armor}
          </span>
        )}
      </div>
      <div className="h-3 w-20 overflow-hidden rounded-full border border-emerald-700/80 bg-emerald-900">
        <div
          className="h-full bg-red-500"
          style={{ width: `${hpPct}%` }}
        />
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
  const { card, owner, isSelected, onClick, showStatusOverlay = true } =
    props;

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
      <div
        className={`relative h-32 w-24 overflow-hidden rounded-2xl border ${rarityBorder} bg-slate-900 shadow-md`}
      >
        {/* Full art */}
        <img
          src={artUrl}
          alt={card.name}
          className="absolute inset-0 h-full w-full object-cover"
        />

        {/* Dark gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/40 to-slate-950/10" />

        {/* Position chip */}
        <div
          className={`absolute left-1 top-1 rounded-full px-2 py-0.5 ${positionColor}`}
        >
          <span className="text-[9px] font-semibold uppercase text-slate-50">
            {card.position}
          </span>
        </div>

        {/* Keywords */}
        <div className="absolute right-1 top-1 flex flex-col items-end gap-0.5">
          {card.keywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] uppercase tracking-wide text-emerald-200"
            >
              {kw}
            </span>
          ))}
        </div>

        {/* Evo mini text (moved a bit up to avoid bottom row) */}
        {typeof card.evolutionLevel === "number" &&
          card.evolutionLevel > 0 && (
            <div className="absolute bottom-9 left-1/2 -translate-x-1/2 text-center text-[9px] text-slate-200">
              Evo {card.evolutionLevel}
            </div>
          )}

        {/* Bottom row: Attack / Mana / Health */}
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
          {/* Attack */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/80 bg-emerald-900/90">
            <span className="text-[11px] font-bold text-emerald-300">
              {attack}
            </span>
          </div>

          {/* Mana pill (blue) in the bottom middle */}
          <div className="flex min-w-[1.9rem] items-center justify-center rounded-full border border-sky-300/80 bg-sky-500 px-2 shadow">
            <span className="text-[11px] font-bold text-slate-950">
              {card.manaCost}
            </span>
          </div>

          {/* Health */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-red-400/80 bg-red-900/90">
            <span className="text-[11px] font-bold text-red-300">
              {health}
            </span>
          </div>
        </div>

        {/* Status overlay */}
        {showStatusOverlay && (!canAttackNow || isStunned) && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center rounded-2xl bg-slate-950/35 pb-1">
            {isStunned ? (
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-amber-100">
                Stunned
              </span>
            ) : card.hasSummoningSickness ? (
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-emerald-100">
                Summoning sickness
              </span>
            ) : card.position !== "DEF" ? (
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-slate-100">
                Used
              </span>
            ) : (
              <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[9px] text-sky-100">
                Wall
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function renderHand(
  hand: BattleCard[],
  manaAvailable: number,
  battleOver: boolean,
  onPlay: (index: number) => void
) {
  if (hand.length === 0) {
    return <p className="text-[11px] text-slate-400">No cards in hand.</p>;
  }

  const isInitialDeal = hand.length <= 3;

  return hand.map((card, idx) => {
    const isDisabled = battleOver || card.manaCost > manaAvailable;

    const dealStyle = isInitialDeal
      ? {
          animation: "deal-in 0.35s ease-out forwards",
          animationDelay: `${idx * 120}ms`,
        }
      : undefined;

    if (card.kind === "MONSTER") {
      return (
        <button
          key={card.id}
          type="button"
          onClick={() => !isDisabled && onPlay(idx)}
          disabled={isDisabled}
          style={dealStyle}
          className={`relative rounded-2xl border border-slate-700 bg-slate-950/80 p-1 text-left text-[11px] transition ${
            isDisabled
              ? "cursor-not-allowed opacity-50"
              : "hover:border-emerald-400"
          }`}
        >
          <BattleMonsterCardView
            card={card}
            owner="player"
            isSelected={false}
            showStatusOverlay={false}
          />
        </button>
      );
    }

    // Spell card – use art if provided
    const spell = card as BattleSpellCard;
    const spellArtUrl =
      spell.artUrl || "/cards/spells/default-spell.png";

    return (
      <button
        key={card.id}
        type="button"
        onClick={() => !isDisabled && onPlay(idx)}
        disabled={isDisabled}
        style={dealStyle}
        className={`relative h-28 w-20 overflow-hidden rounded-2xl border text-left text-[11px] transition bg-slate-900 ${
          isDisabled
            ? "cursor-not-allowed border-slate-800 opacity-50"
            : "border-purple-500/70 hover:border-emerald-400"
        }`}
      >
        {/* Art background */}
        <div className="absolute inset-0">
          <img
            src={spellArtUrl}
            alt={spell.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/60 to-slate-950/90" />
        </div>

        {/* Mana crystal (still at top for spells – only monsters changed) */}
        <div className="absolute -top-2 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-sky-300/80 bg-sky-500 shadow">
          <span className="text-[10px] font-bold text-slate-950">
            {spell.manaCost}
          </span>
        </div>

        <div className="relative z-10 mt-3 px-2 leading-tight text-slate-50 line-clamp-2">
          {spell.name}
        </div>
        <div className="relative z-10 mt-1 px-2 text-[10px] text-slate-300 line-clamp-4">
          {spell.description}
        </div>
      </button>
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

  const rarityText =
    monster.rarity && monster.rarity.length > 0
      ? monster.rarity.toUpperCase()
      : "";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled && !selected}
      className={`relative overflow-hidden rounded-2xl border text-left text-xs transition ${
        selected
          ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/70"
          : disabled
          ? "cursor-not-allowed border-slate-800 bg-slate-950/60 opacity-60"
          : "border-slate-700 bg-slate-950/80 hover:border-emerald-400"
      }`}
    >
      <div className="relative h-52 w-full bg-slate-950">
        {/* Full monster art – no crop (object-contain) */}
        <img
          src={artUrl}
          alt={monster.displayName || monster.realPlayerName}
          className="h-full w-full object-contain"
        />

        {/* Soft overlay for text readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/20 to-slate-950/10" />

        {/* Position chip */}
        <div
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 ${positionColor}`}
        >
          <span className="text-[9px] font-semibold uppercase text-slate-50">
            {monster.position}
          </span>
        </div>

        {/* Rarity tag */}
        {rarityText && (
          <div className="absolute right-2 top-2 rounded-full bg-slate-950/80 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200">
            {rarityText}
          </div>
        )}

        {/* Name + club */}
        <div className="absolute inset-x-2 bottom-11 space-y-0.5">
          <p className="line-clamp-1 text-[10px] font-semibold text-slate-50">
            {monster.displayName || monster.realPlayerName}
          </p>
          <p className="line-clamp-1 text-[9px] text-slate-300">
            {monster.club}
          </p>
          {monster.evolutionLevel > 0 && (
            <p className="text-[9px] text-indigo-300">
              Evo {monster.evolutionLevel}
            </p>
          )}
        </div>

        {/* ATK pill */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-emerald-900/90 px-2 py-0.5">
          <span className="text-[9px] font-semibold uppercase text-emerald-200">
            ATK
          </span>
          <span className="text-[11px] font-bold text-emerald-50">
            {monster.baseAttack}
          </span>
        </div>

        {/* DEF pill */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-red-900/90 px-2 py-0.5">
          <span className="text-[9px] font-semibold uppercase text-red-200">
            DEF
          </span>
          <span className="text-[11px] font-bold text-red-50">
            {monster.baseDefense}
          </span>
        </div>

        {/* Selected badge */}
        {selected && (
          <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-emerald-500/80 px-2 py-0.5 text-[9px] font-semibold text-slate-950">
            In XI
          </div>
        )}
      </div>
    </button>
  );
}
