import React, { forwardRef } from "react";
import { GuessInput, GuessInputHandle } from "./GuessInput";
import { WaitingForGuesses } from "./WaitingForGuesses";
import type { GameRound } from "@promptmaster/shared";

interface GuessingPhaseProps {
  round: GameRound;
  currentPlayerId: string;
  onGuessSubmit: (guess: string) => void;
}

export const GuessingPhase = forwardRef<GuessInputHandle, GuessingPhaseProps>(
  ({ round, currentPlayerId, onGuessSubmit }, ref) => {
    console.log("Phase endTime:", round.endTime);
    const isPrompter = round.prompterId === currentPlayerId;
    const hasGuessed = round.guesses.some(
      (g) => g.playerId === currentPlayerId,
    );

    // We can return early if endTime isn't set
    if (!round.endTime) {
      console.log("No endTime available for round");
      return null;
    }

    if (!round.imageUrl) {
      console.log("No image URL available");
      return null;
    }

    return (
      <div className="w-full max-w-2xl mx-auto">
        {isPrompter ? (
          <WaitingForGuesses
            endTime={round.endTime}
            imageUrl={round.imageUrl}
            guessCount={round.guesses.length}
          />
        ) : hasGuessed ? (
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <img
              src={round.imageUrl}
              alt="AI Generated"
              className="w-full h-64 object-cover rounded-lg mb-4"
            />

            <p className="text-slate-600">
              Guess submitted! Waiting for other players...
            </p>
          </div>
        ) : (
          <GuessInput
            ref={ref}
            endTime={round.endTime}
            imageUrl={round.imageUrl}
            onSubmit={onGuessSubmit}
          />
        )}
      </div>
    );
  },
);

GuessingPhase.displayName = "GuessingPhase";
