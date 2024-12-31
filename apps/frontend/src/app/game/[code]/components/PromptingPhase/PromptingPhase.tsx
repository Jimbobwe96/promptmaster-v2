import React, { forwardRef } from 'react';
import { PromptInput, PromptInputHandle } from './PromptInput';
import { WaitingForPrompt } from './WaitingForPrompt';
import type { GameRound, LobbyPlayer } from '@promptmaster/shared';

interface PromptingPhaseProps {
  round: GameRound;
  currentPlayerId: string;
  onPromptSubmit: (prompt: string) => void;
  players: LobbyPlayer[];
}

export const PromptingPhase = forwardRef<
  PromptInputHandle,
  PromptingPhaseProps
>(({ round, currentPlayerId, onPromptSubmit, players }, ref) => {
  console.log('Phase endTime:', round.endTime);
  const isPrompter = round.prompterId === currentPlayerId;

  // Add this to find the prompter's username
  const prompterUsername =
    players.find((p) => p.id === round.prompterId)?.username ||
    'Unknown Player';

  if (!round.endTime) {
    console.log('No endTime available for round');
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isPrompter ? (
        <PromptInput
          ref={ref}
          endTime={round.endTime}
          onSubmit={onPromptSubmit}
        />
      ) : (
        <WaitingForPrompt
          endTime={round.endTime}
          prompterUsername={prompterUsername}
        />
      )}
    </div>
  );
});

PromptingPhase.displayName = 'PromptingPhase';
