import React, { forwardRef } from 'react';
import { GuessInput, GuessInputHandle } from './GuessInput';
import { WaitingForGuesses } from './WaitingForGuesses';
import type { Lobby2 } from '@promptmaster/shared';

interface GuessingPhaseProps {
  lobby: Lobby2;
  currentUsername: string;
  onGuessSubmit: (guess: string) => void;
}

export const GuessingPhase = forwardRef<GuessInputHandle, GuessingPhaseProps>(
  ({ lobby, currentUsername, onGuessSubmit }, ref) => {
    // Get the current round
    const currentRound = lobby.gameState?.rounds[lobby.gameState.rounds.length - 1];

    if (!currentRound) {
      console.log('No current round available');
      return null;
    }

    console.log('Guessing phase endTime:', currentRound.phaseEndTime);
    const isPrompter = currentRound.prompterUsername === currentUsername;
    const hasGuessed = currentRound.guesses.some((g) => g.username === currentUsername);

    if (!currentRound.phaseEndTime) {
      console.log('No phaseEndTime available for round');
      return null;
    }

    if (!currentRound.imageUrl) {
      console.log('No image URL available');
      return null;
    }

    return (
      <div className="w-full max-w-2xl mx-auto">
        {isPrompter ? (
          <WaitingForGuesses lobby={lobby} />
        ) : hasGuessed ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <img src={currentRound.imageUrl} alt="AI Generated" className="w-full h-64 object-cover rounded-lg mb-4" />

            <p className="text-slate-600">Guess submitted! Waiting for other players...</p>
          </div>
        ) : (
          <GuessInput ref={ref} lobby={lobby} onSubmit={onGuessSubmit} />
        )}
      </div>
    );
  }
);

GuessingPhase.displayName = 'GuessingPhase';
