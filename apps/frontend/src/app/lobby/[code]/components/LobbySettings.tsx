import React from "react";
import { LOBBY_CONSTRAINTS } from "@promptmaster/shared";
import type { LobbySettings as LobbySettingsType } from "@promptmaster/shared";

interface LobbySettingsProps {
  settings: LobbySettingsType;
  isHost: boolean;
  canStart: boolean;
  onStart: () => void;
  onUpdate: (settings: Partial<LobbySettingsType>) => void;
}

export const LobbySettings = ({
  settings,
  isHost,
  canStart,
  onStart,
  onUpdate,
}: LobbySettingsProps) => {
  const handleRoundsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    onUpdate({ roundsPerPlayer: value });
  };

  const handleTimeLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    onUpdate({ timeLimit: value });
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800 mb-6">
        Game Settings
      </h2>

      <div className="space-y-6">
        {/* Rounds per Player */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-700">
              Rounds per Player
            </label>
            <span className="text-sm font-medium text-slate-900">
              {settings.roundsPerPlayer}
            </span>
          </div>
          <input
            type="range"
            min={LOBBY_CONSTRAINTS.MIN_ROUNDS_PER_PLAYER}
            max={LOBBY_CONSTRAINTS.MAX_ROUNDS_PER_PLAYER}
            value={settings.roundsPerPlayer}
            onChange={handleRoundsChange}
            disabled={!isHost}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer
              ${
                isHost
                  ? "bg-slate-200 range-input-host"
                  : "bg-slate-100 cursor-not-allowed"
              }`}
          />
        </div>

        {/* Time Limit */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-700">
              Time Limit
            </label>
            <span className="text-sm font-medium text-slate-900">
              {settings.timeLimit}s
            </span>
          </div>
          <input
            type="range"
            min={LOBBY_CONSTRAINTS.MIN_TIME_LIMIT}
            max={LOBBY_CONSTRAINTS.MAX_TIME_LIMIT}
            value={settings.timeLimit}
            onChange={handleTimeLimitChange}
            disabled={!isHost}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer
              ${
                isHost
                  ? "bg-slate-200 range-input-host"
                  : "bg-slate-100 cursor-not-allowed"
              }`}
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>{LOBBY_CONSTRAINTS.MIN_TIME_LIMIT}s</span>
            <span>{LOBBY_CONSTRAINTS.MAX_TIME_LIMIT}s</span>
          </div>
        </div>

        {/* Control messages */}
        {!isHost && (
          <p className="text-sm text-slate-500 italic mb-6">
            Only the host can modify game settings
          </p>
        )}

        {/* Start Game Button */}
        <div className="pt-4 border-t border-slate-200">
          <button
            onClick={onStart}
            disabled={isHost ? !canStart : true}
            className={`w-full px-6 py-3 rounded-lg font-medium
                     transition-all duration-200
                     ${
                       isHost
                         ? "bg-[#4F46E5] text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:translate-y-[-2px]"
                         : "bg-slate-100 text-slate-600"
                     }
                     disabled:opacity-50 disabled:cursor-not-allowed
                     disabled:hover:translate-y-0 disabled:hover:shadow-none`}
          >
            {isHost ? (
              !canStart ? (
                <>
                  <span className="block text-lg">Waiting for Players</span>
                  <span className="block text-sm opacity-75">
                    Need at least 2 players to start
                  </span>
                </>
              ) : (
                <>
                  <span className="block text-lg">Start Game</span>
                  <span className="block text-sm opacity-75">
                    All players are ready
                  </span>
                </>
              )
            ) : (
              <>
                <span className="block text-lg">
                  {canStart ? "Waiting for Host" : "Waiting for Players"}
                </span>
                <span className="block text-sm opacity-75">
                  {canStart
                    ? "Game will start soon"
                    : "Need at least 2 players to start"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .range-input-host::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          background: #4f46e5;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .range-input-host::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          background: #4338ca;
        }

        .range-input-host::-moz-range-thumb {
          width: 18px;
          height: 18px;
          background: #4f46e5;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }

        .range-input-host::-moz-range-thumb:hover {
          transform: scale(1.1);
          background: #4338ca;
        }
      `}</style>
    </div>
  );
};
