import React, { forwardRef } from 'react';
import { PromptInput, PromptInputHandle } from './PromptInput';
import { WaitingForPrompt } from './WaitingForPrompt';
import type { Lobby2 } from '@promptmaster/shared';

interface PromptingPhaseProps {
  lobby: Lobby2;
  currentUsername: string;
  onPromptSubmit: (prompt: string) => void;
}

export const PromptingPhase = forwardRef<PromptInputHandle, PromptingPhaseProps>(
  ({ lobby, currentUsername, onPromptSubmit }, ref) => {
    // Get the current round (last round in the array)
    const currentRound = lobby.gameState?.rounds[lobby.gameState.rounds.length - 1];

    if (!currentRound) {
      console.log('No current round available');
      return null;
    }

    console.log('Prompting phase endTime:', currentRound.phaseEndTime);

    // Debug the prompter assignment
    console.log('DEBUG PROMPTER ASSIGNMENT:');
    console.log('- currentRound.prompterUsername:', currentRound.prompterUsername);
    console.log('- currentUsername:', currentUsername);
    console.log('- prompterOrder:', lobby.gameState?.prompterOrder);
    console.log(
      '- all players:',
      lobby.players.map((p) => ({ username: p.username, connected: p.connected }))
    );

    const isPrompter = currentRound.prompterUsername === currentUsername;
    console.log('- isPrompter:', isPrompter);

    if (!currentRound.phaseEndTime) {
      console.log('No phaseEndTime available for round');
      return null;
    }

    return (
      <div className="w-full max-w-2xl mx-auto">
        {isPrompter ? (
          <PromptInput ref={ref} lobby={lobby} onSubmit={onPromptSubmit} />
        ) : (
          <WaitingForPrompt lobby={lobby} />
        )}
      </div>
    );
  }
);

PromptingPhase.displayName = 'PromptingPhase';
