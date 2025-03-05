export interface Player {
  id: string; // socket ID - changes when a user disconnects and reconnects
  username: string; // display name, 1-25 chars, unique in lobby
  connected: boolean; // connection status
  lastSeen?: Date; // for reconnection window
}

export interface LobbySettings {
  roundsPerPlayer: number; // 1-4 rounds
  timeLimit: number; // 5-30 seconds for prompting/guessing
}

export type LobbyStatus =
  | 'waiting' // players can join, no active game
  | 'playing' // game is in progress
  | 'inactive'; // lobby timed out or was closed (either manually or by all players leaving)

export interface Lobby {
  lobbyCode: string; // 6-digit unique code
  hostUsername: string; // host's username
  players: Player[];
  settings: LobbySettings;
  status: LobbyStatus;
  createdAt: Date; // for potential lobby lifetime limiting
}

export interface SessionData {
  lobbyCode: string;
  username: string;
  socketID: string; // upon reconnection, we'll check if their old socketID in session storage matches the old one that's still in the database
  joinedAt: string; // maybe not necessary
}

export interface GameState {
  lobbyCode: string;
  rounds: GameRound[];
  prompterOrder: string[]; // we compute current prompter with: prompterOrder[rounds.length % prompterOrder.length]
  scores: {
    playerId: string;
    totalScore: number;
  }[];
}

export interface GameRound {
  prompterId: string;
  prompt: string;
  imageUrl?: string;
  imageGenerationError?: string; // probably don't need
  endTime?: number;
  expectedGuessCount: number; // maybe don't need - can we compute upon receiving each guess based on who's connected
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
  'game:phase_changed': (newPhase: RoundStatus, gameState: GameState) => void;

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
  'game:submit_draft': (draft: string) => void;
  'game:submit_guess': (guess: string) => void;
  'game:submit_guess_draft': (draft: string) => void;

  'game:mark_ready': () => void;
}

export type RoundStatus =
  | 'prompting'
  | 'generating'
  | 'guessing'
  | 'scoring'
  | 'results';

// Add a type alias for GamePhase to make it clear in the code
export type GamePhase = RoundStatus;

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

export interface PhaseTimingData {
  timeLimit: number;
  endTime: number;
}

// Helper type for partial settings updates
export type LobbySettingsUpdate = Partial<LobbySettings>;

// // Core Types
// export interface LobbyPlayer {
//   id: string; // Socket ID
//   username: string; // 1-25 chars, unique in lobby
//   isHost: boolean;
//   connected: boolean; // For reconnection window
//   lastSeen?: Date; // For tracking disconnections (30 second window)
// }

// export interface LobbySettings {
//   roundsPerPlayer: number; // 1-4 rounds
//   timeLimit: number; // 5-30 seconds for prompting/guessing
// }

// export interface Lobby {
//   code: string; // 6-digit unique code
//   hostId: string; // Socket ID of host
//   players: LobbyPlayer[];
//   settings: LobbySettings;
//   status: LobbyStatus;
//   createdAt: Date; // For potential lobby lifetime limiting
// }

// // Game State Types
// export interface GameRound {
//   prompterId: string;
//   prompt: string;
//   imageUrl?: string;
//   imageGenerationError?: string;
//   endTime?: number;
//   expectedGuessCount: number;
//   guesses: {
//     playerId: string;
//     guess: string;
//     submittedAt: Date;
//     score?: number; // 0-100
//   }[];
//   status: RoundStatus;
//   nextRoundTime?: number;
//   readyPlayers: string[];
//   readyPhaseEndTime?: number;
// }

// export interface RoundResults {
//   roundNumber: number; // Current round number
//   imageUrl: string; // AI generated image
//   prompterId: string; // ID of prompter
//   originalPrompt: string; // The prompt used
//   guesses: {
//     playerId: string;
//     guess: string;
//     submittedAt: Date;
//     score: number; // Made non-optional since this is results
//   }[];
//   roundScores: {
//     // Added to separate round from total
//     playerId: string;
//     score: number;
//   }[];
//   scores: {
//     playerId: string;
//     totalScore: number;
//   }[];
//   isLastRound: boolean; // Added to handle final round differently
//   nextRoundTime: number;
//   readyPlayers: string[];
//   readyPhaseEndTime: number;
// }

