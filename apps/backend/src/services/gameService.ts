import { Server } from 'socket.io';
import { GameState, Lobby, GameRound } from '@promptmaster/shared';
import { OpenAI } from 'openai';
import fetch from 'node-fetch';
import redisClient from '../config/redis';

export class GameService {
  private activeGameTimers: Map<string, NodeJS.Timeout>;
  private draftPrompts: Map<string, string>; // lobbyCode -> current draft prompt

  constructor(private io: Server) {
    this.activeGameTimers = new Map();
    this.draftPrompts = new Map();
  }

  // async initializeGame(lobbyCode: string): Promise<GameState> {
  //   try {
  //     // Get lobby data to access players and settings
  //     const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
  //     if (!lobbyData) {
  //       throw new Error('Lobby not found');
  //     }
  //     const lobby: Lobby = JSON.parse(lobbyData);

  //     // Get connected players and shuffle them for prompter order
  //     const connectedPlayers = lobby.players.filter(
  //       (player) => player.connected
  //     );
  //     const prompterOrder = this.shuffleArray(
  //       connectedPlayers.map((p) => p.id)
  //     );

  //     // Initialize game state
  //     const gameState: GameState = {
  //       lobbyCode,
  //       rounds: [],
  //       prompterOrder,
  //       scores: connectedPlayers.map((player) => ({
  //         playerId: player.id,
  //         totalScore: 0,
  //       })),
  //     };

  //     // Save game state to Redis
  //     await this.updateGameState(gameState);

  //     // Start first round
  //     await this.startNewRound(lobbyCode);

  //     return gameState;
  //   } catch (error) {
  //     console.error('Error initializing game:', error);
  //     throw new Error('Failed to initialize game');
  //   }
  // }

