import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import { SocketService } from './services/socketService';
import { connectRedis } from './config/redis';
import cors from 'cors';
import type { CorsOptions } from 'cors';
import lobbyRoutes from './routes/lobby';

const app = express();

const corsOptions: CorsOptions = {
  origin: [process.env.FRONTEND_URL || 'http://localhost:3000'].filter(
    (url): url is string => !!url
  ),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));
app.use(express.json());

app.use('/api/lobbies', lobbyRoutes);

const server = http.createServer(app);

// Initialize all services
async function initializeServices() {
  try {
    // Connect to Redis first
    await connectRedis();
    console.log('Redis connected successfully');

    // Initialize socket service
    const socketService = new SocketService(server);

    // Basic health check endpoint
    app.get('/health', (req, res) => {
      res.send('OK');
    });

    const PORT = process.env.PORT || 4000;

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    return { app, server, socketService };
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Export a promise that resolves with the services
export default initializeServices();

// For backwards compatibility, also export the types
export type { Express } from 'express';
