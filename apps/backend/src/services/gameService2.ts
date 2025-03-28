import { Server } from 'socket.io';
import { Lobby2, GameState2, GameRound2, Player } from '@promptmaster/shared';
import { OpenAI } from 'openai';
import { fal } from '@fal-ai/client';
import redisClient from '../config/redis';

export class GameService2 {
  private async getLobby(lobbyCode: string): Promise<Lobby2 | null> {
    const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
    return lobbyData ? JSON.parse(lobbyData) : null;
  }

  private async updateLobby(lobby: Lobby2): Promise<void> {
    await redisClient.setEx(`lobby:${lobby.lobbyCode}`, 24 * 60 * 60, JSON.stringify(lobby));
  }

  // sample implementation
  async handlePromptSubmission2(lobbyCode: string, playerId: string, prompt: string): Promise<void> {
    try {
      const lobby = await this.getLobby(lobbyCode);
      if (!lobby) throw new Error('Lobby not found');

      const gameState = lobby.gameState;
      if (!gameState) throw new Error('Lobby does not have an active game');

      const currentRound = gameState.rounds[gameState.rounds.length - 1];
      if (!currentRound) throw new Error('No active round');

      // find the player's username
      const playerUsername = lobby.players.find((p: Player) => p.id === playerId)?.username;
      if (!playerUsername) throw new Error('Player not found for some odd reason');

      // check if the player is the prompter
      if (currentRound.prompterUsername !== playerUsername) {
        throw new Error('Not the current prompter');
      }

      // check if the prompt is valid
      if (!prompt) throw new Error('Prompt is required');

      // process the prompt
      // await this.processPrompt(lobbyCode, prompt);
    } catch (error) {
      console.error('Error handling prompt submission:', error);
      throw error;
    }
  }
}
