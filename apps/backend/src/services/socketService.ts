import { Server, Socket } from 'socket.io';

export class SocketService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupEventHandlers = this.setupEventHandlers.bind(this);
  }

  setupEventHandlers(socket: Socket) {
    socket.on('joinLobby', (lobbyId: string) => {
      socket.join(lobbyId);
      this.io.to(lobbyId).emit('playerJoined', { socketId: socket.id });
    });

    socket.on('submitPrompt', (data) => {
      // Handle prompt submission
    });

    socket.on('submitGuess', (data) => {
      // Handle guess submission
    });

    socket.on('disconnect', () => {
      // Handle disconnection
    });
  }
}
