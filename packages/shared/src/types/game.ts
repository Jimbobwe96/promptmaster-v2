// Core Types
export interface Player {
  id: string; // Socket ID
  username: string; // 1-25 chars, unique in lobby
  connected: boolean; // For reconnection window
  lastSeen?: Date; // For tracking disconnections (30 second window)
}

export interface LobbySession {
  code: string;
  username: string;
  // session data will change soon
  isHost: boolean;
  joinedAt: string;
}

export interface SessionData {
  lobbyCode: string;
  username: string;
  socketId?: string; // this is how we know they were actually connected upon reconnection
  joinedAt: string; // not 100% sure what this is
}

export interface Lobby {
  code: string; // 6-digit unique code
  hostId: string; // Socket ID of host
  players: Player[];
  settings: LobbySettings;
  status: LobbyStatus;
  createdAt: Date; // For potential lobby lifetime limiting
}

// new lobby: lobby has gameState, which has rounds.
// host is identified by username, not id
export interface Lobby2 {
  lobbyCode: string; // 6-digit unique code
  gameState?: GameState2;
  hostUsername: string;
  players: Player[];
  settings: LobbySettings;
  status: LobbyStatus;
  createdAt: Date; // For potential lobby lifetime limiting
}

export interface LobbySettings {
  roundsPerPlayer: number; // 1-4 rounds
  timeLimit: number; // 5-30 seconds for prompting/guessing
}

export type LobbyStatus =
  | 'waiting' // Players can join, game hasn't started
  | 'playing' // Game is in progress
  | 'inactive'; // Lobby timed out or manually closed

export interface GameState {
  lobbyCode: string;
  rounds: GameRound[];
  prompterOrder: string[]; // Using prompterOrder[rounds.length % prompterOrder.length] for current prompter
  scores: {
    playerId: string;
    totalScore: number;
  }[];
}

export interface GameState2 {
  rounds: GameRound2[];
  prompterOrder: string[]; // array of usernames
  // current prompter: prompterOrder[round.length % prompterOrder.length]
  scores: {
    playerId: string;
    totalScore: number;
  }[];
}

// Game State Types
export interface GameRound {
  prompterId: string;
  prompt: string;
  imageUrl?: string;
  imageGenerationError?: string;
  endTime?: number;
  expectedGuessCount: number;
  guesses: {
    playerId: string;
    guess: string;
    submittedAt: Date;
    score?: number; // 0-100
  }[];
  status: RoundStatus;
  nextRoundTime?: number;
  readyPlayers: string[];
  readyPhaseEndTime?: number;
}

// new round: consolidates phase timing, identify players by username, not id
export interface GameRound2 {
  phase: RoundStatus;
  phaseEndTime: number;
  prompterUsername: string;
  prompt?: string;
  imageUrl?: string;
  guesses: {
    username: string;
    guess: string;
    submittedAt: Date;
    score?: number;
  }[];
  expectedGuessCount?: number; // stored just before guessing phase starts
  readyPlayers: string[];
}

export type RoundStatus = 'prompting' | 'generating' | 'guessing' | 'scoring' | 'results' | 'skipped';

// GONNA GET REMOVED! this one sucks!
export interface RoundResults {
  roundNumber: number; // Current round number
  imageUrl: string; // AI generated image
  prompterId: string; // ID of prompter
  originalPrompt: string; // The prompt used
  guesses: {
    playerId: string;
    guess: string;
    submittedAt: Date;
    score: number;
  }[];
  roundScores: {
    playerId: string;
    score: number;
  }[];
  scores: {
    playerId: string;
    totalScore: number;
  }[];
  isLastRound: boolean;
  nextRoundTime: number;
  readyPlayers: string[];
  readyPhaseEndTime: number;
}

// Socket Event Types
export interface ServerToClientEvents {
  // Lobby Events
  'lobby:created': (lobby: Lobby) => void;
  'lobby:joined': (lobby: Lobby) => void;
  'lobby:updated': (lobby: Lobby) => void;
  'lobby:left': () => void;
  'lobby:closed': (reason: string) => void;
  'lobby:kicked': () => void;
  'lobby:error': (error: LobbyError) => void;
  'lobby:validated': (lobby: Lobby) => void;

