import React from 'react';
import type { RoundResults, LobbyPlayer } from '@promptmaster/shared';
import { ImageSection } from './ImageSection';
import { LeaderboardSection } from './LeaderboardSection';

interface ResultsPhaseProps {
  results: RoundResults;
  players: LobbyPlayer[];
  onNextRound?: () => void;
}

export const ResultsPhase: React.FC<ResultsPhaseProps> = ({
  results,
  players,
  onNextRound
}) => {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3">
          <ImageSection
            imageUrl={results.imageUrl}
            prompt={results.originalPrompt}
            prompterId={results.prompterId}
            players={players}
          />
        </div>
        <div className="lg:col-span-2">
          <LeaderboardSection
            scores={results.scores}
            roundScores={results.roundScores}
            guesses={results.guesses}
            players={players}
            prompterId={results.prompterId}
            isLastRound={results.isLastRound}
            onNextRound={onNextRound}
          />
        </div>
      </div>
    </div>
  );
};
