"use client";

import { useState } from "react";
import type { LobbySettings as Settings } from "@promptmaster/shared";
import { LOBBY_CONSTRAINTS } from "@promptmaster/shared";

interface LobbySettingsProps {
  settings: Settings;
  isHost: boolean;
  onUpdate: (settings: Partial<Settings>) => void;
}

export function LobbySettings({
  settings,
  isHost,
  onUpdate,
}: LobbySettingsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [roundsPerPlayer, setRoundsPerPlayer] = useState(
    settings.roundsPerPlayer
  );
  const [timeLimit, setTimeLimit] = useState(settings.timeLimit);

  const handleSave = () => {
    onUpdate({
      roundsPerPlayer,
      timeLimit,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setRoundsPerPlayer(settings.roundsPerPlayer);
    setTimeLimit(settings.timeLimit);
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-medium text-slate-600">Game Settings</h2>
        {isHost && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-[#4F46E5] hover:text-[#4F46E5]/80 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Rounds per player */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Rounds per Player
          </label>
          {isEditing ? (
            <input
              type="number"
              value={roundsPerPlayer}
              onChange={(e) => setRoundsPerPlayer(Number(e.target.value))}
              min={LOBBY_CONSTRAINTS.MIN_ROUNDS_PER_PLAYER}
              max={LOBBY_CONSTRAINTS.MAX_ROUNDS_PER_PLAYER}
              className="w-full px-3 py-2 rounded-lg border border-slate-200
                       focus:outline-none focus:ring-2 focus:ring-[#4F46E5]
                       focus:border-transparent"
            />
          ) : (
            <div className="px-3 py-2 bg-slate-50 rounded-lg text-slate-700">
              {settings.roundsPerPlayer} rounds
            </div>
          )}
        </div>

        {/* Time limit */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Time Limit (seconds)
          </label>
          {isEditing ? (
            <input
              type="number"
              value={timeLimit}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              min={LOBBY_CONSTRAINTS.MIN_TIME_LIMIT}
              max={LOBBY_CONSTRAINTS.MAX_TIME_LIMIT}
              step={5}
              className="w-full px-3 py-2 rounded-lg border border-slate-200
                       focus:outline-none focus:ring-2 focus:ring-[#4F46E5]
                       focus:border-transparent"
            />
          ) : (
            <div className="px-3 py-2 bg-slate-50 rounded-lg text-slate-700">
              {settings.timeLimit} seconds
            </div>
          )}
        </div>

        {/* Edit mode buttons */}
        {isEditing && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-[#4F46E5] text-white rounded-lg
                       hover:bg-[#4F46E5]/90 transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg
                       hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Settings info for non-hosts */}
        {!isHost && (
          <p className="text-sm text-slate-400 text-center">
            Only the host can change game settings
          </p>
        )}
      </div>
    </div>
  );
}
