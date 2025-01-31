import { Server } from 'socket.io';
import { GameState, Lobby, GameRound } from '@promptmaster/shared';
import { OpenAI } from 'openai';
import { fal } from '@fal-ai/client';
import redisClient from '../config/redis';

export class GameService {
  private activeGameTimers: Map<string, NodeJS.Timeout>;

  constructor(private io: Server) {
    this.activeGameTimers = new Map();
  }

  // ==================== Core Infrastructure ====================

  private calculatePhaseEndTime(durationSeconds: number): number {
    return Date.now() + durationSeconds * 1000;
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private clearActiveTimer(lobbyCode: string): void {
    const existingTimer = this.activeGameTimers.get(lobbyCode);
    if (existingTimer) {
      console.log(`Clearing active timer for lobby ${lobbyCode}`);
      clearTimeout(existingTimer);
      this.activeGameTimers.delete(lobbyCode);
    } else {
      console.log(`No active timer found for lobby ${lobbyCode}`);
    }
  }

  private setActiveTimer(
    lobbyCode: string,
    timer: NodeJS.Timeout,
    phase: string
  ): void {
    this.clearActiveTimer(lobbyCode);
    console.log(`Setting new ${phase} timer for lobby ${lobbyCode}`);
    this.activeGameTimers.set(lobbyCode, timer);
  }

  private async getGameState(lobbyCode: string): Promise<GameState | null> {
    const gameData = await redisClient.get(`game:${lobbyCode}`);
    return gameData ? JSON.parse(gameData) : null;
  }

  private async updateGameState(gameState: GameState): Promise<void> {
    await redisClient.setEx(
      `game:${gameState.lobbyCode}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify(gameState)
    );
  }

  private async getConnectedPlayerCount(lobbyCode: string): Promise<number> {
    const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
    if (!lobbyData) throw new Error('Lobby not found');

    const lobby: Lobby = JSON.parse(lobbyData);
    return lobby.players.filter((p) => p.connected).length;
  }

  private async getRoundsPerPlayer(lobbyCode: string): Promise<number> {
    const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
    if (!lobbyData) throw new Error('Lobby not found');
    const lobby: Lobby = JSON.parse(lobbyData);
    return lobby.settings.roundsPerPlayer;
  }

  private async isGameComplete(gameState: GameState): Promise<boolean> {
    try {
      const totalRoundsPlayed = gameState.rounds.length;
      const roundsPerPlayer = await this.getRoundsPerPlayer(
        gameState.lobbyCode
      );
      const expectedRounds = gameState.prompterOrder.length * roundsPerPlayer;
      return totalRoundsPlayed >= expectedRounds;
    } catch (error) {
      console.error('Error checking game completion:', error);
      return false;
    }
  }

  // ==================== Game Initialization ====================

  async initializeGame(lobbyCode: string): Promise<GameState> {
    try {
      console.log('Initializing game for lobby:', lobbyCode);
      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) {
        throw new Error('Lobby not found');
      }
      const lobby: Lobby = JSON.parse(lobbyData);
      console.log('Found lobby data:', lobby);

      const connectedPlayers = lobby.players.filter(
        (player) => player.connected
      );
      const prompterOrder = this.shuffleArray(
        connectedPlayers.map((p) => p.id)
      );
      console.log('Shuffled prompter order:', prompterOrder);

      const endTime = this.calculatePhaseEndTime(lobby.settings.timeLimit);

      const gameState: GameState = {
        lobbyCode,
        rounds: [],
        prompterOrder,
        scores: connectedPlayers.map((player) => ({
          playerId: player.id,
          totalScore: 0
        }))
      };

      const firstRound: GameRound = {
        prompterId: prompterOrder[0],
        prompt: '',
        guesses: [],
        status: 'prompting',
        endTime: endTime,
        expectedGuessCount: connectedPlayers.length - 1
      };

      gameState.rounds.push(firstRound);
      await this.updateGameState(gameState);
      console.log('Added first round to game state:', firstRound);

      this.io.to(`lobby:${lobbyCode}`).emit('game:started', gameState);
      console.log('Emitted game:started with state:', gameState);

      this.io.to(`lobby:${lobbyCode}`).emit('game:round_started', firstRound);
      console.log('Emitted game:round_started event');

      const timer = setTimeout(
        () => this.handlePromptTimeout(lobbyCode),
        lobby.settings.timeLimit * 1000
      );
      this.activeGameTimers.set(lobbyCode, timer);
      console.log(
        'Started prompt timer, ending at',
        new Date(endTime).toISOString()
      );

      return gameState;
    } catch (error) {
      console.error('Error initializing game:', error);
      throw new Error('Failed to initialize game');
    }
  }

  private async startNewRound(lobbyCode: string): Promise<void> {
    const gameState = await this.getGameState(lobbyCode);
    if (!gameState) {
      throw new Error('Game not found');
    }

    const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
    if (!lobbyData) throw new Error('Lobby not found');
    const lobby: Lobby = JSON.parse(lobbyData);

    const currentPrompterId =
      gameState.prompterOrder[
        gameState.rounds.length % gameState.prompterOrder.length
      ];

    const connectedPlayers = lobby.players.filter((p) => p.connected);

    const newRound: GameRound = {
      prompterId: currentPrompterId,
      prompt: '',
      guesses: [],
      status: 'prompting',
      expectedGuessCount: connectedPlayers.length - 1
    };

    gameState.rounds.push(newRound);
    await this.updateGameState(gameState);

    await this.startPromptTimer(lobbyCode);

    this.io.to(`lobby:${lobbyCode}`).emit('game:round_started', newRound);
  }

  // ==================== Prompting Phase ====================

  private async startPromptTimer(lobbyCode: string): Promise<void> {
    this.clearActiveTimer(lobbyCode);

    try {
      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) throw new Error('Lobby not found');
      const lobby: Lobby = JSON.parse(lobbyData);

      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');
      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (!currentRound) throw new Error('No active round');

      const endTime = this.calculatePhaseEndTime(lobby.settings.timeLimit);
      console.log('Setting round endTime to:', endTime);

      currentRound.endTime = endTime;
      await this.updateGameState(gameState);

      this.io.to(`lobby:${lobbyCode}`).emit('game:round_started', currentRound);

      const timer = setTimeout(
        () => this.handlePromptTimeout(lobbyCode),
        lobby.settings.timeLimit * 1000
      );

      this.activeGameTimers.set(lobbyCode, timer);
      console.log(
        `Started prompt timer, ending at ${new Date(endTime).toISOString()}`
      );
    } catch (error) {
      console.error('Error starting prompt timer:', error);
      throw error;
    }
  }

  async handlePromptSubmission(
    lobbyCode: string,
    playerId: string,
    prompt: string
  ): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (!currentRound) throw new Error('No active round');

      if (currentRound.prompterId !== playerId) {
        throw new Error('Not the current prompter');
      }

      this.clearActiveTimer(lobbyCode);

      await this.processPrompt(lobbyCode, prompt);
    } catch (error) {
      console.error('Error handling prompt submission:', error);
      throw error;
    }
  }

  private async handlePromptTimeout(lobbyCode: string): Promise<void> {
    try {
      console.log(`Handling prompt timeout for lobby ${lobbyCode}`);

      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      if (currentRound.status !== 'prompting') {
        console.log('Round already has a prompt, no action needed');
        return;
      }

      console.log('Requesting draft from prompter...');
      this.io.to(currentRound.prompterId).emit('game:request_draft');

      try {
        const cleanupFunctions: Array<() => void> = [];

        const draftPromise = new Promise<string | null>((resolve) => {
          const draftHandler = (draft: string) => {
            currentRound.status = 'generating';
            resolve(draft);
          };

          const socket = this.io.sockets.sockets.get(currentRound.prompterId);
          if (socket) {
            socket.once('game:submit_draft', draftHandler);
            cleanupFunctions.push(() => {
              socket.removeListener('game:submit_draft', draftHandler);
            });
          }

          const timer = setTimeout(() => {
            if (socket) {
              socket.removeListener('game:submit_draft', draftHandler);
            }
            resolve(null);
          }, 1000);

          cleanupFunctions.push(() => clearTimeout(timer));
        });

        draftPromise.finally(() => {
          cleanupFunctions.forEach((cleanup) => cleanup());
        });

        const draft = await draftPromise;

        const updatedGameState = await this.getGameState(lobbyCode);
        if (!updatedGameState) throw new Error('Game not found');

        const updatedRound =
          updatedGameState.rounds[updatedGameState.rounds.length - 1];

        if (
          updatedRound.status === 'generating' &&
          updatedRound.prompterId === currentRound.prompterId
        ) {
          if (draft?.trim()) {
            console.log(`Received valid draft prompt: "${draft}"`);
            await this.processPrompt(lobbyCode, draft.trim());
          } else {
            console.log('No draft received, skipping round');
            await this.startNewRound(lobbyCode);
          }
        } else {
          console.log(
            'Round status changed while waiting for draft, continuing...'
          );
        }
      } catch (error) {
        console.error('Error handling draft request:', error);

        const finalCheckGameState = await this.getGameState(lobbyCode);
        if (
          finalCheckGameState?.rounds[finalCheckGameState.rounds.length - 1]
            .status === 'prompting'
        ) {
          console.log(
            'Error occurred and still in prompting phase, skipping round'
          );
          await this.startNewRound(lobbyCode);
        }
      }

      this.clearActiveTimer(lobbyCode);
    } catch (error) {
      console.error('Error handling prompt timeout:', error);
      await this.startNewRound(lobbyCode);
    }
  }

  private async processPrompt(
    lobbyCode: string,
    prompt: string
  ): Promise<void> {
    const gameState = await this.getGameState(lobbyCode);
    if (!gameState) throw new Error('Game not found');

    const currentRound = gameState.rounds[gameState.rounds.length - 1];

    currentRound.status = 'generating';
    currentRound.prompt = prompt;

    await this.updateGameState(gameState);

    this.io
      .to(`lobby:${lobbyCode}`)
      .emit('game:prompt_submitted', currentRound.prompterId);

    try {
      const imageUrl = await this.generateImage(prompt);

      currentRound.imageUrl = imageUrl;
      currentRound.status = 'guessing';

      await this.updateGameState(gameState);

      await this.startGuessingPhase(lobbyCode);
    } catch (error) {
      console.error('Image generation failed:', error);
      if (error instanceof Error) {
        currentRound.imageGenerationError = error.message;
      }
      await this.updateGameState(gameState);

      await this.startNewRound(lobbyCode);
    }
  }

  private async generateImage(prompt: string): Promise<string> {
    try {
      console.log('Starting image generation for prompt:', prompt);

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
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Image generation failed');
    }
  }

  // ==================== Guessing Phase ====================

  private async startGuessingPhase(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      console.log('Starting guessing phase:', {
        lobbyCode,
        prompterId: currentRound.prompterId,
        expectedGuessCount: currentRound.expectedGuessCount
      });
      if (!currentRound.imageUrl)
        throw new Error('No image generated for guessing phase');

      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) throw new Error('Lobby not found');
      const lobby: Lobby = JSON.parse(lobbyData);

      const endTime = this.calculatePhaseEndTime(lobby.settings.timeLimit);

      const timer = setTimeout(
        () => this.handleGuessTimeout(lobbyCode),
        lobby.settings.timeLimit * 1000
      );

      this.activeGameTimers.set(lobbyCode, timer);

      this.io.to(`lobby:${lobbyCode}`).emit('game:guessing_started', {
        imageUrl: currentRound.imageUrl,
        timeLimit: lobby.settings.timeLimit,
        endTime
      });
    } catch (error) {
      console.error('Error starting guessing phase:', error);
      await this.startNewRound(lobbyCode);
    }
  }

  async handleGuessSubmission(
    lobbyCode: string,
    playerId: string,
    guess: string
  ): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      console.log(`[${lobbyCode}] Processing guess submission:`, {
        playerId,
        currentGuessCount: currentRound.guesses.length,
        expectedGuessCount: currentRound.expectedGuessCount,
        roundStatus: currentRound.status
      });

      // Validation checks
      if (currentRound.status !== 'guessing') {
        throw new Error('Not in guessing phase');
      }

      if (currentRound.prompterId === playerId) {
        throw new Error('Prompter cannot submit a guess');
      }

      if (currentRound.guesses.some((g) => g.playerId === playerId)) {
        throw new Error('Player already submitted a guess');
      }

      // Add the guess
      currentRound.guesses.push({
        playerId,
        guess,
        submittedAt: new Date()
      });

      // Check if this was the last guess
      const connectedPlayers = await this.getConnectedPlayerCount(lobbyCode);
      const expectedGuessCount = connectedPlayers - 1;
      const isLastGuess = currentRound.guesses.length >= expectedGuessCount;

      if (isLastGuess) {
        console.log(
          `[${lobbyCode}] Final guess received, transitioning to scoring`
        );

        // 1. Clear the guessing timer FIRST
        this.clearActiveTimer(lobbyCode);

        // 2. Update the round status
        currentRound.status = 'scoring';
        await this.updateGameState(gameState);

        // 3. Emit the scoring started event
        this.io.to(`lobby:${lobbyCode}`).emit('game:scoring_started');

        // 4. Start the scoring phase
        await this.startScoringPhase(lobbyCode);
      } else {
        // Just save the new guess and emit the guess submitted event
        await this.updateGameState(gameState);
        this.io.to(`lobby:${lobbyCode}`).emit('game:guess_submitted', playerId);
      }
    } catch (error) {
      console.error(`[${lobbyCode}] Error handling guess submission:`, error);
      throw error;
    }
  }

  private async handleGuessTimeout(lobbyCode: string): Promise<void> {
    try {
      console.log(`[${lobbyCode}] Handling guess timeout`);

      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (currentRound.status !== 'guessing') {
        console.log(
          `[${lobbyCode}] Ignoring guess timeout - round is in ${currentRound.status} phase`
        );
        return;
      }

      // Get connected players who haven't submitted a guess yet
      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) throw new Error('Lobby not found');
      const lobby: Lobby = JSON.parse(lobbyData);

      const pendingGuessers = lobby.players.filter(
        (player) =>
          player.connected &&
          player.id !== currentRound.prompterId &&
          !currentRound.guesses.some((g) => g.playerId === player.id)
      );

      console.log(
        `[${lobbyCode}] Requesting drafts from ${pendingGuessers.length} players`
      );

      // Request and collect drafts from all pending guessers
      const draftPromises = pendingGuessers.map((player) => {
        return new Promise<{ playerId: string; guess: string | null }>(
          (resolve) => {
            const cleanupFunctions: Array<() => void> = [];

            // Set up draft handler
            const draftHandler = (draft: string) => {
              resolve({ playerId: player.id, guess: draft.trim() });
            };

            const socket = this.io.sockets.sockets.get(player.id);
            if (socket) {
              socket.once('game:submit_guess_draft', draftHandler);
              cleanupFunctions.push(() => {
                socket.removeListener('game:submit_guess_draft', draftHandler);
              });

              // Request the draft
              socket.emit('game:request_guess_draft');
            }

            // Set timeout for each draft request
            const timer = setTimeout(() => {
              resolve({ playerId: player.id, guess: null });
            }, 1000);

            cleanupFunctions.push(() => clearTimeout(timer));

            // Clean up when promise resolves
            Promise.resolve().finally(() => {
              cleanupFunctions.forEach((cleanup) => cleanup());
            });
          }
        );
      });

      // Wait for all drafts (or timeouts)
      const drafts = await Promise.all(draftPromises);

      // Process valid drafts
      for (const { playerId, guess } of drafts) {
        if (guess) {
          currentRound.guesses.push({
            playerId,
            guess,
            submittedAt: new Date()
          });
        }
      }

      // Update game state with any collected drafts
      await this.updateGameState(gameState);

      // Proceed to scoring phase
      currentRound.status = 'scoring';
      await this.updateGameState(gameState);

      this.io.to(`lobby:${lobbyCode}`).emit('game:scoring_started');

      // Clear timer and start scoring
      this.clearActiveTimer(lobbyCode);
      await this.startScoringPhase(lobbyCode);
    } catch (error) {
      console.error(`[${lobbyCode}] Error handling guess timeout:`, error);
      await this.startNewRound(lobbyCode);
    }
  }

  // private async handleGuessTimeout(lobbyCode: string): Promise<void> {
  //   try {
  //     console.log(`[${lobbyCode}] Handling guess timeout`);

  //     const gameState = await this.getGameState(lobbyCode);
  //     if (!gameState) throw new Error('Game not found');

  //     const currentRound = gameState.rounds[gameState.rounds.length - 1];

  //     // Strong guard to ensure we're in the right phase
  //     if (currentRound.status !== 'guessing') {
  //       console.log(
  //         `[${lobbyCode}] Ignoring guess timeout - round is in ${currentRound.status} phase`
  //       );
  //       return;
  //     }

  //     // First emit the event
  //     this.io.to(`lobby:${lobbyCode}`).emit('game:scoring_started');

  //     // Update the round status
  //     currentRound.status = 'scoring';
  //     await this.updateGameState(gameState);

  //     // Clear timer before moving to scoring
  //     this.clearActiveTimer(lobbyCode);

  //     // Then proceed with scoring phase
  //     await this.startScoringPhase(lobbyCode);
  //   } catch (error) {
  //     console.error(`[${lobbyCode}] Error handling guess timeout:`, error);
  //     await this.startNewRound(lobbyCode);
  //   }
  // }

  // ==================== Scoring Phase ====================

  private async startScoringPhase(lobbyCode: string): Promise<void> {
    console.log(`[${lobbyCode}] Starting scoring phase`);

    // Already cleared timer in handleGuessSubmission
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];

      // Defensive guard
      if (currentRound.status !== 'scoring') {
        console.error(
          `[${lobbyCode}] Invalid phase transition to scoring. Current status: ${currentRound.status}`
        );
        return;
      }

      // Score guesses and move to results...
      // Rest of the scoring logic
    } catch (error) {
      console.error(`[${lobbyCode}] Error in scoring phase:`, error);
      await this.startNewRound(lobbyCode);
    }
  }

  private async handleScoringTimeout(lobbyCode: string): Promise<void> {
    try {
      console.log('Handling scoring timeout for lobby:', lobbyCode);
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (currentRound.status !== 'scoring') {
        console.log('Round is no longer in scoring phase, ignoring timeout');
        return;
      }

      // Assign random scores if scoring timed out
      currentRound.guesses.forEach((guess) => {
        if (guess.score === undefined) {
          guess.score = Math.floor(Math.random() * 101);
        }
      });

      // Update player total scores
      currentRound.guesses.forEach((guess) => {
        const playerScore = gameState.scores.find(
          (s) => s.playerId === guess.playerId
        );
        if (playerScore && guess.score !== undefined) {
          playerScore.totalScore += guess.score;
        }
      });

      await this.updateGameState(gameState);
      await this.startResultsPhase(lobbyCode);
    } catch (error) {
      console.error('Error handling scoring timeout:', error);
      await this.startNewRound(lobbyCode);
    }
  }

  private async scoreGuesses(
    originalPrompt: string,
    guesses: string[]
  ): Promise<number[]> {
    console.log('in scoreGuesses method');
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });

      const prompt = `You are a highly accurate judge of prompt similarity for AI image generation.
  Given an original prompt and a list of guesses, score each guess from 0-100 based on how similar it is to the original.
  Consider:
  - Semantic similarity (meaning)
  - Key objects/subjects
  - Descriptive details
  - Style/mood/atmosphere
  - Composition elements
  
  Original prompt: "${originalPrompt}"
  
  Guesses to score:
  ${guesses.map((guess, i) => `${i + 1}. ${guess}`).join('\n')}
  
  Respond with ONLY an array of numbers representing the scores, like: [85, 72, 45]`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      console.log('OPENAI RESPONSE: ' + { content });
      if (!content) throw new Error('No response from OpenAI');

      const match = content.match(/\[(.*?)\]/);
      if (!match) throw new Error('Invalid response format');

      const scores = JSON.parse(`[${match[1]}]`);

      if (
        !Array.isArray(scores) ||
        scores.length !== guesses.length ||
        !scores.every((s) => typeof s === 'number' && s >= 0 && s <= 100)
      ) {
        throw new Error('Invalid scores returned');
      }

      return scores;
    } catch (error) {
      console.error('Error scoring guesses:', error);
      return guesses.map(() => Math.floor(Math.random() * 101));
    }
  }

  // ==================== Results & Game End ====================

  private async startResultsPhase(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      currentRound.status = 'results';
      await this.updateGameState(gameState);

      this.io.to(`lobby:${lobbyCode}`).emit('game:results', {
        originalPrompt: currentRound.prompt,
        guesses: currentRound.guesses,
        scores: gameState.scores
      });

      const gameComplete = await this.isGameComplete(gameState);
      if (gameComplete) {
        setTimeout(() => this.endGame(lobbyCode), 5000);
      } else {
        setTimeout(() => this.startNewRound(lobbyCode), 5000);
      }
    } catch (error) {
      console.error('Error starting results phase:', error);
      await this.startNewRound(lobbyCode);
    }
  }

  async endGame(lobbyCode: string): Promise<void> {
    try {
      this.clearActiveTimer(lobbyCode);
      await redisClient.del(`game:${lobbyCode}`);
      this.io.to(`lobby:${lobbyCode}`).emit('game:ended');
    } catch (error) {
      console.error('Error ending game:', error);
      throw error;
    }
  }
}
