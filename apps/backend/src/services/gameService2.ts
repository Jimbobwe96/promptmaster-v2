import { Server } from 'socket.io';
import { Lobby2, GameState2, GameRound2, Player, RoundStatus } from '@promptmaster/shared';
import { OpenAI } from 'openai';
import { fal } from '@fal-ai/client';
import redisClient from '../config/redis';
import {
  shuffle,
  selectPrompter,
  expectedGuessCount,
  isGameComplete,
  phaseEndTime,
  isPhaseDeadlineDue,
  hasGuessed,
  applyGuess,
  allGuessesIn,
  applyScores,
  rollUpTotals,
  addReady,
  allReady
} from '../game/logic';
import { broadcastLobby } from '../game/broadcast';
import { scoreGuesses } from '../game/scoring';

/** Redis set holding the codes of every lobby with a game currently in progress. */
const ACTIVE_GAMES_KEY = 'games:active';
/** How often the reconciling tick scans for expired phase deadlines. */
const TICK_INTERVAL_MS = 1000;

export class GameService2 {
  /** Single reconciling-tick loop; replaces per-phase in-memory timers. */
  private tickInterval: NodeJS.Timeout | null = null;
  /** Reentrancy guard so a slow tick never overlaps the next one. */
  private ticking = false;
  /**
   * Deadlines this process has already acted on, keyed by `${code}:${roundIndex}:${phase}`.
   * Keeps the tick from firing the same timeout repeatedly while it waits for a transition.
   * Purely transient: lost on restart, which at worst causes one idempotent re-fire.
   */
  private handledDeadlines = new Set<string>();
  /**
   * Lobbies currently advancing out of the results phase. Guards against a double-advance
   * when the all-ready click and the results-deadline tick fire near-simultaneously.
   */
  private advancing = new Set<string>();

  constructor(private io: Server) {
    this.startTick();
  }

  // ==================== Reconciling Tick ====================

  private startTick(): void {
    this.tickInterval = setInterval(() => void this.tick(), TICK_INTERVAL_MS);
  }

