import React, { useState } from 'react';
import type { LobbyPlayer } from '@promptmaster/shared';
import type { RoundResults } from '@promptmaster/shared';

interface GuessesSectionProps {
  guesses: RoundResults['guesses'];
  players: LobbyPlayer[];
  prompterId: string;
}

export const GuessesSection: React.FC<GuessesSectionProps> = ({
  guesses,
  players,
  prompterId
}) => {
  const [activeGuessId, setActiveGuessId] = useState<string | null>(null);

  // Sort guesses by score (highest first)
  const sortedGuesses = [...guesses].sort((a, b) => b.score - a.score);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-blue-100 text-blue-700';
    if (score >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
      <h3 className="text-lg font-medium text-slate-800 mb-6 text-center">
        Player Guesses
      </h3>

      <div className="flex justify-center gap-4 flex-wrap">
        {sortedGuesses.map((guess) => {
          const player = players.find((p) => p.id === guess.playerId);
          if (!player || guess.playerId === prompterId) return null;

          const isActive = activeGuessId === guess.playerId;
          const scoreColorClasses = getScoreColor(guess.score);

          return (
            <div
              key={guess.playerId}
              className="relative"
              onMouseEnter={() => setActiveGuessId(guess.playerId)}
              onMouseLeave={() => setActiveGuessId(null)}
              onFocus={() => setActiveGuessId(guess.playerId)}
              onBlur={() => setActiveGuessId(null)}
            >
              {/* Player Avatar */}
              <button
                className={`w-16 h-16 rounded-full flex items-center justify-center text-lg font-medium
                          ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}
                          ${scoreColorClasses}`}
                aria-expanded={isActive}
                aria-label={`${player.username}'s guess`}
              >
                {player.username.charAt(0).toUpperCase()}
              </button>

              {/* Score Badge */}
              <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
                <span className="text-sm font-medium text-slate-700">
                  +{Math.round(guess.score)}
                </span>
              </div>

              {/* Tooltip */}
              {isActive && (
                <div className="absolute z-10 top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-4 bg-white rounded-lg shadow-lg">
                  <div className="text-center mb-3">
                    <div className="font-medium text-slate-800 mb-1">
                      {player.username}
                    </div>
                    <div
                      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${scoreColorClasses}`}
                    >
                      {guess.score}% Match
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm italic">
                    "{guess.guess}"
                  </p>
                  {/* Arrow */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rotate-45 bg-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
