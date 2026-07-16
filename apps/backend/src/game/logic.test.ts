import { describe, it, expect } from 'vitest';
import type { GameRound2, Lobby2 } from '@promptmaster/shared';
import {
  shuffle,
  selectPrompter,
  countConnected,
  expectedGuessCount,
  isGameComplete,
  phaseEndTime,
  isPhaseDeadlineDue,
  hasGuessed,
  applyGuess,
  allGuessesIn,
  redactRoundFor,
  redactLobbyFor,
  applyScores,
  rollUpTotals,
  addReady,
  allReady
} from './logic';

const baseRound = (overrides: Partial<GameRound2> = {}): GameRound2 => ({
  phase: 'guessing',
  phaseEndTime: 0,
  prompterUsername: 'alice',
  prompt: 'a cat in a hat',
  guesses: [],
  expectedGuessCount: 2,
  readyPlayers: [],
  ...overrides
});

describe('shuffle', () => {
  it('returns a new array without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('is deterministic with an injected rng', () => {
    const rng = () => 0; // always picks index 0 as the swap target
    expect(shuffle(['a', 'b', 'c'], rng)).toEqual(shuffle(['a', 'b', 'c'], rng));
  });

  it('handles empty and single-element arrays', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['only'])).toEqual(['only']);
  });
});

describe('selectPrompter', () => {
  const order = ['alice', 'bob', 'carol'];

  it('returns the prompter for the round', () => {
    expect(selectPrompter(order, 0)).toBe('alice');
    expect(selectPrompter(order, 1)).toBe('bob');
    expect(selectPrompter(order, 2)).toBe('carol');
  });

  it('wraps around for later rounds', () => {
    expect(selectPrompter(order, 3)).toBe('alice');
    expect(selectPrompter(order, 4)).toBe('bob');
  });
});

describe('countConnected', () => {
  it('counts only connected players', () => {
    expect(
      countConnected([{ connected: true }, { connected: false }, { connected: true }])
    ).toBe(2);
  });

  it('is zero when nobody is connected', () => {
    expect(countConnected([{ connected: false }])).toBe(0);
  });
});

describe('expectedGuessCount', () => {
  it('is every connected player except the prompter', () => {
    expect(expectedGuessCount([{ connected: true }, { connected: true }, { connected: true }])).toBe(2);
  });

  it('never goes negative', () => {
    expect(expectedGuessCount([{ connected: true }])).toBe(0);
    expect(expectedGuessCount([])).toBe(0);
  });

  it('ignores disconnected players', () => {
    expect(expectedGuessCount([{ connected: true }, { connected: false }, { connected: true }])).toBe(1);
  });
});

describe('isGameComplete', () => {
  it('is false before everyone has had their rounds', () => {
    expect(isGameComplete(3, 3, 2)).toBe(false); // 3 < 6
  });

  it('is true once roundsPlayed reaches prompters * roundsPerPlayer', () => {
    expect(isGameComplete(6, 3, 2)).toBe(true);
    expect(isGameComplete(7, 3, 2)).toBe(true);
  });

  it('handles a single round per player', () => {
    expect(isGameComplete(2, 3, 1)).toBe(false);
    expect(isGameComplete(3, 3, 1)).toBe(true);
  });
});

describe('phaseEndTime', () => {
  it('adds duration in seconds to the provided now', () => {
    expect(phaseEndTime(30, 1_000_000)).toBe(1_030_000);
  });

  it('defaults to the current clock', () => {
    const before = Date.now();
    const end = phaseEndTime(10);
    expect(end).toBeGreaterThanOrEqual(before + 10_000);
  });
});

describe('isPhaseDeadlineDue', () => {
  it('is true for a deadline-driven phase whose deadline has passed', () => {
    expect(isPhaseDeadlineDue('prompting', 1000, 1000)).toBe(true);
    expect(isPhaseDeadlineDue('guessing', 1000, 1500)).toBe(true);
    expect(isPhaseDeadlineDue('results', 1000, 9999)).toBe(true);
  });

  it('is false before the deadline', () => {
    expect(isPhaseDeadlineDue('prompting', 2000, 1999)).toBe(false);
  });

  it('is false for effect-driven and terminal phases regardless of time', () => {
    expect(isPhaseDeadlineDue('generating', 0, 9999)).toBe(false);
    expect(isPhaseDeadlineDue('scoring', 0, 9999)).toBe(false);
    expect(isPhaseDeadlineDue('skipped', 0, 9999)).toBe(false);
  });
});

describe('hasGuessed', () => {
  it('reflects whether a player has a guess on the round', () => {
    const round = baseRound({ guesses: [{ username: 'bob', guess: 'x', submittedAt: new Date() }] });
    expect(hasGuessed(round, 'bob')).toBe(true);
    expect(hasGuessed(round, 'carol')).toBe(false);
  });
});

describe('applyGuess', () => {
  const now = new Date();

  it('adds a guess without mutating the input round', () => {
    const round = baseRound();
    const next = applyGuess(round, 'bob', 'a dog', now);
    expect(round.guesses).toHaveLength(0);
    expect(next.guesses).toEqual([{ username: 'bob', guess: 'a dog', submittedAt: now }]);
  });

  it('replaces a player\'s previous guess rather than duplicating', () => {
    const round = applyGuess(baseRound(), 'bob', 'first', now);
    const next = applyGuess(round, 'bob', 'second', now);
    expect(next.guesses).toHaveLength(1);
    expect(next.guesses[0].guess).toBe('second');
  });
});

