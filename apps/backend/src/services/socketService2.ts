import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents2,
  ServerToClientEvents2,
  Lobby2,
  LobbyError,
  LobbyErrorType,
  LobbySettings
} from '@promptmaster/shared';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';
import redisClient from '../config/redis';
import { GameService2 } from './gameService2';

type SocketWithData = Socket<ClientToServerEvents2, ServerToClientEvents2>;

export class SocketService2 {
  private io: SocketIOServer<ClientToServerEvents2, ServerToClientEvents2>;
  private socketToLobby: Map<string, string> = new Map(); // Maps socketId -> lobbyCode
  private cleanupInterval: NodeJS.Timeout | null = null;
  private gameService: GameService2;

  constructor(server: HTTPServer) {
    console.log('Initializing SocketService2...');

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket']
    });

    this.gameService = new GameService2(this.io);
    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Just a simple interval to check for completely empty lobbies
    this.cleanupInterval = setInterval(() => this.cleanupEmptyLobbies(), 30000); // Check every 30 seconds
  }

  private async cleanupEmptyLobbies(): Promise<void> {
    try {
      // Get all active lobby keys
      const lobbyKeys = await redisClient.keys('lobby:*');

      for (const key of lobbyKeys) {
        // Skip username reservation keys
        if (key.includes(':username:')) continue;

        const lobbyData = await redisClient.get(key);
        if (!lobbyData) continue;

        const lobby: Lobby2 = JSON.parse(lobbyData);

        // If no connected players, delete the lobby
        if (!lobby.players.some((player) => player.connected)) {
          console.log(`Deleting lobby: ${lobby.lobbyCode}; no players connected`);
          await redisClient.del(key);
        }
      }
    } catch (error) {
      console.error('Error in cleanup interval:', error);
    }
  }

  private emitError(socket: SocketWithData, type: LobbyErrorType, message: string) {
    const error: LobbyError = { type, message };
    socket.emit('lobby:error', error);
  }

  private async getLobby(code: string): Promise<Lobby2 | null> {
    const lobbyData = await redisClient.get(`lobby:${code}`);
    return lobbyData ? JSON.parse(lobbyData) : null;
  }

  private async updateLobby(lobby: Lobby2): Promise<void> {
    await redisClient.setEx(`lobby:${lobby.lobbyCode}`, 24 * 60 * 60, JSON.stringify(lobby));
  }

  private setupEventHandlers(): void {
    this.io.on('connection', async (socket: SocketWithData) => {
      console.log(`Socket connected: ${socket.id}`);

      // Handle lobby connection validation
      socket.on('lobby:validate', async ({ code, username }) => {
        try {
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Find player in lobby
          const player = lobby.players.find((p) => p.username === username);
          if (!player) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found in lobby');
            return;
          }

          // Store previous connection state for reconnection tracking
          const wasDisconnected = !player.connected;

          // Update player's socket ID and connection status
          player.id = socket.id;
          player.connected = true;
          player.lastSeen = new Date();

          // Join the socket to the lobby room
          await socket.join(`lobby:${code}`);
          this.socketToLobby.set(socket.id, code);

          // Update lobby in Redis
          await this.updateLobby(lobby);

          // Emit validated event
          socket.emit('lobby:validated', lobby);

          // Broadcast update to everyone
          this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);

          // Log reconnection
          if (wasDisconnected) {
            console.log(`Player ${username} reconnected to lobby ${code}`);
          }
        } catch (error) {
          console.error('Error validating lobby connection:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to validate lobby connection');
        }
      });

      socket.on('lobby:update_settings', async (settings: Partial<LobbySettings>) => {
        try {
          // Get lobby code from our map
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby data
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Find username of the socket
          const player = lobby.players.find((p) => p.id === socket.id);
          if (!player) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Verify user is host
          if (lobby.hostUsername !== player.username) {
            this.emitError(socket, 'NOT_HOST', 'Only the host can update settings');
            return;
          }

          // Validate new settings
          const newSettings = {
            ...lobby.settings,
            ...settings
          };

          if (
            newSettings.roundsPerPlayer < LOBBY_CONSTRAINTS.MIN_ROUNDS_PER_PLAYER ||
            newSettings.roundsPerPlayer > LOBBY_CONSTRAINTS.MAX_ROUNDS_PER_PLAYER ||
            newSettings.timeLimit < LOBBY_CONSTRAINTS.MIN_TIME_LIMIT ||
            newSettings.timeLimit > LOBBY_CONSTRAINTS.MAX_TIME_LIMIT
          ) {
            this.emitError(socket, 'INVALID_SETTINGS', 'Invalid settings values');
            return;
          }

          // Update lobby settings
          lobby.settings = newSettings;

          // Save updated lobby
          await this.updateLobby(lobby);

          // Broadcast update to all clients in the lobby
          this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
        } catch (error) {
          console.error('Error updating lobby settings:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to update settings');
        }
      });

      socket.on('lobby:leave', async () => {
        try {
          // Get lobby code from our map
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby data
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Remove player from lobby - this is an intentional leave
          lobby.players = lobby.players.filter((p) => p.id !== socket.id);

          // If this was the host, assign new host to first connected player
          if (lobby.players.length > 0) {
            const leavingPlayerWasHost = !lobby.players.some((p) => p.username === lobby.hostUsername);
            if (leavingPlayerWasHost) {
              const newHost = lobby.players.find((p) => p.connected);
              if (newHost) {
                lobby.hostUsername = newHost.username;
              }
            }

            // Update lobby in Redis
            await this.updateLobby(lobby);

            // Notify remaining players
            this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
          } else {
            // If no players left, delete the lobby
            await redisClient.del(`lobby:${code}`);
          }

          // Remove socket from room and tracking
          socket.leave(`lobby:${code}`);
          this.socketToLobby.delete(socket.id);

          // Notify the client that leave was successful
          socket.emit('lobby:left');
        } catch (error) {
          console.error('Error handling lobby leave:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to leave lobby');
        }
      });

      socket.on('lobby:kick_player', async (playerUsername: string) => {
        try {
          // Get lobby code from our map
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby data
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Find username of the socket
          const currentPlayer = lobby.players.find((p) => p.id === socket.id);
          if (!currentPlayer) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Verify user is host
          if (lobby.hostUsername !== currentPlayer.username) {
            this.emitError(socket, 'NOT_HOST', 'Only the host can kick players');
            return;
          }

          // Find player to kick
          const playerToKick = lobby.players.find((p) => p.username === playerUsername);
          if (!playerToKick) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Notify the kicked player
          if (playerToKick.id && playerToKick.connected) {
            this.io.to(playerToKick.id).emit('lobby:kicked');

            // Remove the kicked socket from the lobby room
            const kickedSocket = this.io.sockets.sockets.get(playerToKick.id);
            if (kickedSocket) {
              kickedSocket.leave(`lobby:${code}`);
              this.socketToLobby.delete(playerToKick.id);
            }
          }

          // Remove player from lobby
          lobby.players = lobby.players.filter((p) => p.username !== playerUsername);

          // Save updated lobby
          await this.updateLobby(lobby);

          // Broadcast update to remaining players
          this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
        } catch (error) {
          console.error('Error kicking player:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to kick player');
        }
      });

      socket.on('lobby:start_game', async () => {
        try {
          console.log('Received lobby:start_game event');
          const code = this.socketToLobby.get(socket.id);
          console.log('Found lobby code:', code);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby data
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Find username of the socket
          const currentPlayer = lobby.players.find((p) => p.id === socket.id);
          if (!currentPlayer) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Verify user is host
          if (lobby.hostUsername !== currentPlayer.username) {
            this.emitError(socket, 'NOT_HOST', 'Only the host can start the game');
            return;
          }

          // Remove disconnected players before starting
          lobby.players = lobby.players.filter((p) => p.connected);
          await this.updateLobby(lobby);

          // Check minimum player count
          if (lobby.players.length < LOBBY_CONSTRAINTS.MIN_PLAYERS) {
            this.emitError(socket, 'MIN_PLAYERS_NOT_MET', 'Need at least 2 players to start');
            return;
          }

          // Initialize game
          await this.gameService.initializeGame(code);

          // Notify all clients in the lobby that game has started
          this.io.to(`lobby:${code}`).emit('game:started', lobby);
        } catch (error) {
          console.error('Error starting game:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to start game');
        }
      });

      socket.on('game:submit_prompt', async (prompt: string) => {
        try {
          // Get lobby code for this socket
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby and find player
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          const player = lobby.players.find((p) => p.id === socket.id);
          if (!player) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Submit the prompt
          await this.gameService.handlePromptSubmission(code, player.username, prompt);
        } catch (error) {
          console.error('Error submitting prompt:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to submit prompt');
        }
      });

      socket.on('game:submit_guess', async (guess: string) => {
        try {
          // Get lobby code from our map
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby and find player
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          const player = lobby.players.find((p) => p.id === socket.id);
          if (!player) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Handle the guess submission
          await this.gameService.handleGuessSubmission(code, player.username, guess);
        } catch (error) {
          console.error('Error handling guess submission:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to submit guess');
        }
      });

      socket.on('game:mark_ready', async () => {
        console.log('received game:mark_ready on backend');
        try {
          // Get lobby code for this socket
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          // Get lobby and find player
          const lobby = await this.getLobby(code);
          if (!lobby) {
            this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
            return;
          }

          const player = lobby.players.find((p) => p.id === socket.id);
          if (!player) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          // Handle the ready state
          await this.gameService.handlePlayerReady(code, player.username);
        } catch (error) {
          console.error('Error handling player ready:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to mark player as ready');
        }
      });

      socket.on('disconnect', async () => {
        try {
          console.log(`Client disconnected: ${socket.id}`);

          console.log('SOCKET TO LOBBY MAP:\n');
          console.log(this.socketToLobby);

          // Get lobby code from our map
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            console.log('No lobby found for disconnected socket');
            return;
          }

          // Get lobby data
          const lobby = await this.getLobby(code);
          if (!lobby) {
            console.log('No lobby data found for code:', code);
            return;
          }

          // Find and update the player
          const player = lobby.players.find((p) => p.id === socket.id);
          if (!player) {
            console.log('No player found with socket id:', socket.id);
            return;
          }

          // Update player status
          player.connected = false;
          player.lastSeen = new Date();

          // Check if all players are disconnected
          const allDisconnected = !lobby.players.some((p) => p.connected);

          if (allDisconnected) {
            // If all players disconnected, delete the lobby
            console.log(`All players disconnected from lobby ${code}, deleting lobby`);
            await redisClient.del(`lobby:${code}`);
          } else {
            // If host disconnected, assign new host
            if (player.username === lobby.hostUsername) {
              const newHost = lobby.players.find((p) => p.connected);
              if (newHost) {
                lobby.hostUsername = newHost.username;
              }
            }

            // Update lobby in Redis
            await this.updateLobby(lobby);

            // Notify remaining players
            this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
          }

          // Clean up socket tracking
          this.socketToLobby.delete(socket.id);
        } catch (error) {
          console.error('Error in disconnect handler:', error);
        }
      });
    });
  }

  public getIO(): SocketIOServer<ClientToServerEvents2, ServerToClientEvents2> {
    return this.io;
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
