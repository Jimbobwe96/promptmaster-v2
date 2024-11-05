import express from 'express';
import http from 'http';
import { SocketService } from './services/socketService';

const app = express();
const server = http.createServer(app);

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

export { app, server, socketService };
