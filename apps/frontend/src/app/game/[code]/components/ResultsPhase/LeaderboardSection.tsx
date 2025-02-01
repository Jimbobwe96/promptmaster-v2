import React from 'react';
import type { LobbyPlayer } from '@promptmaster/shared';
import type { RoundResults } from '@promptmaster/shared';

interface LeaderboardSectionProps {
  scores: RoundResults['scores'];
  roundScores: RoundResults['roundScores'];
  players: LobbyPlayer[];
  isLastRound: boolean;
}

export const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({
  scores,
  roundScores,
  players,
  isLastRound
}) => {
  // Sort players by total score
  const rankedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  // Get position change indicator for a player
  const getPositionIndicator = (currentPosition: number, playerId: string) => {
    // In a real implementation, we'd compare with previous round's positions
    // For now, let's simulate some movement based on round scores
    const roundScore =
      roundScores.find((s) => s.playerId === playerId)?.score || 0;
    const change = roundScore > 50 ? 1 : roundScore > 30 ? 0 : -1;

    if (change === 0) return null;

    return (
      <div
        className={`flex items-center gap-1 ${change > 0 ? 'text-emerald-600' : 'text-red-600'}`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`transition-transform ${change > 0 ? 'rotate-0' : 'rotate-180'}`}
        >
          <path fill="currentColor" d="M6 0l4.5 6h-9L6 0z" />
        </svg>
        <span className="text-xs font-medium">{Math.abs(change)}</span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-medium text-slate-800 mb-6 text-center">
        {isLastRound ? 'Final Standings' : 'Current Standings'}
      </h3>

      <div className="space-y-3">
        {rankedScores.map((score, index) => {
          const player = players.find((p) => p.id === score.playerId);
          const roundScore =
            roundScores.find((s) => s.playerId === score.playerId)?.score || 0;

          if (!player) return null;

          // Style variations for different positions
          const positionStyles =
            index === 0
              ? 'bg-indigo-50 border-indigo-100 shadow-indigo-100/50'
              : index === 1
                ? 'bg-slate-50 border-slate-100 shadow-slate-100/50'
                : 'bg-white border-slate-100';

          return (
            <div
              key={score.playerId}
              className={`relative flex items-center p-4 border rounded-lg shadow-sm ${positionStyles}`}
            >
              {/* Position Number */}
              <div className="w-8 font-medium text-slate-600">#{index + 1}</div>

              {/* Player Info */}
              <div className="flex-1">
                <div className="font-medium text-slate-800">
                  {player.username}
                </div>
                <div className="text-sm text-slate-500">
                  +{roundScore} this round
                </div>
              </div>

              {/* Score Area */}
              <div className="flex items-center gap-3">
                {getPositionIndicator(index + 1, score.playerId)}
                <div className="text-2xl font-semibold text-slate-800">
                  {score.totalScore}
                </div>
              </div>

              {/* First Place Crown (if final round) */}
              {isLastRound && index === 0 && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">👑</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
