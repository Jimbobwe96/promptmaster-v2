import React from 'react';
import type { LobbyPlayer } from '@promptmaster/shared';
import type { RoundResults } from '@promptmaster/shared';
import { Timer } from '../Timer';
import { useSocket } from '@/hooks/useSocket';

interface LeaderboardSectionProps {
  scores: RoundResults['scores'];
  roundScores: RoundResults['roundScores'];
  guesses: RoundResults['guesses'];
  players: LobbyPlayer[];
  prompterId: string;
  isLastRound: boolean;
  onNextRound?: () => void;
  readyPlayers: string[];
  readyPhaseEndTime: number;
}

export const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({
  scores,
  roundScores,
  guesses,
  players,
  prompterId,
  isLastRound,
  readyPlayers,
  readyPhaseEndTime
}) => {
  const [activePlayerId, setActivePlayerId] = React.useState<string | null>(
    null
  );
  const { socket, emit } = useSocket();

  const isReady = socket?.id ? readyPlayers.includes(socket.id) : false;

  const handleReadyClick = () => {
    if (!socket || isReady) return;
    emit('game:mark_ready');
  };

  const rankedScores = [...scores].sort((a, b) => b.totalScore - a.totalScore);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getRankStyles = (position: number) => {
    switch (position) {
      case 0:
        return 'bg-amber-100/80 border-amber-200';
      case 1:
        return 'bg-slate-100/80 border-slate-200';
      case 2:
        return 'bg-orange-100/70 border-orange-200';
      default:
        return 'bg-white border-slate-100';
    }
  };

  const getPositionIndicator = (currentPosition: number, playerId: string) => {
    const roundScore =
      roundScores.find((s) => s.playerId === playerId)?.score || 0;
    const change = roundScore > 50 ? 1 : roundScore > 30 ? 0 : -1;

    if (change === 0) {
      return (
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-sm">―</span>
        </div>
      );
    }

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
    <>
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <div className="space-y-3">
          {rankedScores.map((score, index) => {
            const player = players.find((p) => p.id === score.playerId);
            const roundScore =
              roundScores.find((s) => s.playerId === score.playerId)?.score ||
              0;
            const guess = guesses.find((g) => g.playerId === score.playerId);
            const isActive = activePlayerId === score.playerId;
            const isPrompter = score.playerId === prompterId;

            if (!player) return null;

            return (
              <div key={score.playerId} className="relative">
                <div
                  className={`relative flex items-center p-4 border rounded-lg shadow-sm 
                              ${getRankStyles(index)}
                              ${guess ? 'cursor-pointer hover:border-indigo-200' : ''}`}
                  onMouseEnter={() =>
                    guess && setActivePlayerId(score.playerId)
                  }
                  onMouseLeave={() => setActivePlayerId(null)}
                >
                  <div className="flex items-center gap-2 w-20">
                    <span className="font-medium text-slate-600">
                      #{index + 1}
                    </span>
                    {getPositionIndicator(index + 1, score.playerId)}
                  </div>

                  <div className="flex-1">
                    <div className="font-medium text-slate-800">
                      {player.username}
                    </div>
                    {isPrompter ? (
                      <div className="text-xs">
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                          Prompter
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">
                        +{roundScore} this round
                      </div>
                    )}
                  </div>

                  <div className="text-2xl font-semibold text-slate-800">
                    {score.totalScore}
                  </div>

                  {index < 3 && isLastRound && (
                    <div
                      className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg text-lg"
                      style={{
                        background:
                          index === 0
                            ? '#FFD700'
                            : index === 1
                              ? '#C0C0C0'
                              : '#CD7F32'
                      }}
                    >
                      {index === 0 ? '👑' : '🏅'}
                    </div>
                  )}
                </div>

                {isActive && guess && (
                  <div className="absolute z-10 right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+1rem)] w-48 p-3 bg-white rounded-lg shadow-lg">
                    <div className="text-center mb-2">
                      <div
                        className={`text-sm font-medium ${getScoreColor(guess.score)}`}
                      >
                        {guess.score}% Match
                      </div>
                    </div>
                    <p className="text-slate-600 text-sm italic">
                      &ldquo;{guess.guess}&rdquo;
                    </p>
                    <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rotate-45 bg-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <div className="bg-white rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <span className="font-medium">
              {readyPlayers.length}/{players.length} Players Ready
            </span>
            {readyPhaseEndTime && (
              <>
                <span>•</span>
                <Timer endTime={readyPhaseEndTime} isPaused={false} />
              </>
            )}
          </div>

          <button
            onClick={handleReadyClick}
            disabled={isReady}
            className={`w-full px-6 py-4 rounded-xl text-lg font-medium transition-all duration-200
              ${
                isReady
                  ? 'bg-emerald-100 text-emerald-700 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
          >
            {isReady ? "You're Ready!" : 'Ready Up!'}
          </button>
        </div>
      </div>
    </>
  );
};
