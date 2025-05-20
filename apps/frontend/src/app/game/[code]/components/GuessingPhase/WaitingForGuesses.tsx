import React from 'react';
import { Timer } from '../Timer';
import type { Lobby2 } from '@promptmaster/shared';

interface WaitingForGuessesProps {
  lobby: Lobby2;
}

export const WaitingForGuesses: React.FC<WaitingForGuessesProps> = ({ lobby }) => {
  // Get the current round
  const currentRound = lobby.gameState?.rounds[lobby.gameState.rounds.length - 1];

  if (!currentRound || !currentRound.phaseEndTime || !currentRound.imageUrl) {
    return null;
  }

  // Get counts from round
  const guessCount = currentRound.guesses.length;
  const expectedGuessCount = currentRound.expectedGuessCount || 0;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm text-center">
      <img
        src={currentRound.imageUrl}
        alt="AI Generated"
        className="w-full aspect-[4/3] object-cover rounded-lg mb-4"
      />
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Waiting for Guesses</h2>
        <p className="text-slate-600">
          Other players are trying to guess your prompt...
          <br />
          <span className="font-medium">
            {guessCount}/{expectedGuessCount} {guessCount === 1 ? 'guess' : 'guesses'} submitted
          </span>
        </p>
      </div>

      <div className="flex justify-center">
        <Timer endTime={currentRound.phaseEndTime} />
      </div>
    </div>
  );
};
