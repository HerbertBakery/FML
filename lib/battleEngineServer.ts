// lib/battleEngineServer.ts
import { prisma } from "@/lib/db";

export type Position = "GK" | "DEF" | "MID" | "FWD";
export type RarityTier = "COMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
export type Keyword = "TAUNT" | "RUSH";

export type BattleMonsterCard = {
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

  // visual / edition info
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

export type SpellEffectType = "DAMAGE_HERO" | "SHIELD_HERO";

export type BattleSpellCard = {
  id: string;
  kind: "SPELL";
  name: string;
  description: string;
  manaCost: number;
  effect: SpellEffectType;
  value: number;
};

export type BattleCard = BattleMonsterCard | BattleSpellCard;

export type HeroState = {
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  artUrl?: string;
};

export type PlayerKey = "player" | "opponent";

export type PlayerState = {
  key: PlayerKey;
  label: string;
  deck: BattleCard[];
  hand: BattleCard[];
  board: BattleMonsterCard[];
  hero: HeroState;
  mana: number;
  maxMana: number;
};

export type BattleState = {
  player: PlayerState;
  opponent: PlayerState;
  active: PlayerKey;
  turn: number;
  winner: PlayerKey | "DRAW" | null;
  log: string[];
};

// -------- helpers --------

function safeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeRarity(r: string | null | undefined): RarityTier {
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

type DbMonster = {
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
  artBasePath: string | null;
  setCode: string | null;
  editionType: string | null;
  editionLabel: string | null;
  serialNumber: number | null;
};

function getArtUrlForMonster(m: DbMonster): string {
  if (m.artBasePath) return m.artBasePath;
  if (m.templateCode) return `/cards/base/${m.templateCode}.png`;
  return "/cards/base/test.png";
}

function buildMonsterCard(m: DbMonster): BattleMonsterCard {
  const rarityTier = normalizeRarity(m.rarity);
  const manaCost = manaFromRarity(rarityTier);
  const baseStats =
    m.baseAttack + m.baseMagic + m.baseDefense + m.evolutionLevel * 2;

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

function buildHeroFromMonsters(monsters: DbMonster[]): HeroState | null {
  const gks = monsters.filter((m) => m.position === "GK");
  const gk =
    gks.sort(
      (a, b) =>
        b.baseDefense + b.evolutionLevel - (a.baseDefense + a.evolutionLevel)
    )[0] || null;

  if (!gk) return null;

  const baseHp = 300;
  return {
    name: gk.displayName || gk.realPlayerName,
    hp: baseHp,
    maxHp: baseHp,
    armor: 0,
    artUrl: getArtUrlForMonster(gk),
  };
}

function createSpellCards(): BattleSpellCard[] {
  const base: BattleSpellCard[] = [
    {
      id: safeId("spell"),
      kind: "SPELL",
      name: "Power Shot",
      description: "Deal 3 damage to the enemy Goalkeeper.",
      manaCost: 2,
      effect: "DAMAGE_HERO",
      value: 3,
    },
    {
      id: safeId("spell"),
      kind: "SPELL",
      name: "Wall of Roots",
      description: "Give your Goalkeeper 3 armor this turn.",
      manaCost: 2,
      effect: "SHIELD_HERO",
      value: 3,
    },
  ];

  const spells: BattleSpellCard[] = [];
  while (spells.length < 4) {
    const pick = base[Math.floor(Math.random() * base.length)];
    spells.push({ ...pick, id: safeId("spell") });
  }
  return spells;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function autoPickXI(monsters: DbMonster[]): DbMonster[] {
  if (monsters.length <= 11) return monsters;
  const sorted = [...monsters].sort((a, b) => {
    const sa =
      a.baseAttack + a.baseMagic + a.baseDefense + a.evolutionLevel * 2;
    const sb =
      b.baseAttack + b.baseMagic + b.baseDefense + b.evolutionLevel * 2;
    return sb - sa;
  });
  return sorted.slice(0, 11);
}

// -------- core battle helpers (no AI) --------

function drawCard(p: PlayerState): PlayerState {
  if (p.deck.length === 0) return p;
  const [top, ...rest] = p.deck;
  return {
    ...p,
    deck: rest,
    hand: [...p.hand, top],
  };
}

function startTurnInternal(p: PlayerState, turn: number): PlayerState {
  const maxMana = Math.min(10, turn);
  const mana = maxMana;

  const board = p.board.map((m) => {
    const hasSummoningSickness = false;
    const canAttack =
      m.position !== "DEF" &&
      (!m.hasSummoningSickness || m.keywords.includes("RUSH"));

    return {
      ...m,
      hasSummoningSickness,
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

function findTaunts(board: BattleMonsterCard[]): boolean {
  return board.some((m) => m.keywords.includes("TAUNT"));
}

export function findTauntOnBoard(board: BattleMonsterCard[]): boolean {
  return findTaunts(board);
}

// ----------------- ATTACK LOGIC ----------------------

export function applyAttack(
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

  const defendersExist = defenderPlayer.board.some(
    (m) => m.position === "DEF"
  );

  if (targetType === "HERO") {
    const defenderHasTaunt = findTaunts(defenderPlayer.board);
    const hasDefenderWall = defendersExist || defenderHasTaunt;

    if (hasDefenderWall) {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} tried to attack the Goalkeeper but must attack a defender first.`
      );
      return {
        ...state,
        log,
      };
    }

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

    if (attacker.position === "MID") {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} is a Midfielder and is removed from play after shooting at the Goalkeeper.`
      );
      newAttackerBoard.splice(attackerIndex, 1);
      attacker = { ...attacker, health: 0 };
    }
  } else if (
    targetType === "MINION" &&
    typeof targetIndex === "number" &&
    defenderPlayer.board[targetIndex]
  ) {
    const target = defenderPlayer.board[targetIndex];

    if (defendersExist && target.position !== "DEF") {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} must attack a defender while any defenders are on the pitch.`
      );
      return {
        ...state,
        log,
      };
    }

    let newAttacker = { ...attacker };
    let newTarget = { ...target };

    const attackerIsForward = attacker.position === "FWD";
    const targetHasTaunt = target.keywords.includes("TAUNT");
    const targetIsDefender = target.position === "DEF";

    newTarget.health -= attacker.attack;
    if (!(attackerIsForward && (targetHasTaunt || targetIsDefender))) {
      newAttacker.health -= target.attack;
    } else {
      log.push(
        `${attackerPlayer.label}'s ${attacker.name} is a Forward and takes no damage from the defender.`
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

// ----------------- PLAY CARD ----------------------

export function playCardFromHand(
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
    };
    newActing.board = [...newActing.board, monster];
    log.push(`${acting.label} played ${monster.name} (${monster.position})`);
  } else if (card.kind === "SPELL") {
    if (card.effect === "DAMAGE_HERO") {
      let targetHero = { ...other.hero };
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
        `${acting.label} cast ${card.name} for ${card.value} hero damage`
      );
      const updatedOther: PlayerState = {
        ...other,
        hero: targetHero,
      };
      let next: BattleState =
        playerKey === "player"
          ? {
              ...state,
              player: newActing,
              opponent: updatedOther,
              log,
            }
          : {
              ...state,
              opponent: newActing,
              player: updatedOther,
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
    } else if (card.effect === "SHIELD_HERO") {
      const newHero = {
        ...acting.hero,
        armor: acting.hero.armor + card.value,
      };
      newActing.hero = newHero;
      log.push(
        `${acting.label} cast ${card.name} for ${card.value} armor`
      );
    }
  }

  return playerKey === "player"
    ? {
        ...state,
        player: newActing,
        opponent: other,
        log,
      }
    : {
        ...state,
        opponent: newActing,
        player: other,
        log,
      };
}

// ----------------- BATTLE CREATION ----------------------

export async function createInitialBattleForMatch(opts: {
  player1Id: string;
  player2Id: string;
}): Promise<BattleState> {
  // Build an XI for a given user:
  // - Use all their monsters (from squad or collection)
  // - Hero = GK only
  // - Deck XI = outfield only (no GK in cards)
  async function getXIForUser(userId: string): Promise<{
    xiOutfield: DbMonster[];
    hero: HeroState | null;
  }> {
    const squad = await prisma.squad.findUnique({
      where: { userId },
      include: {
        slots: {
          include: {
            userMonster: true,
          },
        },
      },
    });

    let mons: DbMonster[] = [];

    if (squad && squad.slots.length > 0) {
      mons = squad.slots
        .map((slot: any) => slot.userMonster)
        .filter(Boolean) as DbMonster[];
    }

    if (!mons.length) {
      const userMonsters = await prisma.userMonster.findMany({
        where: { userId, isConsumed: false },
        orderBy: { createdAt: "desc" },
      });
      mons = userMonsters as any as DbMonster[];
    }

    const hero = buildHeroFromMonsters(mons);
    const outfieldMons = mons.filter((m) => m.position !== "GK");
    const xiOutfield = autoPickXI(outfieldMons);

    return { xiOutfield, hero };
  }

  const [p1Data, p2Data] = await Promise.all([
    getXIForUser(opts.player1Id),
    getXIForUser(opts.player2Id),
  ]);

  const p1XI = p1Data.xiOutfield;
  const p2XI = p2Data.xiOutfield;

  const hero1 =
    p1Data.hero ??
    ({
      name: "Mysterious GK 1",
      hp: 300,
      maxHp: 300,
      armor: 0,
    } as HeroState);

  const hero2 =
    p2Data.hero ??
    ({
      name: "Mysterious GK 2",
      hp: 300,
      maxHp: 300,
      armor: 0,
    } as HeroState);

  const deck1: BattleCard[] = shuffle([
    ...p1XI.map((m) => buildMonsterCard(m)),
    ...createSpellCards(),
  ]);
  const deck2: BattleCard[] = shuffle([
    ...p2XI.map((m) => buildMonsterCard(m)),
    ...createSpellCards(),
  ]);

  const basePlayer: PlayerState = {
    key: "player",
    label: "Player 1",
    deck: deck1,
    hand: [],
    board: [],
    hero: { ...hero1 },
    mana: 0,
    maxMana: 0,
  };

  const baseOpponent: PlayerState = {
    key: "opponent",
    label: "Player 2",
    deck: deck2,
    hand: [],
    board: [],
    hero: { ...hero2 },
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

  let p = { ...s.player };
  let o = { ...s.opponent };
  for (let i = 0; i < 3; i++) {
    p = drawCard(p);
    o = drawCard(o);
  }
  s = { ...s, player: p, opponent: o };

  s.player = startTurnInternal(s.player, s.turn);
  s.log.push("Player 1's first turn begins.");

  return s;
}

export function startTurnForActive(state: BattleState): BattleState {
  if (state.active === "player") {
    return {
      ...state,
      player: startTurnInternal(state.player, state.turn),
    };
  }
  return {
    ...state,
    opponent: startTurnInternal(state.opponent, state.turn),
  };
}

export function advanceTurn(state: BattleState): BattleState {
  const next = endTurnSwitchActive(state);
  return startTurnForActive(next);
}
