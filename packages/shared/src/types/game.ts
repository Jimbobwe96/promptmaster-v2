export interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

export interface GameSettings {
  roundsPerPlayer: number;
  promptTime: number;
  guessTime: number;
}
