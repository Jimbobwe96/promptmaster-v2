import React from 'react';
import type { RoundResults, LobbyPlayer } from '@promptmaster/shared';

// Sub-component Props Types
interface RevealSectionProps {
  imageUrl: string;
  prompt: string;
  prompterId: string;
  players: LobbyPlayer[];
}

interface GuessesSectionProps {
  guesses: RoundResults['guesses'];
  players: LobbyPlayer[];
}

interface ScoresSectionProps {
  roundScores: RoundResults['roundScores'];
  totalScores: RoundResults['totalScores'];
  players: LobbyPlayer[];
}

// Sub-components
const RevealSection: React.FC<RevealSectionProps> = ({
  imageUrl,
  prompt,
  prompterId,
  players
}) => {
  const prompter = players.find((p) => p.id === prompterId);

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
      <img
        src={imageUrl}
        alt="AI Generated"
        className="w-full aspect-[4/3] object-cover rounded-lg mb-4"
      />
      <div className="text-center">
        <h3 className="text-2xl font-semibold text-slate-800 mb-2">
          Original Prompt
        </h3>
        <p className="text-lg text-slate-600 mb-4 font-medium">"{prompt}"</p>
        <p className="text-sm text-slate-500">
          Prompted by{' '}
          <span className="font-medium">{prompter?.username || 'Unknown'}</span>
        </p>
      </div>
    </div>
  );
};

const GuessesSection: React.FC<GuessesSectionProps> = ({
  guesses,
  players
}) => {
  // Sort guesses by score (highest first)
  const sortedGuesses = [...guesses].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0)
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
      <h3 className="text-xl font-semibold text-slate-800 mb-4">
        Player Guesses
      </h3>
      <div className="space-y-4">
        {sortedGuesses.map((guess) => {
          const player = players.find((p) => p.id === guess.playerId);
          return (
            <div
              key={guess.playerId}
              className="p-4 rounded-lg bg-slate-50 border border-slate-200"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-medium text-slate-700">
                  {player?.username || 'Unknown'}
                </span>
                <span className="text-sm font-medium px-3 py-1 rounded-full bg-indigo-100 text-indigo-700">
                  {guess.score}% Match
                </span>
              </div>
              <p className="text-slate-600">"{guess.guess}"</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScoresSection: React.FC<ScoresSectionProps> = ({
  roundScores,
  totalScores,
  players
}) => {
  // Sort by total score (highest first)
  const sortedScores = [...totalScores].sort(
    (a, b) => b.totalScore - a.totalScore
  );

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
      <h3 className="text-xl font-semibold text-slate-800 mb-4">Scores</h3>
      <div className="space-y-4">
        {sortedScores.map(({ playerId, totalScore }) => {
          const player = players.find((p) => p.id === playerId);
          const roundScore =
            roundScores.find((s) => s.playerId === playerId)?.score ?? 0;

          return (
            <div
              key={playerId}
              className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200"
            >
              <div className="flex items-center space-x-4">
                <span className="font-medium text-slate-700">
                  {player?.username || 'Unknown'}
                </span>
                <span className="text-sm text-slate-500">
                  +{roundScore} this round
                </span>
              </div>
              <span className="font-bold text-lg text-indigo-600">
                {totalScore}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main Component Props
interface ResultsPhaseProps {
  results: RoundResults;
  players: LobbyPlayer[];
  onNextRound?: () => void;
}

// Main Component
export const ResultsPhase: React.FC<ResultsPhaseProps> = ({
  results,
  players,
  onNextRound
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Round Number Header */}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-800">
          Round {results.roundNumber} Results
        </h2>
      </div>

      {/* Main Content Sections */}
      <RevealSection
        imageUrl={results.imageUrl}
        prompt={results.originalPrompt}
        prompterId={results.prompterId}
        players={players}
      />

      <GuessesSection guesses={results.guesses} players={players} />

      <ScoresSection
        roundScores={results.roundScores}
        totalScores={results.totalScores}
        players={players}
      />

      {/* Navigation */}
      {onNextRound && (
        <div className="flex justify-center">
          <button
            onClick={onNextRound}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg
                     hover:bg-indigo-700 transition-colors font-medium
                     shadow-lg shadow-indigo-500/25"
          >
            {results.isLastRound ? 'View Final Results' : 'Next Round'}
          </button>
        </div>
      )}
    </div>
  );
};
