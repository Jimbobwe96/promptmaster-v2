'use client';

import React from 'react';
import { Timer } from '../Timer';
import type { Lobby2 } from '@promptmaster/shared';

interface WaitingForPromptProps {
  lobby: Lobby2;
}

export const WaitingForPrompt: React.FC<WaitingForPromptProps> = ({ lobby }) => {
  // Get the current round
  const currentRound = lobby.gameState?.rounds[lobby.gameState.rounds.length - 1];

  if (!currentRound || !currentRound.phaseEndTime) {
    return null;
  }

  // Find the prompter's username
  const prompterUsername = currentRound.prompterUsername;

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm text-center">
      <div className="mb-6">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-slate-800 mb-2">Waiting for Prompt</h2>
        <p className="text-slate-600">{prompterUsername} is creating the prompt...</p>
      </div>

      <div className="flex justify-center">
        <Timer endTime={currentRound.phaseEndTime} />
      </div>
    </div>
  );
};