  // Game Events
  'game:started': (initialState: GameState) => void;
  'game:round_started': (round: GameRound) => void;
  'game:prompt_submitted': (prompterId: string) => void;
  'game:request_draft': () => void;
  'game:image_generated': (imageUrl: string) => void;
  'game:guessing_started': (data: { imageUrl: string; timeLimit: number; endTime: number }) => void;
  'game:guess_submitted': (playerId: string) => void;
  'game:request_guess_draft': () => void;
  'game:round_ended': (roundResults: GameRound) => void;
  'game:ended': (finalScores: GameState) => void;
  'game:scoring_started': (data: { endTime: number }) => void;
  'game:results': (data: RoundResults) => void;

  'game:ready_state_update': (data: {
    readyPlayers: string[];
    readyPhaseEndTime: number;
    totalPlayers: number;
  }) => void;
}

export interface ServerToClientEvents2 {
  // Lobby Events
  'lobby:validated': (lobby: Lobby2) => void;
  'lobby:updated': (lobby: Lobby2) => void;
  'lobby:error': (error: LobbyError) => void;

  // could potentially be consolidated with lobby:updated; if the client doesn't see themself in the players array, they redirect home
  // we're gonna keep em for now
  'lobby:left': () => void;
  'lobby:kicked': () => void;

  // Game Events
  'game:started': (lobby: Lobby2) => void; // maybe we don't need to send lobby data with this, phase_changed will handle?
  'game:phase_changed': (lobby: Lobby2) => void;
  'game:guess_submitted': (lobby: Lobby2) => void;
  'game:request_prompt_draft': () => void;
  'game:request_guess_draft': () => void;
  'game:ready_state_update': (lobby: Lobby2) => void;
  'game:ended': (lobby: Lobby2) => void;
}

export interface ClientToServerEvents {
  // Lobby Events
  'lobby:create': (username: string) => void;
  'lobby:join': (code: string, username: string) => void;
  'lobby:leave': () => void;
  'lobby:update_settings': (settings: Partial<LobbySettings>) => void;
  'lobby:validate': (data: { code: string; username: string }) => void;
  'lobby:start_game': () => void;
  'lobby:kick_player': (playerId: string) => void;

  // Game Events
  'game:submit_prompt': (prompt: string) => void;
  'game:submit_draft': (draft: string) => void;
  'game:submit_guess': (guess: string) => void;
  'game:submit_guess_draft': (draft: string) => void;

  'game:mark_ready': () => void;
}

export interface ClientToServerEvents2 {
  // Lobby Events
  'lobby:validate': (data: { code: string; username: string }) => void;
  'lobby:update_settings': (settings: Partial<LobbySettings>) => void;
  'lobby:leave': () => void;
  'lobby:kick_player': (playerUsername: string) => void; // kicked player's username

  'lobby:start_game': () => void;

  // Game Events
  'game:submit_prompt': (prompt: string) => void;
  'game:submit_guess': (guess: string) => void;
  'game:mark_ready': () => void;
}

// Error Types
export type LobbyErrorType =
  | 'LOBBY_NOT_FOUND'
  | 'LOBBY_FULL'
  | 'INVALID_CODE'
  | 'USERNAME_TAKEN'
  | 'USERNAME_INVALID'
  | 'NOT_HOST'
  | 'PLAYER_NOT_FOUND'
  | 'MIN_PLAYERS_NOT_MET'
  | 'INVALID_SETTINGS'
  | 'CONNECTION_ERROR'
  | 'SERVER_ERROR';

export interface LobbyError {
  type: LobbyErrorType;
  message: string;
  details?: Record<string, unknown>;
}

// Validation Constants
export const LOBBY_CONSTRAINTS = {
  CODE_LENGTH: 6,
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  USERNAME_MIN_LENGTH: 1,
  USERNAME_MAX_LENGTH: 25,
  MIN_ROUNDS_PER_PLAYER: 1,
  MAX_ROUNDS_PER_PLAYER: 4,
  MIN_TIME_LIMIT: 5,
  MAX_TIME_LIMIT: 30,
  RECONNECTION_WINDOW: 30 // seconds
} as const;
