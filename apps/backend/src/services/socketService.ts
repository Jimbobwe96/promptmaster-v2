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

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket'],
    });

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

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          // Find which lobby this socket was in
          const rooms = Array.from(socket.rooms);
          const lobbyRoom = rooms.find((room) => room.startsWith('lobby:'));
          if (!lobbyRoom) return;

          const code = lobbyRoom.split(':')[1];
          const lobby = await this.getLobby(code);
          if (!lobby) return;

          // Update player status
          const player = lobby.players.find((p) => p.id === socket.id);
          if (player) {
            player.connected = false;
            player.lastSeen = new Date();

            // Update lobby in Redis
            await this.updateLobby(lobby);

            // Notify remaining players
            this.io.to(`lobby:${code}`).emit('lobby:updated', lobby);
          }
        } catch (error) {
          console.error('Error handling disconnection:', error);
        }
      });
    });
  }

  public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
    return this.io;
  }
}
