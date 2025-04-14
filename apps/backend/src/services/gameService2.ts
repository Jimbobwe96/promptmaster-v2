import { Server } from 'socket.io';
import { Lobby2, GameState2, GameRound2, Player, RoundStatus } from '@promptmaster/shared';
import { OpenAI } from 'openai';
import { fal } from '@fal-ai/client';
import redisClient from '../config/redis';

export class GameService2 {
  // Class fields for managing game state
  private activeGameTimers: Map<string, NodeJS.Timeout>;

  constructor(private io: Server) {
    this.activeGameTimers = new Map();
  }

  // ==================== Core Infrastructure Methods ====================

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
    }
  }

  private setActiveTimer(lobbyCode: string, timer: NodeJS.Timeout, phase: string): void {
    this.clearActiveTimer(lobbyCode);
    console.log(`Setting new ${phase} timer for lobby ${lobbyCode}`);
    this.activeGameTimers.set(lobbyCode, timer);
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
   * Get count of connected players in a lobby
   */
  private getConnectedPlayerCount(lobby: Lobby2): number {
    return lobby.players.filter((p) => p.connected).length;
  }

  /**
   * Check if the game is complete (all rounds played)
   */
  private isGameComplete(lobby: Lobby2): boolean {
    const gameState = lobby.gameState;
    if (!gameState) return false;

    const totalRoundsPlayed = gameState.rounds.length;
    const roundsPerPlayer = lobby.settings.roundsPerPlayer;
    const expectedRounds = gameState.prompterOrder.length * roundsPerPlayer;

    return totalRoundsPlayed >= expectedRounds;
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
      const prompterOrder = this.shuffleArray(connectedPlayers.map((p) => p.username));
      console.log('Shuffled prompter order:', prompterOrder);

      // Create game state
      lobby.gameState = {
        rounds: [],
        prompterOrder,
        scores: connectedPlayers.map((player) => ({
          playerId: player.id,
          totalScore: 0
        }))
      };

      // Update lobby status
      lobby.status = 'playing';

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Create the first round
      await this.createNewRound(lobby);

      // Notify all clients that game has started
      this.io.to(`lobby:${lobbyCode}`).emit('game:started', lobby);

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
      const prompterUsername = gameState.prompterOrder[roundIndex % gameState.prompterOrder.length];

      // Create new round
      const newRound: GameRound2 = {
        phase: 'prompting',
        phaseEndTime: this.calculatePhaseEndTime(lobby.settings.timeLimit),
        prompterUsername,
        guesses: [],
        readyPlayers: []
      };

      // Add round to game state
      gameState.rounds.push(newRound);

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Emit phase changed event
      this.io.to(`lobby:${lobby.lobbyCode}`).emit('game:phase_changed', lobby);

      // Start timer for this phase
      this.startPhaseTimer(lobby.lobbyCode, 'prompting', lobby.settings.timeLimit);

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

      // Clear any existing timers
      this.clearActiveTimer(lobbyCode);

      // Update the phase
      currentRound.phase = phase;

      // Phase-specific logic
      switch (phase) {
        case 'prompting':
          // Set phase end time
          currentRound.phaseEndTime = this.calculatePhaseEndTime(lobby.settings.timeLimit);
          this.startPhaseTimer(lobbyCode, 'prompting', lobby.settings.timeLimit);
          break;

        case 'generating':
          // Store the prompt
          if (data && data.prompt) {
            currentRound.prompt = data.prompt;
          }
          // Start image generation
          this.startImageGeneration(lobbyCode);
          break;

        case 'guessing':
          // Store the image URL and set up guessing phase
          if (data && data.imageUrl) {
            currentRound.imageUrl = data.imageUrl;
          }
          // Calculate expected guess count
          currentRound.expectedGuessCount = this.getConnectedPlayerCount(lobby) - 1;
          // Set phase end time
          currentRound.phaseEndTime = this.calculatePhaseEndTime(lobby.settings.timeLimit);
          this.startPhaseTimer(lobbyCode, 'guessing', lobby.settings.timeLimit);
          break;

        case 'scoring':
          // We'll implement scoring logic later
          // This will transition to results when complete
          break;

        case 'results':
          // Set up ready phase
          {
            const RESULTS_DISPLAY_TIME = 20000; // 20 seconds
            currentRound.phaseEndTime = this.calculatePhaseEndTime(RESULTS_DISPLAY_TIME / 1000);
            this.startPhaseTimer(lobbyCode, 'results', RESULTS_DISPLAY_TIME / 1000);
          }
          break;
      }

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Broadcast the phase change to all players
      this.io.to(`lobby:${lobbyCode}`).emit('game:phase_changed', lobby);

      console.log(`Transitioned to ${phase} phase for lobby ${lobbyCode}`);
    } catch (error) {
      console.error(`Error transitioning to ${phase} phase:`, error);
      throw error;
    }
  }

  // ==================== Timer Management ====================

  /**
   * Start a timer for the current phase
   */
  private startPhaseTimer(lobbyCode: string, phase: RoundStatus, durationSeconds: number): void {
    const timer = setTimeout(() => this.handlePhaseTimeout(lobbyCode, phase), durationSeconds * 1000);
    this.setActiveTimer(lobbyCode, timer, phase);
    console.log(`Started ${phase} phase timer for ${durationSeconds} seconds in lobby ${lobbyCode}`);
  }

  /**
   * Handle timer expiration for any phase
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

      // Clear the prompt timer
      this.clearActiveTimer(lobbyCode);

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

      // Clear any active timers
      this.clearActiveTimer(lobbyCode);

      // Update lobby status
      lobby.status = 'waiting';
      lobby.gameState = undefined;

      // Save the updated lobby
      await this.updateLobby(lobby);

      // Notify all players that the game has ended
      this.io.to(`lobby:${lobbyCode}`).emit('game:ended', lobby);

      console.log(`Game ended for lobby ${lobbyCode}`);
    } catch (error) {
      console.error('Error ending game:', error);
      throw error;
    }
  }

  // ==================== Stub Methods for Future Implementation ====================

  // These methods will be implemented later as we continue development

  private async handleGuessTimeout(lobbyCode: string): Promise<void> {
    // Implement later
    console.log(`Guessing phase timeout for ${lobbyCode} - not yet implemented`);
  }

  private async handleReadyPhaseTimeout(lobbyCode: string): Promise<void> {
    // Implement later
    console.log(`Ready phase timeout for ${lobbyCode} - not yet implemented`);
  }
}

// import { Server } from 'socket.io';
// import { Lobby2, GameState2, GameRound2, Player } from '@promptmaster/shared';
// import { OpenAI } from 'openai';
// import { fal } from '@fal-ai/client';
// import redisClient from '../config/redis';

// export class GameService2 {
//   private async getLobby(lobbyCode: string): Promise<Lobby2 | null> {
//     const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
//     return lobbyData ? JSON.parse(lobbyData) : null;
//   }

//   private async updateLobby(lobby: Lobby2): Promise<void> {
//     await redisClient.setEx(`lobby:${lobby.lobbyCode}`, 24 * 60 * 60, JSON.stringify(lobby));
//   }

//   // sample implementation
//   async handlePromptSubmission2(lobbyCode: string, playerId: string, prompt: string): Promise<void> {
//     try {
//       const lobby = await this.getLobby(lobbyCode);
//       if (!lobby) throw new Error('Lobby not found');

//       const gameState = lobby.gameState;
//       if (!gameState) throw new Error('Lobby does not have an active game');

//       const currentRound = gameState.rounds[gameState.rounds.length - 1];
//       if (!currentRound) throw new Error('No active round');

//       // find the player's username
//       const playerUsername = lobby.players.find((p: Player) => p.id === playerId)?.username;
//       if (!playerUsername) throw new Error('Player not found for some odd reason');

//       // check if the player is the prompter
//       if (currentRound.prompterUsername !== playerUsername) {
//         throw new Error('Not the current prompter');
//       }

//       // check if the prompt is valid
//       if (!prompt) throw new Error('Prompt is required');

//       // process the prompt
//       // await this.processPrompt(lobbyCode, prompt);
//     } catch (error) {
//       console.error('Error handling prompt submission:', error);
//       throw error;
//     }
//   }
// }
