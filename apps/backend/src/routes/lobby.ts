// src/routes/lobby.ts
import express, { Request, Response, RequestHandler } from 'express';
import { z } from 'zod'; // We have this from techstack.rtf
import type { Lobby, LobbyPlayer } from '@promptmaster/shared';
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

// Validation schemas remain the same
const createLobbySchema = z.object({
  username: z
    .string()
    .min(LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH)
    .max(LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH),
});

const joinLobbySchema = z.object({
  username: z
    .string()
    .min(LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH)
    .max(LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH),
  code: z.string().length(LOBBY_CONSTRAINTS.CODE_LENGTH),
});

const generateLobbyCode = (): string => {
  return crypto.randomInt(100000, 999999).toString();
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const createLobbyHandler: RequestHandler<{}, {}, CreateLobbyBody> = async (
  req,
  res
) => {
  try {
    const { username } = createLobbySchema.parse(req.body);

    let code = generateLobbyCode();
    let exists = await redisClient.get(`lobby:${code}`);

    while (exists) {
      code = generateLobbyCode();
      exists = await redisClient.get(`lobby:${code}`);
    }

    const lobby: Lobby = {
      code,
      hostId: '',
      players: [
        {
          id: '',
          username,
          isHost: true,
          connected: false,
        },
      ],
      settings: {
        roundsPerPlayer: 2,
        timeLimit: 30,
      },
      status: 'waiting',
      createdAt: new Date(),
    };

    await redisClient.setEx(
      `lobby:${code}`,
      24 * 60 * 60,
      JSON.stringify(lobby)
    );

    await redisClient.setEx(
      `lobby:${code}:username:${username}`,
      5 * 60,
      'reserved'
    );

    // Remove return
    res.status(201).json({
      code,
      isHost: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: 'Invalid username format',
        details: error.errors,
      });
      return;
    }
    console.error('Error creating lobby:', error);
    res.status(500).json({ message: 'Failed to create lobby' });
  }
};

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const joinLobbyHandler: RequestHandler<{}, {}, JoinLobbyBody> = async (
  req,
  res
) => {
  try {
    const { username, code } = joinLobbySchema.parse(req.body);

    const lobbyData = await redisClient.get(`lobby:${code}`);
    if (!lobbyData) {
      res.status(404).json({ message: 'Lobby not found' });
      return;
    }

    const lobby: Lobby = JSON.parse(lobbyData);

    if (lobby.status !== 'waiting') {
      res.status(400).json({
        message: 'This lobby is no longer accepting players',
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

    await redisClient.setEx(
      `lobby:${code}:username:${username}`,
      5 * 60,
      'reserved'
    );

    // Remove return
    res.status(200).json({
      code,
      isHost: false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: 'Invalid request format',
        details: error.errors,
      });
      return;
    }
    console.error('Error joining lobby:', error);
    res.status(500).json({ message: 'Failed to join lobby' });
  }
};

// Register the handlers
router.post('/create', createLobbyHandler);
router.post('/join', joinLobbyHandler);

export default router;
