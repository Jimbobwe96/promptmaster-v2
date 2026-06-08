/**
 * Functional core: pure game-decision logic.
 *
 * Nothing in this file touches Redis, sockets, timers, AI, or the clock-by-default —
 * every function is a deterministic transform over plain data, so it can be unit-tested
 * without standing up any infrastructure. The effectful "shell" (gameService) calls in here.
 */

import type { Player, RoundStatus, GameRound2, Lobby2 } from '@promptmaster/shared';

/**
 * Phases whose advancement is driven by a wall-clock deadline (`phaseEndTime`).
 * `generating` and `scoring` advance when their async effect completes, not on a clock;
 * `skipped` is terminal for a round. The reconciling tick only acts on these.
 */
export const DEADLINE_DRIVEN_PHASES: ReadonlySet<RoundStatus> = new Set<RoundStatus>([
  'prompting',
  'guessing',
  'results'
]);

/** Whether the reconciling tick should act on a round now: deadline-driven phase, past its end. */
export function isPhaseDeadlineDue(phase: RoundStatus, phaseEndTime: number, now: number = Date.now()): boolean {
  return DEADLINE_DRIVEN_PHASES.has(phase) && now >= phaseEndTime;
}

/**
 * Fisher–Yates shuffle. Returns a new array; does not mutate the input.
 * `rng` is injectable so tests can make it deterministic.
 */
export function shuffle<T>(array: readonly T[], rng: () => number = Math.random): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * The prompter for a given round, cycling through the (already-randomized) order.
 */
export function selectPrompter(prompterOrder: string[], roundIndex: number): string {
  return prompterOrder[roundIndex % prompterOrder.length];
}

/** Number of currently-connected players. */
export function countConnected(players: Pick<Player, 'connected'>[]): number {
  return players.filter((p) => p.connected).length;
}

/**
 * How many guesses we expect this round: every connected player except the prompter.
 */
export function expectedGuessCount(players: Pick<Player, 'connected'>[]): number {
  return Math.max(countConnected(players) - 1, 0);
}

/**
 * The game is complete once every player has prompted `roundsPerPlayer` times.
 * `roundsPlayed` counts all rounds created (including skipped ones).
 */
export function isGameComplete(roundsPlayed: number, prompterCount: number, roundsPerPlayer: number): boolean {
  return roundsPlayed >= prompterCount * roundsPerPlayer;
}

/** Absolute epoch-ms deadline `durationSeconds` from `now`. */
export function phaseEndTime(durationSeconds: number, now: number = Date.now()): number {
  return now + durationSeconds * 1000;
}

// ==================== Guessing ====================

/** Whether this player has already submitted a guess this round. */
export function hasGuessed(round: GameRound2, username: string): boolean {
  return round.guesses.some((g) => g.username === username);
}

/**
 * Record a player's guess, returning a new round. A repeat guess from the same
 * player replaces their previous one (they can revise until the phase ends).
 */
export function applyGuess(round: GameRound2, username: string, guess: string, submittedAt: Date): GameRound2 {
  const others = round.guesses.filter((g) => g.username !== username);
  return { ...round, guesses: [...others, { username, guess, submittedAt }] };
}

/** Whether every expected guesser has submitted (so we can advance early). */
export function allGuessesIn(round: GameRound2): boolean {
  return round.guesses.length >= (round.expectedGuessCount ?? 0);
}

// ==================== Information hiding (redaction) ====================

/** Phases in which the round's secrets are public — nothing to hide anymore. */
const REVEALED_PHASES: ReadonlySet<RoundStatus> = new Set<RoundStatus>(['results', 'skipped']);

/**
 * A view of a round safe to send to `viewer` mid-round: the prompt is visible only to the
 * prompter, and each guess's text/score is visible only to its author. Who has guessed (and
 * when) stays visible so the waiting UI can show progress. Fully revealed once scored.
 */
export function redactRoundFor(round: GameRound2, viewer: string): GameRound2 {
  if (REVEALED_PHASES.has(round.phase)) return round;
  return {
    ...round,
    prompt: round.prompterUsername === viewer ? round.prompt : undefined,
    guesses: round.guesses.map((g) => (g.username === viewer ? g : { ...g, guess: '', score: undefined }))
  };
}

/**
 * Redact a lobby for a given viewer. Only the current (last) round can hold secrets;
 * earlier rounds are already revealed. Lobbies without a game pass through untouched.
 */
export function redactLobbyFor(lobby: Lobby2, viewer: string): Lobby2 {
  const gameState = lobby.gameState;
  if (!gameState || gameState.rounds.length === 0) return lobby;
  const lastIdx = gameState.rounds.length - 1;
  const rounds = gameState.rounds.map((r, i) => (i === lastIdx ? redactRoundFor(r, viewer) : r));
  return { ...lobby, gameState: { ...gameState, rounds } };
}
