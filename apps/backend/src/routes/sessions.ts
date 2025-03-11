import express from 'express';
import redisClient from '../config/redis';
import type { Lobby } from '@promptmaster/shared';

const router = express.Router();

interface ValidationResponse {
  canReconnect: boolean;
  gameInProgress: boolean;
  lobbyExists: boolean;
  playerExists: boolean;
}

/**
 * Validates if a session can be reconnected to
 * GET /api/sessions/validate
 */
router.get('/validate', async (req, res) => {
  try {
    const { lobbyCode, username, socketID } = req.query;

    // Input validation
    if (!lobbyCode || !username) {
      return res.status(400).json({
        message: 'Missing required parameters'
      });
    }

    // Convert query params to string
    const lobbyCodeStr = String(lobbyCode);
    const usernameStr = String(username);

    // Default response - assume cannot reconnect
    const response: ValidationResponse = {
      canReconnect: false,
      gameInProgress: false,
      lobbyExists: false,
      playerExists: false
    };

    // Check if lobby exists
    const lobbyData = await redisClient.get(`lobby:${lobbyCodeStr}`);
    if (!lobbyData) {
      return res.status(200).json(response);
    }

    response.lobbyExists = true;
    const lobby: Lobby = JSON.parse(lobbyData);

    // Check if game is in progress
    response.gameInProgress = lobby.status === 'playing';

    // Check if player exists in the lobby
    const player = lobby.players.find((p) => p.username === usernameStr);
    response.playerExists = !!player;

    // Player can reconnect if:
    // 1. Lobby exists
    // 2. Game is in progress
    // 3. Player exists in the lobby
    // 4. Player is currently disconnected
    response.canReconnect =
      response.lobbyExists &&
      response.gameInProgress &&
      response.playerExists &&
      !player?.connected;

    return res.status(200).json(response);
  } catch (error) {
    console.error('Session validation error:', error);
    return res
      .status(500)
      .json({ message: 'Server error during session validation' });
  }
});

export default router;
