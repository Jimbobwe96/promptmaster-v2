import React from "react";
import { PromptInput } from "./PromptInput";
import { WaitingForPrompt } from "./WaitingForPrompt";
import type { GameRound } from "@promptmaster/shared";

interface PromptingPhaseProps {
  round: GameRound;
  timeLimit: number;
  currentPlayerId: string;
  onPromptSubmit: (prompt: string) => void;
  onDraftChange: (draft: string) => void;
}

export const PromptingPhase: React.FC<PromptingPhaseProps> = ({
  round,
  timeLimit,
  currentPlayerId,
  onPromptSubmit,
  onDraftChange,
}) => {
  const isPrompter = round.prompterId === currentPlayerId;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isPrompter ? (
        <PromptInput
          timeLimit={timeLimit}
          onSubmit={onPromptSubmit}
          onDraftChange={onDraftChange}
        />
      ) : (
        <WaitingForPrompt timeLimit={timeLimit} prompterId={round.prompterId} />
      )}
    </div>
  );
};
