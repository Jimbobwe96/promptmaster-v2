import React, { useState } from "react";
import type { LobbyPlayer } from "@promptmaster/shared";

interface PlayerListProps {
  players: LobbyPlayer[];
  hostId: string;
  currentUserId: string; // Add this prop
  isHost?: boolean;
  onKickPlayer?: (playerId: string) => void;
}

export const PlayerList = ({
  players,
  hostId,
  currentUserId,
  isHost,
  onKickPlayer,
}: PlayerListProps) => {
  const [kickingPlayerId, setKickingPlayerId] = useState<string | null>(null);

  const handleKickClick = (playerId: string) => {
    setKickingPlayerId(playerId);
    setTimeout(() => setKickingPlayerId(null), 3000);
  };

  const handleConfirmKick = (playerId: string) => {
    onKickPlayer?.(playerId);
    setKickingPlayerId(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Players</h2>
        <div className="space-y-3">
          {players.map((player) => {
            const isCurrentUser = player.id === currentUserId;

            return (
              <div
                key={player.username}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors
                  ${
                    isCurrentUser
                      ? "bg-indigo-50 border-l-4 border-indigo-500"
                      : player.connected
                      ? "bg-slate-50"
                      : "bg-slate-100"
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      player.connected ? "bg-green-400" : "bg-slate-400"
                    }`}
                  />
                  <div className="font-medium text-slate-700">
                    <span>{player.username}</span>
                    {player.id === hostId && (
                      <span className="ml-2 text-xs text-indigo-600 font-semibold">
                        (Host)
                      </span>
                    )}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-slate-500">(You)</span>
                    )}
                  </div>
                </div>

                {isHost && player.id !== hostId && (
                  <div className="flex items-center">
                    {kickingPlayerId === player.id ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleConfirmKick(player.id)}
                          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setKickingPlayerId(null)}
                          className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleKickClick(player.id)}
                        className={`text-xs px-2 py-1 rounded transition-colors
                          ${
                            player.connected
                              ? "bg-slate-200 text-slate-700 hover:bg-slate-300"
                              : "bg-red-100 text-red-600 hover:bg-red-200"
                          }`}
                      >
                        {player.connected ? "Kick" : "Remove"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
