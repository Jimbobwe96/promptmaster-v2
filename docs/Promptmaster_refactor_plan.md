# Promptmaster Refactor Plan

_Living roadmap for finishing the v2 rewrite. Started 2026-06-07._

## Guiding principles

- **Tech debt is the enemy.** Clean, elegant, minimal code. No dead weight.
- **Functional core, imperative shell.** Pure game-decision logic (no IO) lives in a
  `game/logic` module and is unit-tested. `gameService2` stays the effectful shell:
  Redis, socket emits, timers, AI calls. We _extract_ as we finish stubs — no big-bang rewrite.
- **Single source of authority via Redis.** Game state lives in Redis (`lobby:{code}`).
  Phase deadlines are stored as `phaseEndTime`, so the server can always reconstruct
  "what should happen next" from state alone.
- **Username is the domain identity.** Socket id is transport-only and changes on reconnect.
  Everything game-facing (scores, guesses, prompter) keys on `username`.
- **Smooth DX + hostable.** Frontend → Vercel, backend (long-lived socket.io process) → Railway.

## Decisions locked in

| Decision | Choice |
| --- | --- |
| v1 code | Keep as reference until new scoring/results path exists, then delete (Phase 5). |
| Shared schema | Leave hand-written types as-is for now (revisit Zod-first later). |
| Scoring engine | **Claude** as judge, via structured/tool output (no regex parsing, no random fallback). |
| Game architecture | Functional core + imperative shell. |
| Phase timers | **Single reconciling tick** (one loop scans active lobbies vs `phaseEndTime`), replaces N in-memory `setTimeout`s. Survives restarts. |

## Known issues to fix along the way

- **Info leak:** emitting the whole `Lobby2` exposes `round.prompt` and other players'
  guesses during the guessing phase. Need per-recipient redaction. (Phase 2)
- **Identifier bug:** `gameState.scores` is keyed by `playerId = socket.id` instead of
  username, so scores break on reconnect. Fix when we build scoring. (Phase 3)
- **`Date` types lie:** `createdAt`/`lastSeen`/`submittedAt` are typed `Date` but round-trip
  through Redis JSON as strings. New timestamp fields we write use epoch `number`. (Phase 2+)
- **Duplicate `game:started` emit:** sent from both `initializeGame` and the socket handler. (Phase 5)
- Debug `console.log` litter, `page_old.tsx`, `useSocket.ts`, dead commented block. (Phase 5)

### Deferred (explicitly punted)
- **Dependency freshen / npm-audit vulns:** ~28 pre-existing audit findings in the year-old
  tree. Deliberately deferred — its own effort, entangled with Next/React versions.
- **React 19 RC → stable:** frontend is pinned to `19.0.0-rc`. Bump off the prerelease when
  we're next in the frontend (Phase 4).

## Phases

### Phase 0 — Functional-core seam (no behavior change)
- Add `vitest` to backend; `npm test` script.
- Create `src/game/logic.ts` with the pure helpers already living inside `gameService2`:
  `shuffle`, `selectPrompter`, `expectedGuessCount`, `isGameComplete`, `phaseEndTime`.
- Unit-test them.
- Refactor `gameService2` to import from `logic.ts`. Verify prompting → generating → guessing still works.

### Phase 1 — Reconciling tick (replace in-memory timers) ✅
- Redis set `games:active` tracks in-progress lobbies (added in `initializeGame`, removed in
  `endGame`; the tick self-heals stale entries when a lobby is gone/not-playing).
- One `setInterval` (1s) tick scans active lobbies; `isPhaseDeadlineDue` (pure, tested) decides
  whether to advance. Only `prompting`/`guessing`/`results` are deadline-driven.
- Removed `activeGameTimers` / `startPhaseTimer` / `setActiveTimer` / `clearActiveTimer`.
- `handledDeadlines` set fires each round/phase deadline once per process (transient — a restart
  causes at most one idempotent re-fire). `handlePhaseTimeout` keeps its phase guard.
- **Draft handshake preserved** (not simplified): the frontend only salvages an unsent prompt in
  response to `game:request_prompt_draft`, so the existing request-draft + 1s-grace flow stays.
- **Known gap (deferred):** `generating`/`scoring` have no watchdog — if the FAL/Claude call hangs
  without resolving, the round can stall. Add a generation/scoring timeout in Phase 2/3.

### Phase 2 — Guess capture + information hiding ✅
- `handleGuessSubmission` records/revises a guess via pure `applyGuess`, broadcasts
  `game:guess_submitted`, and advances to `scoring` once `allGuessesIn` (pure predicate).
- `handleGuessTimeout`: nudges connected non-guessers with `game:request_guess_draft`, then after
  a 1s grace transitions to `scoring` with whatever arrived (mirrors the prompt-draft flow).
- **Redaction (the leak fix):** `redactRoundFor`/`redactLobbyFor` (pure) hide the prompt from
  non-prompters and each guess's text/score from non-authors, until the round is revealed
  (`results`/`skipped`). Who-guessed + timestamps stay visible for progress UI.
- `broadcastLobby` (shell) fans out **per-socket**, each with its own redacted view. All in-game
  emits (`game:started`, `game:phase_changed`, `game:guess_submitted`, `game:ended`) and the
  socket layer's `lobby:validated`/`lobby:updated` now go through it — closes the reconnection
  leak too. Duplicate `game:started` emit removed; dead commented block deleted.
- **Loop boundary:** a game now plays through guessing and pauses at `scoring` (scoring lands in
  Phase 3). Unit tests: 29 passing. Full multi-client e2e deferred until scoring completes the loop.

### Phase 3 — Scoring (Claude)
- In the `scoring` phase, call Claude with structured output to score each guess 0–100.
- Pure: `applyScores(round, scores)`, `rollUpTotals(rounds) → scores[]` (keyed by **username**).
- Verify scores computed, stored, and survive reconnect.

### Phase 4 — Results, ready-up, next round, end game
- Implement `handlePlayerReady` (pure `allReady`) + ready-phase timeout.
- On all-ready or results deadline: `createNewRound` or `endGame` (via `isGameComplete`).
- Wire `game:ready_state_update` and `game:ended`.
- Frontend: wire the 4 STUB listeners in the game page; finish `ScoringPhase` UI.
- Verify a full multi-round game start → finish.

### Phase 5 — Reconnection hardening + cleanup
- Verify dc/rc across every phase with username identity.
- Delete v1 (`gameService.ts`, `socketService.ts`, `lobby.ts`, `useSocket.ts`, `page_old.tsx`,
  v1 types/events). Optionally drop the `2` suffix so v2 becomes canonical.
- Fix duplicate `game:started`; remove dead commented block; introduce a tiny logger / strip debug logs.
- Fix `LeaderboardSection` importing v1 `useSocket`.
