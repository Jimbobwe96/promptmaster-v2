// Core Types
export interface LobbyPlayer {
  id: string; // Socket ID
  username: string; // 1-25 chars, unique in lobby
  isHost: boolean;
  connected: boolean; // For reconnection window
  lastSeen?: Date; // For tracking disconnections
}

export interface LobbySettings {
  roundsPerPlayer: number; // 1-4 rounds
  timeLimit: number; // 5-30 seconds for prompting/guessing
}

export interface Lobby {
  code: string; // 6-digit unique code
  hostId: string; // Socket ID of host
  players: LobbyPlayer[];
  settings: LobbySettings;
  status: "waiting" | "playing";
  createdAt: Date; // For potential lobby lifetime limiting
}

// Game State Types
export interface GameRound {
  prompterId: string;
  prompt: string;
  imageUrl?: string;
  guesses: {
    playerId: string;
    guess: string;
    score?: number; // 0-100
  }[];
  timeRemaining: number;
  status:
    | "waiting"
    | "prompting"
    | "generating"
    | "guessing"
    | "scoring"
    | "results";
}

export interface GameState {
  lobbyCode: string;
  currentRound: number;
  totalRounds: number;
  rounds: GameRound[];
  scores: {
    playerId: string;
    totalScore: number;
  }[];
  status: "lobby" | "playing" | "finished";
}

// Socket Event Types
export interface ServerToClientEvents {
  pong: () => void;

  // Lobby Events
  "lobby:updated": (lobby: Lobby) => void;
  "lobby:player_joined": (player: LobbyPlayer) => void;
  "lobby:player_left": (playerId: string) => void;
  "lobby:settings_changed": (settings: LobbySettings) => void;
  "lobby:error": (error: LobbyError) => void;

  // Game Events
  "game:started": (initialState: GameState) => void;
  "game:round_started": (round: GameRound) => void;
  "game:prompt_submitted": (prompterId: string) => void;
  "game:image_generated": (imageUrl: string) => void;
  "game:guess_submitted": (playerId: string) => void;
  "game:round_ended": (roundResults: GameRound) => void;
  "game:ended": (finalScores: GameState) => void;
}

export interface ClientToServerEvents {
  ping: () => void;

  // Lobby Events
  "lobby:create": (username: string) => void;
  "lobby:join": (code: string, username: string) => void;
  "lobby:leave": () => void;
  "lobby:kick_player": (playerId: string) => void;
  "lobby:update_settings": (settings: Partial<LobbySettings>) => void;

  // Game Events
  "game:start": () => void;
  "game:submit_prompt": (prompt: string) => void;
  "game:submit_guess": (guess: string) => void;
}

// Error Types
export type LobbyErrorType =
  | "LOBBY_NOT_FOUND"
  | "LOBBY_FULL"
  | "INVALID_CODE"
  | "USERNAME_TAKEN"
  | "USERNAME_INVALID"
  | "NOT_HOST"
  | "PLAYER_NOT_FOUND"
  | "MIN_PLAYERS_NOT_MET"
  | "INVALID_SETTINGS";

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
} as const;

// Utility Types
export type LobbyStatus = Lobby["status"];
export type GameStatus = GameState["status"];
export type RoundStatus = GameRound["status"];

// Helper type for partial settings updates
export type LobbySettingsUpdate = Partial<LobbySettings>;
