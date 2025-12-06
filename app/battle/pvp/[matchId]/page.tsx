// app/battle/pvp/[matchId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

/** ---- Shared battle types (must match server battleEngineServer.ts) ---- */

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

  // status
  stunnedForTurns?: number;

  // visual data
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

type SpellEffectType = "DAMAGE_HERO" | "SHIELD_HERO";

type BattleSpellCard = {
  id: string;
  kind: "SPELL";
  name: string;
  description: string;
  manaCost: number;
  effect: SpellEffectType;
  value: number;
};

type BattleCard = BattleMonsterCard | BattleSpellCard;

type HeroState = {
  name: string;
  hp: number;
  maxHp: number;
  armor: number;
  artUrl?: string; // mirror single-player hero design
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

/** ---- API types ---- */

type MatchData = {
  id: string;
  status: "WAITING" | "IN_PROGRESS" | "COMPLETED" | string;
  createdAt: string;
  player1Id: string;
  player2Id: string | null;
  currentTurnPlayerId: string | null;
  winnerUserId: string | null;
  battleState: BattleState | null;
  youArePlayer1: boolean;
};

type ActionBody =
  | { action: "INIT" }
  | { action: "PLAY_CARD"; handIndex: number }
  | { action: "ATTACK_HERO"; attackerIndex: number }
  | { action: "ATTACK_MINION"; attackerIndex: number; targetIndex: number }
  | { action: "END_TURN" }
  | { action: "HERO_POWER" };

/** ---- Constants ---- */

const TURN_DURATION = 30; // 30s per turn in PVP
const HERO_POWER_COST = 3; // must match server hero power cost

/** ---- Page component ---- */

export default function OnlineBattlePage() {
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;

  const [match, setMatch] = useState<MatchData | null>(null);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAttacker, setSelectedAttacker] = useState<number | null>(
    null
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [turnTimer, setTurnTimer] = useState<number>(TURN_DURATION);

  // Initial fetch
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/battle/matches/${matchId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || "Failed to load match.");
          return;
        }
        const data: MatchData = await res.json();
        setMatch(data);
        setBattle(data.battleState);
      } catch (err) {
        console.error("Error loading match:", err);
        setError("Failed to load match.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [matchId]);

  // Polling to sync opponent moves
  useEffect(() => {
    if (!matchId) return;
    if (match?.status === "COMPLETED") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/battle/matches/${matchId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data: MatchData = await res.json();
        setMatch(data);
        setBattle(data.battleState);
      } catch {
        // ignore polling errors
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [matchId, match?.status]);

  // Auto-init battle once both players are present and no battleState yet
  useEffect(() => {
    const shouldInit =
      match &&
      !match.battleState &&
      !!match.player1Id &&
      !!match.player2Id &&
      match.status !== "COMPLETED";

    if (!shouldInit) return;

    const init = async () => {
      try {
        const res = await fetch(`/api/battle/matches/${matchId}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "INIT" } satisfies ActionBody),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error("INIT error:", body.error || res.statusText);
          return;
        }
        const data: MatchData = await res.json();
        setMatch(data);
        setBattle(data.battleState);
      } catch (err) {
        console.error("Error initializing battle:", err);
      }
    };

    void init();
  }, [match, matchId]);

  const youArePlayer1 = match?.youArePlayer1 ?? true;
  const mySide: PlayerKey = youArePlayer1 ? "player" : "opponent";
  const enemySide: PlayerKey = youArePlayer1 ? "opponent" : "player";

  const isMyTurn = useMemo(() => {
    if (!match || !battle) return false;
    if (!match.currentTurnPlayerId) return false;

    const iAmP1 = match.youArePlayer1;
    const myUserIsCurrent =
      (iAmP1 && match.currentTurnPlayerId === match.player1Id) ||
      (!iAmP1 && match.currentTurnPlayerId === match.player2Id);

    if (!myUserIsCurrent) return false;
    return battle.active === mySide;
  }, [match, battle, mySide]);

  // Turn timer (visual only)
  useEffect(() => {
    if (!battle || battle.winner || !isMyTurn) return;

    setTurnTimer(TURN_DURATION);
    const interval = setInterval(() => {
      setTurnTimer((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [battle?.active, battle?.turn, battle?.winner, isMyTurn]);

  const statusLabel =
    match?.status === "WAITING"
      ? "Waiting for both players to join…"
      : match?.status === "IN_PROGRESS"
      ? "Match in progress"
      : match?.status === "COMPLETED"
      ? "Match finished"
      : match?.status;

  // Helper to update from API response
  const updateFromApiMatch = (data: MatchData) => {
    setMatch(data);
    setBattle(data.battleState);
  };

  // Generic action caller
  const sendAction = async (body: ActionBody) => {
    if (!matchId) return;
    try {
      const res = await fetch(`/api/battle/matches/${matchId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          errBody.error || `Server error (${res.status} - ${res.statusText})`;
        setActionMessage(msg);
        return;
      }
      const data: MatchData = await res.json();
      updateFromApiMatch(data);
      setActionMessage(null);
    } catch (err) {
      console.error("Action error:", err);
      setActionMessage("Network error while sending action.");
    }
  };

  // --- Handlers (mirror single-player, but via sendAction) ---

  const handlePlayCard = (handIndex: number) => {
    if (!battle || !match) return;
    if (battle.winner) return;
    if (!isMyTurn || match.status !== "IN_PROGRESS") {
      setActionMessage("It is not your turn.");
      return;
    }

    const me = mySide === "player" ? battle.player : battle.opponent;
    const card = me.hand[handIndex];

    if (!card) {
      setActionMessage("That card is no longer in your hand.");
      return;
    }

    // Max 3 monsters
    if (card.kind === "MONSTER" && me.board.length >= 3) {
      setActionMessage(
        "You already have 3 monsters on the pitch. (Max 3 per side.)"
      );
      return;
    }

    // FWD requires MID on board
    if (card.kind === "MONSTER" && card.position === "FWD") {
      const hasMidfielder = me.board.some((m) => m.position === "MID");
      if (!hasMidfielder) {
        setActionMessage(
          "You need a Midfielder on your side of the pitch before you can play a Forward."
        );
        return;
      }
    }

    if (card.manaCost > me.mana) {
      setActionMessage("Not enough mana to play that card.");
      return;
    }

    setSelectedAttacker(null);
    setActionMessage(null);
    void sendAction({ action: "PLAY_CARD", handIndex });
  };

  const handleSelectAttacker = (idx: number) => {
    if (!battle || !match) return;
    if (battle.winner) return;

    if (!isMyTurn || match.status !== "IN_PROGRESS") {
      setActionMessage("It is not your turn.");
      return;
    }

    const me = mySide === "player" ? battle.player : battle.opponent;
    const m = me.board[idx];
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
    if (!battle || !match) return;
    if (battle.winner) return;

    if (!isMyTurn || match.status !== "IN_PROGRESS") {
      setActionMessage("It is not your turn.");
      return;
    }

    if (selectedAttacker === null) {
      setActionMessage("Select an attacking monster first.");
      return;
    }

    const me = mySide === "player" ? battle.player : battle.opponent;
    const opp = mySide === "player" ? battle.opponent : battle.player;

    const attacker = me.board[selectedAttacker];
    if (!attacker) {
      setSelectedAttacker(null);
      setActionMessage("That monster is no longer on the pitch.");
      return;
    }
    if (!attacker.canAttack || attacker.position === "DEF") {
      setActionMessage("This monster can’t attack right now.");
      return;
    }

    const opponentHasDefender = opp.board.some(
      (m) => m.position === "DEF"
    );

    // GLOBAL RULE: If the opponent has any DEF on board,
    // you MUST attack defenders before the Goalkeeper.
    if (opponentHasDefender) {
      setActionMessage(
        "You must attack the defenders before you can target the Goalkeeper."
      );
      return;
    }

    setActionMessage(null);
    setSelectedAttacker(null);
    void sendAction({
      action: "ATTACK_HERO",
      attackerIndex: selectedAttacker,
    });
  };

  const handleAttackMinion = (enemyIdx: number) => {
    if (!battle || !match) return;
    if (battle.winner) return;

    if (!isMyTurn || match.status !== "IN_PROGRESS") {
      setActionMessage("It is not your turn.");
      return;
    }

    if (selectedAttacker === null) {
      setActionMessage("Select an attacking monster first.");
      return;
    }

    const me = mySide === "player" ? battle.player : battle.opponent;
    const opp = mySide === "player" ? battle.opponent : battle.player;

    const attacker = me.board[selectedAttacker];
    if (!attacker) {
      setSelectedAttacker(null);
      setActionMessage("That monster is no longer on the pitch.");
      return;
    }
    if (!attacker.canAttack || attacker.position === "DEF") {
      setActionMessage("This monster can’t attack right now.");
      return;
    }

    const enemy = opp.board[enemyIdx];
    if (!enemy) {
      setActionMessage("That target is no longer on the pitch.");
      return;
    }

    const opponentHasDefender = opp.board.some(
      (m) => m.position === "DEF"
    );
    if (opponentHasDefender && enemy.position !== "DEF") {
      setActionMessage(
        "While defenders are on the pitch, you must target a defender."
      );
      return;
    }

    setActionMessage(null);
    setSelectedAttacker(null);
    void sendAction({
      action: "ATTACK_MINION",
      attackerIndex: selectedAttacker,
      targetIndex: enemyIdx,
    });
  };

  const handleEndTurn = () => {
    if (!battle || !match) return;
    if (battle.winner) return;

    if (!isMyTurn || match.status !== "IN_PROGRESS") {
      setActionMessage("It is not your turn.");
      return;
    }

    setSelectedAttacker(null);
    setActionMessage(null);
    void sendAction({ action: "END_TURN" });
  };

  const handleHeroPowerClick = () => {
    if (!battle || !match) return;
    if (battle.winner) return;

    if (!isMyTurn || match.status !== "IN_PROGRESS") {
      setActionMessage("It is not your turn.");
      return;
    }

    const me = mySide === "player" ? battle.player : battle.opponent;

    if (me.mana < HERO_POWER_COST) {
      setActionMessage(
        `Not enough mana. Hero Power costs ${HERO_POWER_COST}.`
      );
      return;
    }

    setSelectedAttacker(null);
    setActionMessage(null);
    void sendAction({ action: "HERO_POWER" });
  };

  const handleClearSelection = () => {
    setSelectedAttacker(null);
    setActionMessage(null);
  };

  const logView = useMemo(
    () => battle?.log.slice(-8) ?? [],
    [battle]
  );

  if (loading) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-emerald-500/40 bg-emerald-950/60 p-4">
          <p className="text-sm text-emerald-100">
            Loading online battle…
          </p>
        </section>
      </main>
    );
  }

  if (error || !match) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-red-500/40 bg-red-950/70 p-4">
          <h2 className="mb-1 text-sm font-semibold text-red-200">
            Online battle error
          </h2>
          <p className="text-xs text-red-100">
            {error || "Unable to load this match."}
          </p>
        </section>
      </main>
    );
  }

  const hasBattle = !!battle;
  const myPlayer = battle
    ? mySide === "player"
      ? battle.player
      : battle.opponent
    : null;
  const enemyPlayer = battle
    ? enemySide === "player"
      ? battle.player
      : battle.opponent
    : null;

  const playerBoard = myPlayer?.board ?? [];
  const opponentBoard = enemyPlayer?.board ?? [];

  if (!hasBattle) {
    return (
      <main className="space-y-4">
        <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-4">
          <h1 className="mb-1 text-lg font-semibold text-emerald-100">
            Online Battle
          </h1>
          <p className="text-[11px] text-emerald-200">
            Match ID:{" "}
            <span className="font-mono text-emerald-100">
              {match.id}
            </span>
          </p>
          <p className="mt-1 text-[11px] text-emerald-200">
            Status: {statusLabel}
          </p>
          <p className="mt-2 text-[11px] text-emerald-100">
            You are{" "}
            <span className="font-bold">
              {match.youArePlayer1 ? "Player 1" : "Player 2"}
            </span>
            .
          </p>
          <p className="mt-2 text-[11px] text-emerald-200">
            Waiting for the battle to start. As soon as both players are
            in, we&apos;ll auto-generate XI squads and drop you straight
            into the pitch.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
          <h2 className="mb-1 text-sm font-semibold text-slate-100">
            Debug: raw match state
          </h2>
          <pre className="max-h-80 overflow-auto rounded-xl bg-slate-900/90 p-2 text-[10px] text-slate-200">
            {JSON.stringify(match, null, 2)}
          </pre>
        </section>
      </main>
    );
  }

  const iWon =
    battle?.winner &&
    ((battle.winner === "player" && match.youArePlayer1) ||
      (battle.winner === "opponent" && !match.youArePlayer1));

  const winnerLabel =
    battle?.winner === "DRAW"
      ? "Draw!"
      : battle?.winner
      ? iWon
        ? "You win!"
        : "Opponent wins!"
      : null;

  const canAct =
    !!battle &&
    !battle.winner &&
    isMyTurn &&
    match.status === "IN_PROGRESS";

  const opponentHeroArt =
    enemyPlayer?.hero.artUrl ?? "/cards/base/test.png";
  const playerHeroArt =
    myPlayer?.hero.artUrl ?? "/cards/base/test.png";

  return (
    <>
      {/* Simple global keyframes for the initial card deal animation */}
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
        {/* Header / status */}
        <section className="rounded-2xl border border-emerald-500/40 bg-gradient-to-b from-emerald-950 via-emerald-900 to-emerald-950 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-lg font-semibold text-emerald-100">
                Online Battle
              </h1>
              <p className="text-[11px] text-emerald-200">
                Match ID:{" "}
                <span className="font-mono text-emerald-100">
                  {match.id}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-emerald-200">
                Status: {statusLabel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-emerald-100">
                You are{" "}
                <span className="font-bold">
                  {match.youArePlayer1 ? "Player 1" : "Player 2"}
                </span>
                .
              </p>
              {winnerLabel && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                  {winnerLabel}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Turn + controls (same look as single-player, with Hero Power) */}
        {battle && myPlayer && (
          <section className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-[11px] text-slate-300">
                Turn{" "}
                <span className="font-mono font-semibold text-slate-50">
                  {battle.turn}
                </span>{" "}
                • Active:{" "}
                <span className="font-semibold text-emerald-300">
                  {canAct
                    ? "Your turn"
                    : isMyTurn
                    ? "Your turn (waiting on server)"
                    : "Opponent’s turn"}
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {/* Big mana indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-sky-200">
                    Mana
                  </span>
                  <div className="flex gap-1">
                    {Array.from({
                      length: Math.max(myPlayer.maxMana, 1),
                    }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-4 w-3 rounded-full border border-sky-400/60 shadow-sm ${
                          i < myPlayer.mana
                            ? "bg-sky-400/90"
                            : "bg-slate-800"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[11px] text-sky-300">
                    {myPlayer.mana}/{myPlayer.maxMana}
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

              {winnerLabel && (
                <p className="mt-1 text-[11px] font-semibold text-emerald-300">
                  {winnerLabel}
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
                onClick={handleHeroPowerClick}
                disabled={!canAct || myPlayer.mana < HERO_POWER_COST}
                className="rounded-full border border-emerald-500/70 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hero Power (3 Mana)
              </button>

              <button
                type="button"
                onClick={handleEndTurn}
                disabled={!canAct}
                className="rounded-full border border-slate-500/70 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                End Turn
              </button>

              <button
                type="button"
                onClick={handleClearSelection}
                className="rounded-full border border-emerald-500/70 px-3 py-1.5 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                Clear Selection
              </button>
            </div>
          </section>
        )}

        {/* Big shared soccer pitch with hero art (mirroring single-player) */}
        {battle && myPlayer && enemyPlayer && (
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
                      alt={enemyPlayer.hero.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-950/70" />
                    <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950">
                      GK
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-100">
                    {enemyPlayer.hero.name}
                  </p>
                </div>
                <HeroHealth hero={enemyPlayer.hero} />
              </button>

              {/* Opponent half */}
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
                        if (canAct && selectedAttacker !== null) {
                          handleAttackMinion(idx);
                        }
                      }}
                      showStatusOverlay
                    />
                  ))
                )}
              </div>

              {/* Your half */}
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

              {/* Your hero */}
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-900/50 px-3 py-3 text-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="relative h-16 w-16 overflow-hidden rounded-full border border-emerald-400 bg-emerald-700/60 shadow-lg">
                    <img
                      src={playerHeroArt}
                      alt={myPlayer.hero.name}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-950/70" />
                    <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-950">
                      GK
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-emerald-100">
                    {myPlayer.hero.name}
                  </p>
                </div>
                <HeroHealth hero={myPlayer.hero} />
              </div>
            </div>
          </section>
        )}

        {/* Hand */}
        {battle && myPlayer && (
          <section className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
            <p className="mb-1 text-[11px] text-slate-300">
              Your hand ({match.youArePlayer1 ? "Player 1" : "Player 2"})
            </p>
            <div className="flex flex-wrap gap-2">
              {renderHand(
                myPlayer.hand,
                myPlayer.mana,
                !!battle.winner || !canAct,
                (idx) => handlePlayCard(idx)
              )}
            </div>
          </section>
        )}

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

/** ---- View helpers (aligned with single-player) ---- */

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

        {/* Evo mini text (above bottom row) */}
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

          {/* Mana pill in the middle */}
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
  disabledGlobally: boolean,
  onPlay: (index: number) => void
) {
  if (hand.length === 0) {
    return <p className="text-[11px] text-slate-400">No cards in hand.</p>;
  }

  const isInitialDeal = hand.length <= 3;

  return hand.map((card, idx) => {
    const isDisabled =
      disabledGlobally || card.manaCost > manaAvailable;

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

    // Spell card
    return (
      <button
        key={card.id}
        type="button"
        onClick={() => !isDisabled && onPlay(idx)}
        disabled={isDisabled}
        style={dealStyle}
        className={`relative h-28 w-20 rounded-2xl border px-2 py-2 text-left text-[11px] transition bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 ${
          isDisabled
            ? "cursor-not-allowed border-slate-800 opacity-50"
            : "border-purple-500/70 hover:border-emerald-400"
        }`}
      >
        {/* Mana crystal */}
        <div className="absolute -top-2 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-sky-300/80 bg-sky-500 shadow">
          <span className="text-[10px] font-bold text-slate-950">
            {card.manaCost}
          </span>
        </div>
        <div className="mt-3 leading-tight text-slate-50 line-clamp-2">
          {card.name}
        </div>
        <div className="mt-1 text-[10px] text-slate-300 line-clamp-4">
          {card.description}
        </div>
      </button>
    );
  });
}