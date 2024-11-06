import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Lobby,
  LobbyPlayer,
  LobbyError,
  LobbyErrorType,
} from '@promptmaster/shared';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';
import redisClient from '../config/redis';
import crypto from 'crypto';

type SocketWithData = Socket<ClientToServerEvents, ServerToClientEvents>;

export class SocketService {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

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
  }

  private generateLobbyCode(): string {
    // Generate a random 6-digit code
    return crypto.randomInt(100000, 999999).toString();
  }

  private async createLobby(hostId: string, username: string): Promise<Lobby> {
    const code = this.generateLobbyCode();

    const lobby: Lobby = {
      code,
      hostId,
      players: [
        {
          id: hostId,
          username,
          isHost: true,
          connected: true,
        },
      ],
      settings: {
        roundsPerPlayer: 2, // Default settings
        timeLimit: 30,
      },
      status: 'waiting',
      createdAt: new Date(),
    };

    // Store in Redis with 24h expiry
    await redisClient.setEx(
      `lobby:${code}`,
      24 * 60 * 60, // 24 hours
      JSON.stringify(lobby)
    );

    return lobby;
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

  private emitError(
    socket: SocketWithData,
    type: LobbyErrorType,
    message: string
  ) {
    const error: LobbyError = { type, message };
    socket.emit('lobby:error', error);
  }

  private setupEventHandlers(): void {
    console.log('Setting up Socket.io event handlers...');

    this.io.on('connection', (socket: SocketWithData) => {
      console.log(`Client connected: ${socket.id}`);

      // Handle lobby creation
      socket.on('lobby:create', async (username: string) => {
        try {
          // Validate username
          if (
            !username ||
            username.length < LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH ||
            username.length > LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH
          ) {
            return this.emitError(
              socket,
              'USERNAME_INVALID',
              'Username must be between 1 and 25 characters'
            );
          }

          const lobby = await this.createLobby(socket.id, username);

          // Join socket to a room for this lobby
          await socket.join(`lobby:${lobby.code}`);

          // Emit success event
          socket.emit('lobby:created', lobby);
        } catch (error) {
          console.error('Error creating lobby:', error);
          this.emitError(
            socket,
            'SERVER_ERROR',
            'Failed to create lobby. Please try again.'
          );
        }
      });

      // Handle lobby joining
      socket.on('lobby:join', async (code: string, username: string) => {
        try {
          // Validate inputs
          if (
            !username ||
            username.length < LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH ||
            username.length > LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH
          ) {
            return this.emitError(
              socket,
              'USERNAME_INVALID',
              'Username must be between 1 and 25 characters'
            );
          }

          // Get lobby
          const lobby = await this.getLobby(code);
          if (!lobby) {
            return this.emitError(socket, 'LOBBY_NOT_FOUND', 'Lobby not found');
          }

          // Check if lobby is joinable
          if (lobby.status !== 'waiting') {
            return this.emitError(
              socket,
              'LOBBY_NOT_FOUND',
              'This lobby is no longer accepting players'
            );
          }

          // Check player limit
          if (lobby.players.length >= LOBBY_CONSTRAINTS.MAX_PLAYERS) {
            return this.emitError(socket, 'LOBBY_FULL', 'Lobby is full');
          }

          // Check username uniqueness
          if (lobby.players.some((p) => p.username === username)) {
            return this.emitError(
              socket,
              'USERNAME_TAKEN',
              'Username is already taken in this lobby'
            );
          }

          // Add player to lobby
          const player: LobbyPlayer = {
            id: socket.id,
            username,
            isHost: false,
            connected: true,
          };

          lobby.players.push(player);
          await this.updateLobby(lobby);

          // Join socket to lobby room
          await socket.join(`lobby:${lobby.code}`);

          // Notify everyone in the lobby
          socket.emit('lobby:joined', lobby);
          this.io.to(`lobby:${lobby.code}`).emit('lobby:updated', lobby);
        } catch (error) {
          console.error('Error joining lobby:', error);
          this.emitError(
            socket,
            'SERVER_ERROR',
            'Failed to join lobby. Please try again.'
          );
        }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        // We'll handle player disconnection logic later
      });
    });

    this.io.on('connect_error', (err) => {
      console.error('Socket.io server error:', err.message);
    });
  }

  public getIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
    return this.io;
  }
}