describe('allGuessesIn', () => {
  it('is true once guesses reach the expected count', () => {
    const round = baseRound({
      expectedGuessCount: 2,
      guesses: [
        { username: 'bob', guess: 'x', submittedAt: new Date() },
        { username: 'carol', guess: 'y', submittedAt: new Date() }
      ]
    });
    expect(allGuessesIn(round)).toBe(true);
  });

  it('is false while guesses are still outstanding', () => {
    const round = baseRound({ expectedGuessCount: 2, guesses: [{ username: 'bob', guess: 'x', submittedAt: new Date() }] });
    expect(allGuessesIn(round)).toBe(false);
  });
});

describe('redactRoundFor', () => {
  const round = baseRound({
    guesses: [
      { username: 'bob', guess: 'a dog', submittedAt: new Date(0) },
      { username: 'carol', guess: 'a fish', submittedAt: new Date(0) }
    ]
  });

  it('hides the prompt from non-prompters', () => {
    expect(redactRoundFor(round, 'bob').prompt).toBeUndefined();
  });

  it('shows the prompt to the prompter', () => {
    expect(redactRoundFor(round, 'alice').prompt).toBe('a cat in a hat');
  });

  it('shows a viewer their own guess but blanks others', () => {
    const view = redactRoundFor(round, 'bob');
    expect(view.guesses.find((g) => g.username === 'bob')?.guess).toBe('a dog');
    expect(view.guesses.find((g) => g.username === 'carol')?.guess).toBe('');
    // who guessed (and when) stays visible for progress UI
    expect(view.guesses.map((g) => g.username)).toEqual(['bob', 'carol']);
  });

  it('reveals everything once the round is in a revealed phase', () => {
    const revealed = redactRoundFor(baseRound({ phase: 'results' }), 'bob');
    expect(revealed.prompt).toBe('a cat in a hat');
  });
});

describe('redactLobbyFor', () => {
  const lobbyWithGame = (round: GameRound2): Lobby2 => ({
    lobbyCode: 'ABC123',
    hostUsername: 'alice',
    players: [],
    settings: { roundsPerPlayer: 1, timeLimit: 30 },
    status: 'playing',
    createdAt: new Date(),
    gameState: { rounds: [round], prompterOrder: ['alice', 'bob'], scores: [] }
  });

  it('redacts only the current round for the viewer', () => {
    const view = redactLobbyFor(lobbyWithGame(baseRound()), 'bob');
    expect(view.gameState!.rounds[0].prompt).toBeUndefined();
  });

  it('passes lobbies without a game through untouched', () => {
    const lobby: Lobby2 = {
      lobbyCode: 'ABC123',
      hostUsername: 'alice',
      players: [],
      settings: { roundsPerPlayer: 1, timeLimit: 30 },
      status: 'waiting',
      createdAt: new Date()
    };
    expect(redactLobbyFor(lobby, 'bob')).toBe(lobby);
  });
});

describe('applyScores', () => {
  it('attaches scores by username without mutating the input', () => {
    const round = baseRound({
      guesses: [
        { username: 'bob', guess: 'a dog', submittedAt: new Date(0) },
        { username: 'carol', guess: 'a fish', submittedAt: new Date(0) }
      ]
    });
    const next = applyScores(round, new Map([['bob', 90], ['carol', 40]]));
    expect(round.guesses[0].score).toBeUndefined();
    expect(next.guesses.find((g) => g.username === 'bob')?.score).toBe(90);
    expect(next.guesses.find((g) => g.username === 'carol')?.score).toBe(40);
  });

  it('defaults a missing score to 0', () => {
    const round = baseRound({ guesses: [{ username: 'bob', guess: 'x', submittedAt: new Date(0) }] });
    expect(applyScores(round, new Map()).guesses[0].score).toBe(0);
  });
});

describe('rollUpTotals', () => {
  it('sums guess scores per username across rounds, seeded at 0 for everyone', () => {
    const rounds: GameRound2[] = [
      baseRound({
        prompterUsername: 'alice',
        guesses: [
          { username: 'bob', guess: 'x', submittedAt: new Date(0), score: 80 },
          { username: 'carol', guess: 'y', submittedAt: new Date(0), score: 50 }
        ]
      }),
      baseRound({
        prompterUsername: 'bob',
        guesses: [
          { username: 'alice', guess: 'z', submittedAt: new Date(0), score: 30 },
          { username: 'carol', guess: 'w', submittedAt: new Date(0), score: 20 }
        ]
      })
    ];
    const totals = rollUpTotals(rounds, ['alice', 'bob', 'carol']);
    const byName = Object.fromEntries(totals.map((t) => [t.playerId, t.totalScore]));
    expect(byName).toEqual({ alice: 30, bob: 80, carol: 70 });
  });

  it('includes players with no scored guesses at 0', () => {
    const totals = rollUpTotals([baseRound({ guesses: [] })], ['alice', 'bob']);
    expect(totals).toEqual([
      { playerId: 'alice', totalScore: 0 },
      { playerId: 'bob', totalScore: 0 }
    ]);
  });
});

describe('addReady', () => {
  it('adds a username without mutating the input', () => {
    const ready = ['alice'];
    const next = addReady(ready, 'bob');
    expect(ready).toEqual(['alice']);
    expect(next).toEqual(['alice', 'bob']);
  });

  it('is idempotent for an already-ready player', () => {
    expect(addReady(['alice'], 'alice')).toEqual(['alice']);
  });
});

describe('allReady', () => {
  it('is true once every connected player is ready', () => {
    expect(allReady(['alice', 'bob'], ['alice', 'bob'])).toBe(true);
    expect(allReady(['alice', 'bob', 'carol'], ['alice', 'bob'])).toBe(true); // extra is fine
  });

  it('is false while someone connected has not readied', () => {
    expect(allReady(['alice'], ['alice', 'bob'])).toBe(false);
  });

  it('is false when nobody is connected', () => {
    expect(allReady([], [])).toBe(false);
  });
});
