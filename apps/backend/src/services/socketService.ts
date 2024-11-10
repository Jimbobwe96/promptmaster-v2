import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Lobby,
  LobbyError,
  LobbyErrorType,
} from '@promptmaster/shared';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';
import redisClient from '../config/redis';

type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

  private socketToLobby: Map<string, string> = new Map();

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

    // Temporary: Log the exact type
    const IoType = typeof this.io;
    console.log('IO Type:', IoType);

    this.setupEventHandlers();
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

          // Join the socket to the lobby room
          await socket.join(`lobby:${code}`);

          this.socketToLobby.set(socket.id, code);

          // Update lobby in Redis
          await this.updateLobby(lobby);

          // After successful validation, emit the validated event
          socket.emit('lobby:validated', lobby);

          // Then broadcast the update to everyone
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

  // public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  //   return this.io;
  // }
  public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
    return this.io;
  }
}