  /** Stop the tick loop (graceful shutdown). */
  public stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  /**
   * Scan every in-progress game and advance any whose current phase deadline has passed.
   * All durable state lives in Redis, so this fully reconstructs pending work after a restart.
   */
  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const codes = await redisClient.sMembers(ACTIVE_GAMES_KEY);
      for (const code of codes) {
        await this.tickLobby(code);
      }
    } catch (error) {
      console.error('Error in game tick:', error);
    } finally {
      this.ticking = false;
    }
  }

  private async tickLobby(code: string): Promise<void> {
    const lobby = await this.getLobby(code);

    // Self-heal: drop anything that's no longer a running game from the active set.
    if (!lobby || lobby.status !== 'playing' || !lobby.gameState) {
      await redisClient.sRem(ACTIVE_GAMES_KEY, code);
      return;
    }

    const rounds = lobby.gameState.rounds;
    const round = rounds[rounds.length - 1];
    if (!round || !isPhaseDeadlineDue(round.phase, round.phaseEndTime)) return;

    // Fire each round/phase deadline at most once per process lifetime.
    const key = `${code}:${rounds.length - 1}:${round.phase}`;
    if (this.handledDeadlines.has(key)) return;
    this.handledDeadlines.add(key);

    await this.handlePhaseTimeout(code, round.phase);
  }

  private async registerActiveGame(lobbyCode: string): Promise<void> {
    await redisClient.sAdd(ACTIVE_GAMES_KEY, lobbyCode);
  }

  private async unregisterActiveGame(lobbyCode: string): Promise<void> {
    await redisClient.sRem(ACTIVE_GAMES_KEY, lobbyCode);
    // Forget any handled-deadline markers for this lobby so the set stays bounded.
    for (const key of this.handledDeadlines) {
      if (key.startsWith(`${lobbyCode}:`)) this.handledDeadlines.delete(key);
    }
  }

  // ==================== Data Management Methods ====================

  /**
   * Get lobby data from Redis
   */
  private async getLobby(lobbyCode: string): Promise<Lobby2 | null> {
    const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
    return lobbyData ? JSON.parse(lobbyData) : null;
  }

  /**
   * Save lobby data to Redis
   */
  private async updateLobby(lobby: Lobby2): Promise<void> {
    await redisClient.setEx(
      `lobby:${lobby.lobbyCode}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify(lobby)
    );
  }

  /**
   * Check if the game is complete (all rounds played)
   */
  private isGameComplete(lobby: Lobby2): boolean {
    const gameState = lobby.gameState;
    if (!gameState) return false;
    return isGameComplete(gameState.rounds.length, gameState.prompterOrder.length, lobby.settings.roundsPerPlayer);
  }

  // ==================== Game Initialization ====================

  /**
   * Initialize a new game
   */
  async initializeGame(lobbyCode: string): Promise<void> {
    try {
      console.log('Initializing game for lobby:', lobbyCode);
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Filter connected players and shuffle the prompter order
      const connectedPlayers = lobby.players.filter((player) => player.connected);
      const prompterOrder = shuffle(connectedPlayers.map((p) => p.username));
      console.log('Shuffled prompter order:', prompterOrder);

      // Debug logging
      console.log('DEBUG GAME INITIALIZATION:');
      console.log(
        '- connectedPlayers:',
        connectedPlayers.map((p) => ({ username: p.username, id: p.id, connected: p.connected }))
      );
      console.log('- prompterOrder:', prompterOrder);

      // Create game state
      lobby.gameState = {
        rounds: [],
        prompterOrder,
        // Keyed by username (the stable domain identity), not socket id — so scores
        // survive reconnection and line up with guesses/prompter everywhere else.
        scores: connectedPlayers.map((player) => ({
          playerId: player.username,
          totalScore: 0
        }))
      };

      // Update lobby status
      lobby.status = 'playing';

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Register the game so the reconciling tick starts watching its deadlines
      await this.registerActiveGame(lobbyCode);

      // Create the first round
      await this.createNewRound(lobby);

      // Notify all clients that game has started (redacted per-recipient)
      broadcastLobby(this.io, lobby, 'game:started');

      console.log('Game initialized successfully for lobby:', lobbyCode);
      return;
    } catch (error) {
      console.error('Error initializing game:', error);
      throw new Error('Failed to initialize game');
    }
  }

  /**
   * Create a new round
   */
  private async createNewRound(lobby: Lobby2): Promise<void> {
    try {
      if (!lobby.gameState) {
        throw new Error('No active game state');
      }

      const gameState = lobby.gameState;
      const roundIndex = gameState.rounds.length;
      const prompterUsername = selectPrompter(gameState.prompterOrder, roundIndex);

      // Debug logging
      console.log('DEBUG CREATE NEW ROUND:');
      console.log('- roundIndex:', roundIndex);
      console.log('- prompterOrder:', gameState.prompterOrder);
      console.log('- prompterUsername selected:', prompterUsername);
      console.log(
        '- calculation:',
        `${roundIndex} % ${gameState.prompterOrder.length} = ${roundIndex % gameState.prompterOrder.length}`
      );

      // Create new round
      const newRound: GameRound2 = {
        phase: 'prompting',
        phaseEndTime: phaseEndTime(lobby.settings.timeLimit),
        prompterUsername,
        guesses: [],
        readyPlayers: []
      };

      // Add round to game state
      gameState.rounds.push(newRound);

      console.log('- newRound created:', {
        phase: newRound.phase,
        prompterUsername: newRound.prompterUsername,
        phaseEndTime: newRound.phaseEndTime
      });

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Emit phase changed event (the tick will enforce phaseEndTime)
      broadcastLobby(this.io, lobby, 'game:phase_changed');

      console.log(`New round created. Round #${gameState.rounds.length}, Prompter: ${prompterUsername}`);
    } catch (error) {
      console.error('Error creating new round:', error);
      throw error;
    }
  }

  // ==================== Phase Management ====================

  /**
   * Central method to handle all phase transitions
   */
  async transitionToPhase(lobbyCode: string, phase: RoundStatus, data?: any): Promise<void> {
    try {
      // Get the lobby
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) {
        throw new Error('Lobby or game state not found');
      }

      // Get current round
      const gameState = lobby.gameState;
      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (!currentRound) {
        throw new Error('No active round found');
      }

      // Update the phase
      currentRound.phase = phase;

      // Phase-specific state mutation only — NO side effects here, so that everything
      // below is persisted to Redis before any effect (which re-reads Redis) can run.
      switch (phase) {
        case 'prompting':
          currentRound.phaseEndTime = phaseEndTime(lobby.settings.timeLimit);
          break;

        case 'generating':
          if (data && data.prompt) {
            currentRound.prompt = data.prompt;
          }
          break;

        case 'guessing':
          if (data && data.imageUrl) {
            currentRound.imageUrl = data.imageUrl;
          }
          currentRound.expectedGuessCount = expectedGuessCount(lobby.players);
          currentRound.phaseEndTime = phaseEndTime(lobby.settings.timeLimit);
          break;

        case 'scoring':
          // Scoring runs as a side effect below; transitions to results when done.
          break;

        case 'results': {
          const RESULTS_DISPLAY_TIME = 20000; // 20 seconds
          currentRound.phaseEndTime = phaseEndTime(RESULTS_DISPLAY_TIME / 1000);
          break;
        }
      }

      // Persist the new state, then tell everyone (redacted per-recipient).
      await this.updateLobby(lobby);
      broadcastLobby(this.io, lobby, 'game:phase_changed');
      console.log(`Transitioned to ${phase} phase for lobby ${lobbyCode}`);

      // Side effects run only AFTER the state is persisted, so anything that re-reads
      // Redis (e.g. image generation, scoring) sees the prompt/guesses we just wrote.
      if (phase === 'generating') {
        void this.startImageGeneration(lobbyCode).catch((err) => console.error('startImageGeneration crashed:', err));
      } else if (phase === 'scoring') {
        void this.scoreRound(lobbyCode).catch((err) => console.error('scoreRound crashed:', err));
      }
    } catch (error) {
      console.error(`Error transitioning to ${phase} phase:`, error);
      throw error;
    }
  }

  // ==================== Deadline Handling ====================

  /**
   * Handle a phase deadline expiring (invoked by the reconciling tick).
   */
  private async handlePhaseTimeout(lobbyCode: string, phase: RoundStatus): Promise<void> {
    try {
      console.log(`Handling ${phase} phase timeout for lobby ${lobbyCode}`);
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) return;

      const gameState = lobby.gameState;
      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      // Make sure we're still in the expected phase
      if (currentRound.phase !== phase) {
        console.log(`Phase already changed from ${phase} to ${currentRound.phase}, ignoring timeout`);
        return;
      }

      // Phase-specific timeout handling
      switch (phase) {
        case 'prompting':
          await this.handlePromptTimeout(lobbyCode);
          break;

        case 'guessing':
          await this.handleGuessTimeout(lobbyCode);
          break;

        case 'results':
          await this.handleReadyPhaseTimeout(lobbyCode);
          break;
      }
    } catch (error) {
      console.error(`Error handling ${phase} phase timeout:`, error);
      // Try to recover by moving to next round or ending game
      const lobby = await this.getLobby(lobbyCode);
      if (lobby && lobby.gameState) {
        if (this.isGameComplete(lobby)) {
          await this.endGame(lobbyCode);
        } else {
          await this.createNewRound(lobby);
        }
      }
    }
  }

  // ==================== Prompting Phase Methods ====================

  /**
   * Handle prompt submission from a player
   */
  async handlePromptSubmission(lobbyCode: string, username: string, prompt: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const gameState = lobby.gameState;
      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      // Verify this is the correct prompter
      if (currentRound.prompterUsername !== username) {
        throw new Error('Not the current prompter');
      }

      // Verify we're in prompting phase
      if (currentRound.phase !== 'prompting') {
        throw new Error('Not in prompting phase');
      }

      // Transition to generating phase with the prompt
      await this.transitionToPhase(lobbyCode, 'generating', { prompt });
    } catch (error) {
      console.error('Error handling prompt submission:', error);
      throw error;
    }
  }

  /**
   * Handle prompt timeout - request draft or skip round
   */
  private async handlePromptTimeout(lobbyCode: string): Promise<void> {
    try {
      console.log(`Handling prompt timeout for lobby ${lobbyCode}`);
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const gameState = lobby.gameState;
      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      if (currentRound.phase !== 'prompting') {
        console.log('Round already has a prompt, no action needed');
        return;
      }

      // Find the prompter's socket
      const prompter = lobby.players.find((p) => p.username === currentRound.prompterUsername);
      if (!prompter || !prompter.id) {
        console.log('Prompter not found or not connected, skipping round');
        await this.skipRound(lobbyCode);
        return;
      }

      // Request draft prompt from the prompter
      console.log('Requesting draft from prompter...');
      this.io.to(prompter.id).emit('game:request_prompt_draft');

      // Give them a short window to respond (1 second)
      setTimeout(async () => {
        const updatedLobby = await this.getLobby(lobbyCode);
        if (!updatedLobby || !updatedLobby.gameState) return;

        const updatedRound = updatedLobby.gameState.rounds[updatedLobby.gameState.rounds.length - 1];

        // If still in prompting phase, skip the round
        if (updatedRound.phase === 'prompting') {
          console.log('No prompt draft received, skipping round');
          await this.skipRound(lobbyCode);
        }
      }, 1000);
    } catch (error) {
      console.error('Error handling prompt timeout:', error);
      await this.skipRound(lobbyCode);
    }
  }

  /**
   * Skip the current round and move to the next
   */
  private async skipRound(lobbyCode: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      // Mark the current round as skipped
      const gameState = lobby.gameState;
      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      currentRound.phase = 'skipped';

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Check if game is complete
      if (this.isGameComplete(lobby)) {
        await this.endGame(lobbyCode);
      } else {
        // Create a new round
        await this.createNewRound(lobby);
      }
    } catch (error) {
      console.error('Error skipping round:', error);
      throw error;
    }
  }

  // ==================== Image Generation Phase Methods ====================

  /**
   * Start image generation process
   */
  private async startImageGeneration(lobbyCode: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const gameState = lobby.gameState;
      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      if (!currentRound.prompt) {
        throw new Error('No prompt available for image generation');
      }

      // Start the image generation process
      console.log(`Starting image generation for prompt: "${currentRound.prompt}"`);

      // Create and store the generation promise
      const generationPromise = this.generateImage(currentRound.prompt);

      // Wait for the image to be generated
      try {
        const imageUrl = await generationPromise;

        // Transition to guessing phase with the image URL
        await this.transitionToPhase(lobbyCode, 'guessing', { imageUrl });
      } catch (error) {
        console.error('Image generation failed:', error);

        // Skip the round on failure
        await this.skipRound(lobbyCode);
      }
    } catch (error) {
      console.error('Error starting image generation:', error);
      await this.skipRound(lobbyCode);
    }
  }

  /**
   * Generate an image using the fal.ai API
   */
  private async generateImage(prompt: string): Promise<string> {
    // Dev-only escape hatch: skip the paid FAL call and return a deterministic
    // placeholder image per prompt, so the full loop can be playtested for free.
    if (process.env.MOCK_IMAGE === '1') {
      return `https://picsum.photos/seed/${encodeURIComponent(prompt)}/800/600`;
    }

    try {
      console.log('Making API call to generate image for prompt:', prompt);

      const result = await fal.subscribe('fal-ai/flux/schnell', {
        input: {
          prompt,
          image_size: 'landscape_4_3',
          enable_safety_checker: false
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        }
      });

      const imageUrl = result.data.images[0].url;
      if (!imageUrl) {
        throw new Error('No image URL in response');
      }

      console.log('Successfully generated image:', imageUrl);
      return imageUrl;
    } catch (error) {
      console.error('Error generating image:', error);
      throw error;
    }
  }

  // ==================== End Game Methods ====================

  /**
   * End the current game
   */
  async endGame(lobbyCode: string): Promise<void> {
    try {
      console.log(`Ending game for lobby ${lobbyCode}`);

      // Get the lobby
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby) return;

      // Stop the tick from watching this lobby
      await this.unregisterActiveGame(lobbyCode);

      // Update lobby status
      lobby.status = 'waiting';
      lobby.gameState = undefined;

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Notify all players that the game has ended (round secrets fully revealed by now)
      broadcastLobby(this.io, lobby, 'game:ended');

      console.log(`Game ended for lobby ${lobbyCode}`);
    } catch (error) {
      console.error('Error ending game:', error);
      throw error;
    }
  }

  // ==================== Guessing Phase Methods ====================

  /**
   * Handle a guess submission: record (or revise) the player's guess, tell everyone someone
   * guessed, and advance to scoring as soon as every expected guesser is in.
   */
  async handleGuessSubmission(lobbyCode: string, username: string, guess: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const gameState = lobby.gameState;
      const lastIdx = gameState.rounds.length - 1;
      const currentRound = gameState.rounds[lastIdx];

      // Only accept guesses during the guessing phase, and never from the prompter
      if (currentRound.phase !== 'guessing') return;
      if (currentRound.prompterUsername === username) return;

      // Record the guess
      gameState.rounds[lastIdx] = applyGuess(currentRound, username, guess, new Date());
      await this.updateLobby(lobby);

      // Let everyone know someone guessed (contents stay redacted per-recipient)
      broadcastLobby(this.io, lobby, 'game:guess_submitted');

      // Everyone in? Move straight to scoring.
      if (allGuessesIn(gameState.rounds[lastIdx])) {
        await this.transitionToPhase(lobbyCode, 'scoring');
      }
    } catch (error) {
      console.error('Error handling guess submission:', error);
      throw error;
    }
  }

  /**
   * Guessing deadline reached: nudge connected guessers who haven't submitted for their draft,
   * then after a short grace move to scoring with whatever guesses arrived.
   */
  private async handleGuessTimeout(lobbyCode: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const currentRound = lobby.gameState.rounds[lobby.gameState.rounds.length - 1];
      if (currentRound.phase !== 'guessing') return;

      const laggards = lobby.players.filter(
        (p) =>
          p.connected && p.id && p.username !== currentRound.prompterUsername && !hasGuessed(currentRound, p.username)
      );
      for (const p of laggards) {
        this.io.to(p.id).emit('game:request_guess_draft');
      }

      // Give drafts a moment to land, then score whatever we have.
      setTimeout(async () => {
        const updated = await this.getLobby(lobbyCode);
        if (!updated || !updated.gameState) return;
        const round = updated.gameState.rounds[updated.gameState.rounds.length - 1];
        if (round.phase === 'guessing') {
          await this.transitionToPhase(lobbyCode, 'scoring');
        }
      }, 1000);
    } catch (error) {
      console.error('Error handling guess timeout:', error);
      await this.transitionToPhase(lobbyCode, 'scoring');
    }
  }

  // ==================== Scoring Phase Methods ====================

  /**
   * Score the round's guesses with Claude, roll the scores into game totals, then advance
   * to results. Runs as a side effect of entering the 'scoring' phase. On any failure we
   * still advance to results (with whatever scores we have) so the game never stalls.
   */
  private async scoreRound(lobbyCode: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const gameState = lobby.gameState;
      const lastIdx = gameState.rounds.length - 1;
      const round = gameState.rounds[lastIdx];

      if (round.prompt && round.guesses.length > 0) {
        const toScore = round.guesses.map((g, index) => ({ index, guess: g.guess }));
        const scoreByIndex = await scoreGuesses(round.prompt, toScore);

        const scoreByUsername = new Map<string, number>();
        round.guesses.forEach((g, index) => scoreByUsername.set(g.username, scoreByIndex.get(index) ?? 0));

        gameState.rounds[lastIdx] = applyScores(round, scoreByUsername);
        gameState.scores = rollUpTotals(gameState.rounds, gameState.prompterOrder);
        await this.updateLobby(lobby);
      }

      await this.transitionToPhase(lobbyCode, 'results');
    } catch (error) {
      console.error('Error scoring round:', error);
      await this.transitionToPhase(lobbyCode, 'results');
    }
  }

  // ==================== Results / Ready-up Phase Methods ====================

  /**
   * A player readied up during results. Record it, tell everyone, and advance to the next
   * round (or end the game) once every connected player is ready.
   */
  async handlePlayerReady(lobbyCode: string, username: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) throw new Error('Game not found');

      const gameState = lobby.gameState;
      const lastIdx = gameState.rounds.length - 1;
      const round = gameState.rounds[lastIdx];

      // Only meaningful during results, and only from a connected member of this lobby
      if (round.phase !== 'results') return;
      if (!lobby.players.some((p) => p.username === username && p.connected)) return;

      round.readyPlayers = addReady(round.readyPlayers, username);
      await this.updateLobby(lobby);
      broadcastLobby(this.io, lobby, 'game:ready_state_update');

      const connectedUsernames = lobby.players.filter((p) => p.connected).map((p) => p.username);
      if (allReady(round.readyPlayers, connectedUsernames)) {
        await this.advanceAfterResults(lobbyCode);
      }
    } catch (error) {
      console.error('Error handling player ready:', error);
      throw error;
    }
  }

  /** Results deadline reached — advance regardless of who readied up. */
  private async handleReadyPhaseTimeout(lobbyCode: string): Promise<void> {
    await this.advanceAfterResults(lobbyCode);
  }

  /**
   * Leave the results phase: start the next round, or end the game if all rounds are played.
   * Guarded so the all-ready path and the deadline tick can't both advance the same round.
   */
  private async advanceAfterResults(lobbyCode: string): Promise<void> {
    if (this.advancing.has(lobbyCode)) return;
    this.advancing.add(lobbyCode);
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby || !lobby.gameState) return;

      const round = lobby.gameState.rounds[lobby.gameState.rounds.length - 1];
      if (round.phase !== 'results') return; // already advanced

      if (this.isGameComplete(lobby)) {
        await this.endGame(lobbyCode);
      } else {
        await this.createNewRound(lobby);
      }
    } catch (error) {
      console.error('Error advancing after results:', error);
    } finally {
      this.advancing.delete(lobbyCode);
    }
  }
}
