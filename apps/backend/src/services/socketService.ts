import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Lobby,
  LobbyError,
  LobbyErrorType,
  LobbySettings,
} from '@promptmaster/shared';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';
import redisClient from '../config/redis';
import { GameService } from './gameService';

type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private socketToLobby: Map<string, string> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly DISCONNECT_TIMEOUT = 15000;

  constructor(server: HTTPServer) {
    console.log('Initializing SocketService...');

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket'],
    });

    this.setupEventHandlers();
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Run cleanup every 5 seconds
    this.cleanupInterval = setInterval(
      () => this.cleanupDisconnectedPlayers(),
      5000
    );
  }

  private async cleanupDisconnectedPlayers(): Promise<void> {
    try {
      // Get all active lobby keys
      const lobbyKeys = await redisClient.keys('lobby:*');
      const now = new Date();

      for (const key of lobbyKeys) {
        // Skip username reservation keys
        if (key.includes(':username:')) continue;

        const lobbyData = await redisClient.get(key);
        if (!lobbyData) continue;

        const lobby: Lobby = JSON.parse(lobbyData);
        let lobbyUpdated = false;

        // Filter out players who have been disconnected for too long
        const updatedPlayers = lobby.players.filter((player) => {
          if (!player.connected && player.lastSeen) {
            const disconnectedTime =
              now.getTime() - new Date(player.lastSeen).getTime();
            return disconnectedTime <= this.DISCONNECT_TIMEOUT;
          }
          return true;
        });

        // If any players were removed, update the lobby
        if (updatedPlayers.length !== lobby.players.length) {
          lobby.players = updatedPlayers;
          lobbyUpdated = true;

          // If all players are gone, delete the lobby
          if (updatedPlayers.length === 0) {
            await redisClient.del(key);
            continue;
          }

          // If host was removed, assign new host
          if (!updatedPlayers.some((p) => p.id === lobby.hostId)) {
            const newHost = updatedPlayers.find((p) => p.connected);
            if (newHost) {
              newHost.isHost = true;
              lobby.hostId = newHost.id;
            }
          }
        }

        // Save updated lobby if changes were made
        if (lobbyUpdated) {
          await this.updateLobby(lobby);
          // Notify remaining players
          this.io.to(`lobby:${lobby.code}`).emit('lobby:updated', lobby);
        }
      }
    } catch (error) {
      console.error('Error in cleanup interval:', error);
    }
  }

  private emitError(
    socket: SocketWithData,
    type: LobbyErrorType,
    message: string
  ) {
    const error: LobbyError = { type, message };
    socket.emit('lobby:error', error);
  }

  private async getLobby(code: string): Promise<Lobby | null> {
    const lobbyData = await redisClient.get(`lobby:${code}`);
    return lobbyData ? JSON.parse(lobbyData) : null;
  }

  private async updateLobby(lobby: Lobby): Promise<void> {
    await redisClient.setEx(
      `lobby:${lobby.code}`,
      24 * 60 * 60,
      JSON.stringify(lobby)
    );
  }

  private async verifyUsernameReservation(
    code: string,
    username: string
  ): Promise<boolean> {
    const reservation = await redisClient.get(
      `lobby:${code}:username:${username}`
    );
    return reservation === 'reserved';
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
            this.emitError(
              socket,
              'PLAYER_NOT_FOUND',
              'Player not found in lobby'
            );
            return;
          }

          // Update player's socket ID and connection status
          player.id = socket.id;
          player.connected = true;
          player.lastSeen = new Date();

          // If this player is the host (isHost: true), update the lobby's hostId
          if (player.isHost) {
            lobby.hostId = socket.id;
            console.log(
              `Updated hostId to ${socket.id} for host player ${username}`
            );
          }

          // Join the socket to the lobby room
          await socket.join(`lobby:${code}`);
          this.socketToLobby.set(socket.id, code);

          // Update lobby in Redis
          await this.updateLobby(lobby);

          // Emit validated event
          socket.emit('lobby:validated', lobby);

          // Broadcast update to everyone
          this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
        } catch (error) {
          console.error('Error validating lobby connection:', error);
          this.emitError(
            socket,
            'SERVER_ERROR',
            'Failed to validate lobby connection'
          );
        }
      });

      socket.on(
        'lobby:update_settings',
        async (settings: Partial<LobbySettings>) => {
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

            // Verify user is host
            if (lobby.hostId !== socket.id) {
              this.emitError(
                socket,
                'NOT_HOST',
                'Only the host can update settings'
              );
              return;
            }

            // Validate new settings
            const newSettings = {
              ...lobby.settings,
              ...settings,
            };

            if (
              newSettings.roundsPerPlayer <
                LOBBY_CONSTRAINTS.MIN_ROUNDS_PER_PLAYER ||
              newSettings.roundsPerPlayer >
                LOBBY_CONSTRAINTS.MAX_ROUNDS_PER_PLAYER ||
              newSettings.timeLimit < LOBBY_CONSTRAINTS.MIN_TIME_LIMIT ||
              newSettings.timeLimit > LOBBY_CONSTRAINTS.MAX_TIME_LIMIT
            ) {
              this.emitError(
                socket,
                'INVALID_SETTINGS',
                'Invalid settings values'
              );
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
        }
      );

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

          // Remove player from lobby
          const leavingPlayer = lobby.players.find((p) => p.id === socket.id);
          lobby.players = lobby.players.filter((p) => p.id !== socket.id);

          // If this was the host, assign new host to first connected player
          if (socket.id === lobby.hostId && lobby.players.length > 0) {
            const newHost = lobby.players.find((p) => p.connected);
            if (newHost) {
              newHost.isHost = true;
              lobby.hostId = newHost.id;
            }
          }

          // If there are still players in the lobby
          if (lobby.players.length > 0) {
            // Update lobby in Redis
            await this.updateLobby(lobby);

            // Notify remaining players
            this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
          } else {
            // If no players left, delete the lobby
            await redisClient.del(`lobby:${code}`);

            // Clean up username reservations
            if (leavingPlayer) {
              await redisClient.del(
                `lobby:${code}:username:${leavingPlayer.username}`
              );
            }
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

      socket.on('lobby:kick_player', async (playerId: string) => {
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

          // Verify user is host
          if (lobby.hostId !== socket.id) {
            this.emitError(
              socket,
              'NOT_HOST',
              'Only the host can kick players'
            );
            return;
          }

          // Find player to kick
          const playerToKick = lobby.players.find((p) => p.id === playerId);
          if (!playerToKick) {
            this.emitError(socket, 'PLAYER_NOT_FOUND', 'Player not found');
            return;
          }

          this.io.to(playerId).emit('lobby:kicked');

          // Remove player from lobby
          lobby.players = lobby.players.filter((p) => p.id !== playerId);

          // Save updated lobby
          await this.updateLobby(lobby);

          // Broadcast update to remaining players
          this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);

          // Remove the kicked socket from the lobby room
          const kickedSocket = this.io.sockets.sockets.get(playerId);
          if (kickedSocket) {
            kickedSocket.leave(`lobby:${code}`);
            this.socketToLobby.delete(playerId);
          }
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

          // Verify user is host
          if (lobby.hostId !== socket.id) {
            this.emitError(
              socket,
              'NOT_HOST',
              'Only the host can start the game'
            );
            return;
          }

          // Initialize game
          const gameService = new GameService(this.io);
          const gameState = await gameService.initializeGame(code);

          // Update lobby status
          lobby.status = 'playing';
          await this.updateLobby(lobby);

          console.log('Emitting game:started with state:', gameState);
          // Notify all clients in the lobby that game has started
          this.io.to(`lobby:${code}`).emit('game:started', gameState);
        } catch (error) {
          console.error('Error starting game:', error);
          this.emitError(socket, 'SERVER_ERROR', 'Failed to start game');
        }
      });

      socket.on('disconnect', async () => {
        try {
          console.log(`Client disconnected: ${socket.id}`);

          // Get lobby code from our map
          const code = this.socketToLobby.get(socket.id);
          if (!code) {
            console.log('No lobby found for disconnected socket');
            return;
          }
          console.log('Found lobby code:', code);

          // Get lobby data
          const lobbyData = await this.getLobby(code);
          if (!lobbyData) {
            console.log('No lobby data found for code:', code);
            return;
          }
          console.log(
            'Current lobby data:',
            JSON.stringify(lobbyData, null, 2)
          );

          // Find and update the player
          const player = lobbyData.players.find((p) => p.id === socket.id);
          if (!player) {
            console.log('No player found with socket id:', socket.id);
            return;
          }
          console.log('Found disconnecting player:', player);

          // Update player status
          player.connected = false;
          player.lastSeen = new Date();
          console.log('Updated player status to disconnected');

          // Check if all players are disconnected
          const allDisconnected = lobbyData.players.every((p) => !p.connected);
          console.log('All players disconnected?', allDisconnected);
          console.log(
            'Players status:',
            lobbyData.players.map((p) => ({
              username: p.username,
              connected: p.connected,
            }))
          );

          if (allDisconnected) {
            console.log('Attempting to delete lobby...');

            // Try to delete the lobby and log the result
            const deleteResult = await redisClient.del(`lobby:${code}`);
            console.log('Delete lobby result:', deleteResult); // 1 means success, 0 means key didn't exist

            // Try to delete username reservations and log results
            for (const p of lobbyData.players) {
              const usernameDeleteResult = await redisClient.del(
                `lobby:${code}:username:${p.username}`
              );
              console.log(
                `Delete username reservation result for ${p.username}:`,
                usernameDeleteResult
              );
            }

            console.log(
              `Attempted to delete lobby ${code} and its username reservations`
            );
          } else {
            console.log('Saving updated lobby data...');
            await this.updateLobby(lobbyData);
            console.log('Updated lobby saved to Redis');

            // Notify remaining players
            this.io.to(`lobby:${code}`).emit('lobby:updated', lobbyData);
            console.log('Notified remaining players of update');
          }

          // Clean up our tracking
          this.socketToLobby.delete(socket.id);
          console.log('Cleaned up socket tracking');
        } catch (error: unknown) {
          // TypeScript needs explicit unknown type
          console.error('Error in disconnect handler:', error);
          // If it's an Error object, we can access message and stack
          if (error instanceof Error) {
            console.error('Full error details:', {
              message: error.message,
              stack: error.stack,
            });
          } else {
            // If it's not an Error object, just log what we have
            console.error('Full error details:', error);
          }
        }
      });
    });
  }

  public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
    return this.io;
  }

  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}