  async initializeGame(lobbyCode: string): Promise<GameState> {
    try {
      console.log('Initializing game for lobby:', lobbyCode);
      // Get lobby data to access players and settings
      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) {
        throw new Error('Lobby not found');
      }
      const lobby: Lobby = JSON.parse(lobbyData);
      console.log('Found lobby data:', lobby);

      // Get connected players and shuffle them for prompter order
      const connectedPlayers = lobby.players.filter(
        (player) => player.connected
      );
      const prompterOrder = this.shuffleArray(
        connectedPlayers.map((p) => p.id)
      );
      console.log('Shuffled prompter order:', prompterOrder);

      // Initialize game state
      const gameState: GameState = {
        lobbyCode,
        rounds: [], // Will add first round after saving initial state
        prompterOrder,
        scores: connectedPlayers.map((player) => ({
          playerId: player.id,
          totalScore: 0,
        })),
      };

      // Save initial game state
      await this.updateGameState(gameState);
      console.log('Saved initial game state');

      // Create first round
      const firstRound: GameRound = {
        prompterId: prompterOrder[0],
        prompt: '',
        guesses: [],
        status: 'prompting',
      };

      // Add round to game state
      gameState.rounds.push(firstRound);

      // Save updated game state with first round
      await this.updateGameState(gameState);
      console.log('Added first round to game state:', firstRound);

      // Notify clients about the first round
      this.io.to(`lobby:${lobbyCode}`).emit('game:round_started', firstRound);
      console.log('Emitted game:round_started event');

      // Start prompt timer for first round
      await this.startPromptTimer(lobbyCode);
      console.log('Started prompt timer for first round');

      return gameState;
    } catch (error) {
      console.error('Error initializing game:', error);
      throw new Error('Failed to initialize game');
    }
  }

  async endGame(lobbyCode: string): Promise<void> {
    try {
      // Clear any active timers
      this.clearActiveTimer(lobbyCode);

      // Clean up draft prompts
      this.draftPrompts.delete(lobbyCode);

      // Delete game state from Redis
      await redisClient.del(`game:${lobbyCode}`);

      // Notify clients
      this.io.to(`lobby:${lobbyCode}`).emit('game:ended');
    } catch (error) {
      console.error('Error ending game:', error);
      throw error;
    }
  }

  async handleDraftPrompt(lobbyCode: string, draft: string): Promise<void> {
    this.draftPrompts.set(lobbyCode, draft);
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

      // Validate this is the current prompter
      if (currentRound.prompterId !== playerId) {
        throw new Error('Not the current prompter');
      }

      // Clear any existing timer
      this.clearActiveTimer(lobbyCode);

      // Clear draft prompt
      this.draftPrompts.delete(lobbyCode);

      // Update round with prompt and start image generation
      await this.processPrompt(lobbyCode, prompt);
    } catch (error) {
      console.error('Error handling prompt submission:', error);
      throw error;
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
      if (currentRound.status !== 'guessing')
        throw new Error('Not in guessing phase');

      // Validate player isn't the prompter
      if (currentRound.prompterId === playerId) {
        throw new Error('Prompter cannot submit a guess');
      }

      // Check if player already submitted a guess
      if (currentRound.guesses.some((g) => g.playerId === playerId)) {
        throw new Error('Player already submitted a guess');
      }

      // Add the guess
      currentRound.guesses.push({
        playerId,
        guess,
        submittedAt: new Date(),
      });

      await this.updateGameState(gameState);

      // Notify clients about the new guess
      this.io.to(`lobby:${lobbyCode}`).emit('game:guess_submitted', playerId);

      // Check if all non-prompter players have submitted guesses
      const connectedPlayers = await this.getConnectedPlayerCount(lobbyCode);
      const expectedGuessCount = connectedPlayers - 1; // Subtract prompter

      if (currentRound.guesses.length >= expectedGuessCount) {
        // Clear timer as all guesses are in
        this.clearActiveTimer(lobbyCode);
        // Move to scoring phase
        await this.startScoringPhase(lobbyCode);
      }
    } catch (error) {
      console.error('Error handling guess submission:', error);
      throw error;
    }
  }

  private async startNewRound(lobbyCode: string): Promise<void> {
    const gameState = await this.getGameState(lobbyCode);
    if (!gameState) {
      throw new Error('Game not found');
    }

    // Get current prompter using modulo
    const currentPrompterId =
      gameState.prompterOrder[
        gameState.rounds.length % gameState.prompterOrder.length
      ];

    // Create new round
    const newRound: GameRound = {
      prompterId: currentPrompterId,
      prompt: '',
      guesses: [],
      status: 'prompting',
    };

    // Add round to game state
    gameState.rounds.push(newRound);
    await this.updateGameState(gameState);

    // Start prompt timer and notify clients
    await this.startPromptTimer(lobbyCode);

    // Notify all clients about new round
    this.io.to(`lobby:${lobbyCode}`).emit('game:round_started', newRound);
  }

  private async processPrompt(
    lobbyCode: string,
    prompt: string
  ): Promise<void> {
    const gameState = await this.getGameState(lobbyCode);
    if (!gameState) throw new Error('Game not found');

    const currentRound = gameState.rounds[gameState.rounds.length - 1];

    // Update round status and prompt
    currentRound.status = 'generating';
    currentRound.prompt = prompt;

    // Save state before starting generation
    await this.updateGameState(gameState);

    // Notify clients that we're generating
    this.io
      .to(`lobby:${lobbyCode}`)
      .emit('game:prompt_submitted', currentRound.prompterId);

    try {
      // Generate image
      const imageUrl = await this.generateImage(prompt);

      // Update round with image URL
      currentRound.imageUrl = imageUrl;
      currentRound.status = 'guessing';

      await this.updateGameState(gameState);

      // Start guess phase
      await this.startGuessingPhase(lobbyCode);
    } catch (error) {
      console.error('Image generation failed:', error);
      if (error instanceof Error) {
        currentRound.imageGenerationError = error.message;
      }
      await this.updateGameState(gameState);

      // Skip to next round
      await this.startNewRound(lobbyCode);
    }
  }

  private async startGuessingPhase(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (!currentRound.imageUrl)
        throw new Error('No image generated for guessing phase');

      // Start guess timer
      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) throw new Error('Lobby not found');
      const lobby: Lobby = JSON.parse(lobbyData);

      // Create timer for guessing phase
      const timer = setTimeout(
        () => this.handleGuessTimeout(lobbyCode),
        lobby.settings.timeLimit * 1000
      );

      this.activeGameTimers.set(lobbyCode, timer);

      // Notify clients guessing phase has started
      this.io.to(`lobby:${lobbyCode}`).emit('game:guessing_started', {
        imageUrl: currentRound.imageUrl,
        timeLimit: lobby.settings.timeLimit,
      });
    } catch (error) {
      console.error('Error starting guessing phase:', error);
      await this.startNewRound(lobbyCode); // Skip round if guessing phase fails to start
    }
  }

  private async startScoringPhase(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      currentRound.status = 'scoring';
      await this.updateGameState(gameState);

      // Notify clients scoring has started
      this.io.to(`lobby:${lobbyCode}`).emit('game:scoring_started');

      // Get all guesses to score
      const guessTexts = currentRound.guesses.map((g) => g.guess);

      if (guessTexts.length === 0) {
        // No guesses to score, move to results
        await this.startResultsPhase(lobbyCode);
        return;
      }

      try {
        // Score all guesses
        const scores = await this.scoreGuesses(currentRound.prompt, guessTexts);

        // Update guesses with scores
        currentRound.guesses.forEach((guess, index) => {
          guess.score = scores[index];
        });

        // Update total scores for players
        currentRound.guesses.forEach((guess) => {
          const playerScore = gameState.scores.find(
            (s) => s.playerId === guess.playerId
          );
          if (playerScore && guess.score !== undefined) {
            playerScore.totalScore += guess.score;
          }
        });

        await this.updateGameState(gameState);

        // Move to results phase
        await this.startResultsPhase(lobbyCode);
      } catch (error) {
        console.error('Error scoring guesses:', error);
        // If scoring fails, skip scoring and move to results
        await this.startResultsPhase(lobbyCode);
      }
    } catch (error) {
      console.error('Error starting scoring phase:', error);
      await this.startNewRound(lobbyCode); // Skip to next round if something goes wrong
    }
  }

  private async startResultsPhase(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      currentRound.status = 'results';
      await this.updateGameState(gameState);

      // Send results to clients
      this.io.to(`lobby:${lobbyCode}`).emit('game:results', {
        originalPrompt: currentRound.prompt,
        guesses: currentRound.guesses,
        scores: gameState.scores,
      });

      // Check if game should end
      const gameComplete = await this.isGameComplete(gameState); // Now awaiting this
      if (gameComplete) {
        // Wait a bit before ending game to let players see results
        setTimeout(() => this.endGame(lobbyCode), 5000);
      } else {
        // Wait a bit before starting next round
        setTimeout(() => this.startNewRound(lobbyCode), 5000);
      }
    } catch (error) {
      console.error('Error starting results phase:', error);
      // If something goes wrong, try to start next round
      await this.startNewRound(lobbyCode);
    }
  }

  // private async startPromptTimer(lobbyCode: string): Promise<void> {
  //   // Clear any existing timer
  //   this.clearActiveTimer(lobbyCode);

  //   try {
  //     // Get time limit from lobby settings
  //     const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
  //     if (!lobbyData) throw new Error('Lobby not found');
  //     const lobby: Lobby = JSON.parse(lobbyData);

  //     const timer = setTimeout(
  //       () => this.handlePromptTimeout(lobbyCode),
  //       lobby.settings.timeLimit * 1000
  //     );

  //     this.activeGameTimers.set(lobbyCode, timer);
  //   } catch (error) {
  //     console.error('Error starting prompt timer:', error);
  //     throw error;
  //   }
  // }

  private async startPromptTimer(lobbyCode: string): Promise<void> {
    // Clear any existing timer
    this.clearActiveTimer(lobbyCode);

    try {
      // Get time limit from lobby settings
      const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
      if (!lobbyData) throw new Error('Lobby not found');
      const lobby: Lobby = JSON.parse(lobbyData);

      const timer = setTimeout(
        () => this.handlePromptTimeout(lobbyCode),
        lobby.settings.timeLimit * 1000
      );

      this.activeGameTimers.set(lobbyCode, timer);
      console.log(
        `Started prompt timer for ${lobby.settings.timeLimit} seconds`
      );
    } catch (error) {
      console.error('Error starting prompt timer:', error);
      throw error;
    }
  }

  private async handlePromptTimeout(lobbyCode: string): Promise<void> {
    try {
      // Get the draft prompt if it exists
      const draftPrompt = this.draftPrompts.get(lobbyCode);

      if (draftPrompt?.trim()) {
        // If there's a draft, submit it
        const gameState = await this.getGameState(lobbyCode);
        if (!gameState) throw new Error('Game not found');

        const currentRound = gameState.rounds[gameState.rounds.length - 1];
        await this.processPrompt(lobbyCode, draftPrompt);
      } else {
        // No draft prompt, skip the round
        await this.startNewRound(lobbyCode);
      }

      // Clean up
      this.draftPrompts.delete(lobbyCode);
      this.activeGameTimers.delete(lobbyCode);
    } catch (error) {
      console.error('Error handling prompt timeout:', error);
      // If anything fails, skip to next round
      await this.startNewRound(lobbyCode);
    }
  }

  private async handleGuessTimeout(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      // Move directly to scoring with whatever guesses we have
      await this.startScoringPhase(lobbyCode);
    } catch (error) {
      console.error('Error handling guess timeout:', error);
      await this.startNewRound(lobbyCode); // Skip to next round if something goes wrong
    }
  }

  private clearActiveTimer(lobbyCode: string): void {
    const existingTimer = this.activeGameTimers.get(lobbyCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.activeGameTimers.delete(lobbyCode);
    }
  }

  // private async updateGameState(gameState: GameState): Promise<void> {
  //   await redisClient.setEx(
  //     `game:${gameState.lobbyCode}`,
  //     24 * 60 * 60, // 24 hours
  //     JSON.stringify(gameState)
  //   );
  // }

  private async updateGameState(gameState: GameState): Promise<void> {
    await redisClient.setEx(
      `game:${gameState.lobbyCode}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify(gameState)
    );
  }

  private async getGameState(lobbyCode: string): Promise<GameState | null> {
    const gameData = await redisClient.get(`game:${lobbyCode}`);
    return gameData ? JSON.parse(gameData) : null;
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
      // If we can't determine completion status, assume not complete
      return false;
    }
  }

  private async generateImage(prompt: string): Promise<string> {
    try {
      const response = await fetch('https://fal.run/fal-ai/fast-many', {
        method: 'POST',
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          // Keeping default parameters for speed
          num_images: 1,
          negative_prompt: 'blurry, ugly, malformed, distorted, broken',
          high_quality_base: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Image generation failed: ${response.statusText}`);
      }

      const data = await response.json();

      // The API returns an array of image URLs, we just want the first one
      if (!data.images?.[0]?.url) {
        throw new Error('No image URL in response');
      }

      return data.images[0].url;
    } catch (error) {
      console.error('Error generating image:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Image generation failed');
    }
  }

  private async scoreGuesses(
    originalPrompt: string,
    guesses: string[]
  ): Promise<number[]> {
    try {
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Create our scoring prompt
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
        model: 'gpt-4', // Using GPT-4 for better accuracy
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent scoring
      });

      // Parse the response to get scores
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('No response from OpenAI');

      // Extract array from response using regex
      const match = content.match(/\[(.*?)\]/);
      if (!match) throw new Error('Invalid response format');

      const scores = JSON.parse(`[${match[1]}]`);

      // Validate scores
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
      // Fallback: return random scores if OpenAI fails
      return guesses.map(() => Math.floor(Math.random() * 101));
    }
  }

  // Fisher-Yates shuffle for randomizing prompter order
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
