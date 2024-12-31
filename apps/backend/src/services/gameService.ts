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
      clearTimeout(existingTimer);
      this.activeGameTimers.delete(lobbyCode);
    }
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
        endTime: endTime
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

    const currentPrompterId =
      gameState.prompterOrder[
        gameState.rounds.length % gameState.prompterOrder.length
      ];

    const newRound: GameRound = {
      prompterId: currentPrompterId,
      prompt: '',
      guesses: [],
      status: 'prompting'
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
      if (currentRound.status !== 'guessing')
        throw new Error('Not in guessing phase');

      if (currentRound.prompterId === playerId) {
        throw new Error('Prompter cannot submit a guess');
      }

      if (currentRound.guesses.some((g) => g.playerId === playerId)) {
        throw new Error('Player already submitted a guess');
      }

      currentRound.guesses.push({
        playerId,
        guess,
        submittedAt: new Date()
      });

      await this.updateGameState(gameState);

      console.log(
        'game:guess_submitted emitted from the backend to the frontend! (entire lobby)'
      );
      this.io.to(`lobby:${lobbyCode}`).emit('game:guess_submitted', playerId);

      const connectedPlayers = await this.getConnectedPlayerCount(lobbyCode);
      const expectedGuessCount = connectedPlayers - 1;

      if (currentRound.guesses.length >= expectedGuessCount) {
        this.clearActiveTimer(lobbyCode);
        await this.startScoringPhase(lobbyCode);
      }
    } catch (error) {
      console.error('Error handling guess submission:', error);
      throw error;
    }
  }

  private async handleGuessTimeout(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      await this.startScoringPhase(lobbyCode);
    } catch (error) {
      console.error('Error handling guess timeout:', error);
      await this.startNewRound(lobbyCode);
    }
  }

  // ==================== Scoring Phase ====================

  private async startScoringPhase(lobbyCode: string): Promise<void> {
    try {
      const gameState = await this.getGameState(lobbyCode);
      if (!gameState) throw new Error('Game not found');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      currentRound.status = 'scoring';
      await this.updateGameState(gameState);

      this.io.to(`lobby:${lobbyCode}`).emit('game:scoring_started');

      const guessTexts = currentRound.guesses.map((g) => g.guess);

      if (guessTexts.length === 0) {
        await this.startResultsPhase(lobbyCode);
        return;
      }

      try {
        const scores = await this.scoreGuesses(currentRound.prompt, guessTexts);

        currentRound.guesses.forEach((guess, index) => {
          guess.score = scores[index];
        });

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
        console.error('Error scoring guesses:', error);
        await this.startResultsPhase(lobbyCode);
      }
    } catch (error) {
      console.error('Error starting scoring phase:', error);
      await this.startNewRound(lobbyCode);
    }
  }

  private async scoreGuesses(
    originalPrompt: string,
    guesses: string[]
  ): Promise<number[]> {
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
