/* eslint-disable @next/next/no-img-element */

import React from 'react';
import { Timer } from '../Timer';

interface WaitingForGuessesProps {
  endTime: number;
  imageUrl: string;
  guessCount: number;
}

export const WaitingForGuesses: React.FC<WaitingForGuessesProps> = ({
  endTime,
  imageUrl,
  guessCount
}) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm text-center">
      <img
        src={imageUrl}
        alt="AI Generated"
        className="w-full aspect-[4/3] object-cover rounded-lg mb-4"
      />
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          Waiting for Guesses
        </h2>
        <p className="text-slate-600">
          Other players are trying to guess your prompt...
          <br />
          <span className="font-medium">
            {guessCount} {guessCount === 1 ? 'guess' : 'guesses'} submitted
          </span>
        </p>
      </div>

      <div className="flex justify-center">
        <Timer endTime={endTime} />
      </div>
    </div>
  );
};
