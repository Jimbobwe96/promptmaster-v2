export interface Player {
  id: string; // socket ID - changes when a user disconnects and reconnects
  username: string; // unique in lobby
  connected: boolean;
  lastSeen: Date;
}

export interface SessionData {
  lobbyCode: string;
  username: string;
  socketID: string; // upon reconnection, we'll check if their old socketID in session storage matches the old one that's still in the database
  joinedAt: string;
}

export interface Lobby {
  lobbyCode: string;
  hostUsername: string;
  players: Player[];
  settings: LobbySettings;
  status: LobbyStatus;
  createdAt: Date;
}

export interface LobbySettings {
  roundsPerPlayer: number; // between 1-5, determines game length
  timeLimit: number; // between 5-60 seconds, for both prompting and guessing phase
}

export type LobbyStatus = 'waiting' | 'playing' | 'inactive';

export interface GameState {
  lobbyCode: string;
  rounds: GameRound[];
  prompterOrder: string[]; // order of player usernames
  totalScores: {
    username: string;
    totalScore: number;
  }[];
}

// rounds are constructed and added dynamically to the gamestate when its time to start that round
export interface GameRound {
  phase: RoundPhase;
  phaseEndTime: number;
  prompter: string; // username
  prompt?: string;
  imageUrl?: string;
  guesses: {
    username: string;
    guess: string;
    submittedAt: Date;
    score?: number; // 0-100
  }[];
  readyPlayers: string[]; // array of ready players' usernames
}

export type RoundPhase =
  | 'prompting'
  | 'generating'
  | 'guessing'
  | 'scoring'
  | 'results';

// Socket Events
export interface ServerToClientEvents {
  // lobby events - these will be refreshed down the line
  'lobby:created': (lobby: Lobby) => void;
  'lobby:joined': (lobby: Lobby) => void;
  'lobby:updated': (lobby: Lobby) => void;
  'lobby:left': () => void;
  'lobby:closed': (reason: string) => void;
  'lobby:kicked': () => void;
  'lobby:error': (error: LobbyError) => void;
  'lobby:validated': (lobby: Lobby) => void;

  // start and end
  'game:started': (gameState: GameState) => void;
  'game:ended': (gameState: GameState) => void;

  // phase change abstraction
  'game:phase_changed': (newPhase: RoundPhase, gameState: GameState) => void;

  // upon phase timer expiry
  'game:request_draft': (gameState: GameState) => void;

  // broadcast receipt of player actions
  'game:prompt_received': (gameState: GameState) => void;
  'game:guess_received': (gameState: GameState) => void;
  'game:ready_state_updated': (gameState: GameState) => void;
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
