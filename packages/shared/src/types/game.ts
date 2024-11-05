export interface Player {
  id: string;
  name: string;
  score: number;
}

export interface GameState {
  id: string;
  players: Player[];
  currentRound: number;
  maxRounds: number;
  status: "waiting" | "active" | "finished";
}

export interface Round {
  prompt: string;
  image: string;
  guesses: Record<string, string>; // playerId -> guess
  scores: Record<string, number>; // playerId -> score
}
