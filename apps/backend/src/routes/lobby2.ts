import express, { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { Lobby2, Player } from '@promptmaster/shared';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';
import redisClient from '../config/redis';
import crypto from 'crypto';

const router = express.Router();

// Define request body interfaces
interface CreateLobbyBody {
  username: string;
}

interface JoinLobbyBody {
  username: string;
  code: string;
}

// Define interface for the request body
interface VerifySessionBody {
  lobbyCode: string;
  username: string;
}

// Validation schemas remain the same
const createLobbySchema = z.object({
  username: z.string().min(LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH).max(LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH)
});

const joinLobbySchema = z.object({
  username: z.string().min(LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH).max(LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH),
  code: z.string().length(LOBBY_CONSTRAINTS.CODE_LENGTH)
});

const generateLobbyCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const createLobbyHandler: RequestHandler<{}, {}, CreateLobbyBody> = async (req, res) => {
  try {
    const { username } = createLobbySchema.parse(req.body);

    let code = generateLobbyCode();
    let exists = await redisClient.get(`lobby:${code}`);

    // retry code generation until we get unique one
    while (exists) {
      code = generateLobbyCode();
      exists = await redisClient.get(`lobby:${code}`);
    }

    // Create new Lobby2 structure with hostUsername
    const lobby: Lobby2 = {
      lobbyCode: code,
      hostUsername: username,
      players: [
        {
          id: '', // Will be set when socket connects
          username,
          connected: false
        }
      ],
      settings: {
        roundsPerPlayer: 2,
        timeLimit: 30
      },
      status: 'waiting',
      createdAt: new Date()
      // gameState is undefined until game starts
    };

    // store lobby
    await redisClient.setEx(`lobby:${code}`, 24 * 60 * 60, JSON.stringify(lobby));

    // Return the lobby code to the client
    res.status(201).json({
      code
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: 'Invalid username format',
        details: error.errors
      });
      return;
    }
    console.error('Error creating lobby:', error);
    res.status(500).json({ message: 'Failed to create lobby' });
  }
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const joinLobbyHandler: RequestHandler<{}, {}, JoinLobbyBody> = async (req, res) => {
  try {
    const { username, code } = joinLobbySchema.parse(req.body);

    const lobbyData = await redisClient.get(`lobby:${code}`);
    if (!lobbyData) {
      res.status(404).json({ message: 'Lobby not found' });
      return;
    }

    const lobby: Lobby2 = JSON.parse(lobbyData);

    if (lobby.status !== 'waiting') {
      res.status(400).json({
        message: 'This lobby is no longer accepting players'
      });
      return;
    }

    if (lobby.players.length >= LOBBY_CONSTRAINTS.MAX_PLAYERS) {
      res.status(400).json({ message: 'Lobby is full' });
      return;
    }

    const usernameExists = lobby.players.some((p) => p.username === username);
    if (usernameExists) {
      res.status(400).json({ message: 'Username is already taken' });
      return;
    }

    // Add the new player to the lobby
    const player: Player = {
      id: '', // will be set when socket connects
      username,
      connected: false // will be set to true in lobby:validate
    };

    lobby.players.push(player);

    // Save the updated lobby back to Redis
    await redisClient.setEx(
      `lobby:${code}`,
      24 * 60 * 60, // 24 hours (matching create handler)
      JSON.stringify(lobby)
    );

    res.status(200).json({
      code
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: 'Invalid request format',
        details: error.errors
      });
      return;
    }
    console.error('Error joining lobby:', error);
    res.status(500).json({ message: 'Failed to join lobby' });
  }
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const verifySessionHandler: RequestHandler<{}, {}, VerifySessionBody> = async (req, res) => {
  try {
    const { lobbyCode, username } = req.body;

    if (!lobbyCode || !username) {
      res.status(400).json({
        canReconnect: false,
        message: 'Missing required session data'
      });
      return;
    }

    // Get lobby data from Redis
    const lobbyData = await redisClient.get(`lobby:${lobbyCode}`);
    if (!lobbyData) {
      res.status(200).json({
        canReconnect: false,
        message: 'Lobby no longer exists'
      });
      return;
    }

    const lobby: Lobby2 = JSON.parse(lobbyData);

    // Check if player exists in the lobby
    const player = lobby.players.find((p) => p.username === username);
    if (!player) {
      res.status(200).json({
        canReconnect: false,
        message: 'Player not found in lobby'
      });
      return;
    }

    // Check if player is not already connected
    if (player.connected) {
      res.status(200).json({
        canReconnect: false,
        message: 'Player is already connected'
      });
      return;
    }

    // Return success response with additional lobby info
    res.status(200).json({
      canReconnect: true,
      lobbyStatus: lobby.status,
      isHost: lobby.hostUsername === username
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({
      canReconnect: false,
      message: 'Server error verifying session'
    });
  }
};

// Register the handlers
router.post('/create', createLobbyHandler);
router.post('/join', joinLobbyHandler);
router.post('/verify-session', verifySessionHandler);

export default router;
