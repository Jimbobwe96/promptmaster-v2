import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

export class SocketService {
  private io: SocketIOServer;

  constructor(server: HTTPServer) {
    console.log('Initializing SocketService...');
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);

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

  private setupEventHandlers(): void {
    console.log('Setting up Socket.io event handlers...');

    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      socket.on('ping', () => {
        console.log(`Received ping from ${socket.id}`);
        socket.emit('pong');
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });

    this.io.on('connect_error', (err) => {
      console.error('Socket.io server error:', err.message);
    });
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