// export interface GameState {
//   lobbyCode: string;
//   rounds: GameRound[];
//   prompterOrder: string[]; // Using prompterOrder[rounds.length % prompterOrder.length] for current prompter
//   scores: {
//     playerId: string;
//     totalScore: number;
//   }[];
// }

// // Socket Event Types
// export interface ServerToClientEvents {
//   // Lobby Events
//   'lobby:created': (lobby: Lobby) => void;
//   'lobby:joined': (lobby: Lobby) => void;
//   'lobby:updated': (lobby: Lobby) => void;
//   'lobby:left': () => void;
//   'lobby:closed': (reason: string) => void;
//   'lobby:kicked': () => void;
//   'lobby:error': (error: LobbyError) => void;
//   'lobby:validated': (lobby: Lobby) => void;

//   // Game Events
//   'game:started': (initialState: GameState) => void;
//   'game:round_started': (round: GameRound) => void;
//   'game:prompt_submitted': (prompterId: string) => void;
//   'game:request_draft': () => void;
//   'game:image_generated': (imageUrl: string) => void;
//   'game:guessing_started': (data: {
//     imageUrl: string;
//     timeLimit: number;
//     endTime: number;
//   }) => void;
//   'game:guess_submitted': (playerId: string) => void;
//   'game:request_guess_draft': () => void;
//   'game:round_ended': (roundResults: GameRound) => void;
//   'game:ended': (finalScores: GameState) => void;
//   'game:scoring_started': (data: { endTime: number }) => void;
//   'game:results': (data: RoundResults) => void;

//   'game:ready_state_update': (data: {
//     readyPlayers: string[];
//     readyPhaseEndTime: number;
//     totalPlayers: number;
//   }) => void;
// }

// export interface ClientToServerEvents {
//   // Lobby Events
//   'lobby:create': (username: string) => void;
//   'lobby:join': (code: string, username: string) => void;
//   'lobby:leave': () => void;
//   'lobby:update_settings': (settings: Partial<LobbySettings>) => void;
//   'lobby:validate': (data: { code: string; username: string }) => void;
//   'lobby:start_game': () => void;
//   'lobby:kick_player': (playerId: string) => void;

//   // Game Events
//   'game:submit_prompt': (prompt: string) => void;
//   'game:submit_draft': (draft: string) => void;
//   'game:submit_guess': (guess: string) => void;
//   'game:submit_guess_draft': (draft: string) => void;

//   'game:mark_ready': () => void;
// }

// export interface LobbySession {
//   code: string;
//   username: string;
//   isHost: boolean;
//   joinedAt: string;
// }

// // Status Types
// export type LobbyStatus =
//   | 'waiting' // Players can join, game hasn't started
//   | 'starting' // Brief transition state when game is being initialized
//   | 'playing' // Game is in progress
//   | 'finished' // Game has ended
//   | 'inactive'; // Lobby timed out or manually closed

// export type RoundStatus =
//   | 'prompting'
//   | 'generating'
//   | 'guessing'
//   | 'scoring'
//   | 'results';

// // Error Types
// export type LobbyErrorType =
//   | 'LOBBY_NOT_FOUND'
//   | 'LOBBY_FULL'
//   | 'INVALID_CODE'
//   | 'USERNAME_TAKEN'
//   | 'USERNAME_INVALID'
//   | 'NOT_HOST'
//   | 'PLAYER_NOT_FOUND'
//   | 'MIN_PLAYERS_NOT_MET'
//   | 'INVALID_SETTINGS'
//   | 'CONNECTION_ERROR'
//   | 'SERVER_ERROR';

// export interface LobbyError {
//   type: LobbyErrorType;
//   message: string;
//   details?: Record<string, unknown>;
// }

// // Validation Constants
// export const LOBBY_CONSTRAINTS = {
//   CODE_LENGTH: 6,
//   MIN_PLAYERS: 2,
//   MAX_PLAYERS: 8,
//   USERNAME_MIN_LENGTH: 1,
//   USERNAME_MAX_LENGTH: 25,
//   MIN_ROUNDS_PER_PLAYER: 1,
//   MAX_ROUNDS_PER_PLAYER: 4,
//   MIN_TIME_LIMIT: 5,
//   MAX_TIME_LIMIT: 30,
//   RECONNECTION_WINDOW: 30 // seconds
// } as const;

// export interface PhaseTimingData {
//   timeLimit: number;
//   endTime: number;
// }

// // Helper type for partial settings updates
// export type LobbySettingsUpdate = Partial<LobbySettings>;
