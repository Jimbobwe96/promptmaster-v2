"use client";

import type { LobbyPlayer } from "@promptmaster/shared";

interface PlayerListProps {
  players: LobbyPlayer[];
  hostId: string;
}

export function PlayerList({ players, hostId }: PlayerListProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-slate-600">Players</h2>
        <span className="text-sm text-slate-400">
          {players.length}/8 players
        </span>
      </div>

      <div className="space-y-2">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
          >
            <div className="flex items-center gap-3">
              {/* Player icon/status */}
              <div
                className={`w-2 h-2 rounded-full ${
                  player.connected ? "bg-green-400" : "bg-red-400"
                }`}
              />

              {/* Player name */}
              <span className="font-medium text-slate-700">
                {player.username}
              </span>

              {/* Host badge */}
              {player.id === hostId && (
                <span className="px-2 py-0.5 text-xs font-medium text-[#4F46E5] bg-[#4F46E5]/10 rounded-full">
                  Host
                </span>
              )}
            </div>

            {/* Connection status for disconnected players */}
            {!player.connected && (
              <span className="text-sm text-red-400">Disconnected</span>
            )}
          </div>
        ))}
      </div>

      {players.length < 2 && (
        <div className="mt-4 text-center text-sm text-slate-500">
          Need at least 2 players to start
        </div>
      )}
    </div>
  );
}
