import React from "react";
import { LOBBY_CONSTRAINTS } from "@promptmaster/shared";
import type { LobbySettings as LobbySettingsType } from "@promptmaster/shared";

interface LobbySettingsProps {
  settings: LobbySettingsType;
  isHost: boolean;
  onUpdate: (settings: Partial<LobbySettingsType>) => void;
}

export const LobbySettings = ({
  settings,
  isHost,
  onUpdate,
}: LobbySettingsProps) => {
  console.log("LobbySettings render:", { settings, isHost }); // Debug current props

  const handleRoundsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    console.log("Rounds change:", {
      oldValue: settings.roundsPerPlayer,
      newValue: value,
      rawInputValue: e.target.value,
    });
    onUpdate({ roundsPerPlayer: value });
  };

  const handleTimeLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    console.log("Time limit change:", {
      oldValue: settings.timeLimit,
      newValue: value,
      rawInputValue: e.target.value,
    });
    onUpdate({ timeLimit: value });
  };

  // Let's also add mousedown/mouseup handlers to debug dragging
  const handleMouseDown = () => {
    console.log("Mouse down on slider");
  };

  const handleMouseUp = () => {
    console.log("Mouse up on slider");
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
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
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
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
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

        {!isHost && (
          <p className="text-sm text-slate-500 italic">
            Only the host can modify game settings
          </p>
        )}
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
