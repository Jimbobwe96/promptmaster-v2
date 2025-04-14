import React, { useState, useRef, useEffect } from 'react';
import type { Player } from '@promptmaster/shared';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';

interface PlayerListProps {
  players: Player[];
  hostUsername: string;
  currentUsername: string;
  onKickPlayer?: (username: string) => void;
}

export const PlayerList = ({ players, hostUsername, currentUsername, onKickPlayer }: PlayerListProps) => {
  const [kickingUsername, setKickingUsername] = useState<string | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const DISCONNECT_TIMEOUT_MS = 15000;
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getDisconnectTime = (lastSeen: Date | undefined) => {
    if (!lastSeen) return 0;
    return Math.max(0, now - new Date(lastSeen).getTime());
  };

  const getRemainingTime = (disconnectTimeMs: number) => {
    const remaining = DISCONNECT_TIMEOUT_MS - disconnectTimeMs;
    return Math.max(0, Math.ceil(remaining / 1000));
  };

  const handleKickClick = (username: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setKickingUsername(username);

    timeoutRef.current = setTimeout(() => {
      setKickingUsername(null);
      timeoutRef.current = null;
    }, 3000);
  };

  const handleConfirmKick = (username: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    onKickPlayer?.(username);
    setKickingUsername(null);
  };

  const handleCancelKick = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setKickingUsername(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Players</h2>
          <span className="text-sm font-medium text-slate-500">
            {players.length}/{LOBBY_CONSTRAINTS.MAX_PLAYERS}
          </span>
        </div>
        <div className="space-y-3">
          {players.map((player) => {
            const isCurrentUser = player.username === currentUsername;
            const disconnectTimeMs = !player.connected ? getDisconnectTime(player.lastSeen) : 0;
            const remainingTimeSeconds = getRemainingTime(disconnectTimeMs);

            if (!player.connected && disconnectTimeMs >= DISCONNECT_TIMEOUT_MS) {
              return null;
            }

            return (
              <div
                key={player.username}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors
                  ${
                    isCurrentUser
                      ? 'bg-indigo-50 border-l-4 border-indigo-500'
                      : player.connected
                        ? 'bg-slate-50'
                        : 'bg-red-50'
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-2 h-2 rounded-full ${player.connected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-700">{player.username}</span>
                      {player.username === hostUsername && (
                        <span className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded-full font-medium">
                          Host
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 text-xs bg-slate-50 text-slate-600 rounded-full font-medium">
                          You
                        </span>
                      )}
                    </div>
                    {!player.connected && remainingTimeSeconds > 0 && (
                      <div className="text-xs text-red-600 mt-1">
                        Disconnected • Reconnecting ({remainingTimeSeconds}s)
                      </div>
                    )}
                  </div>
                </div>

                {currentUsername === hostUsername && player.username !== hostUsername && (
                  <div className="flex items-center">
                    {kickingUsername === player.username ? (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleConfirmKick(player.username)}
                          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={handleCancelKick}
                          className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleKickClick(player.username)}
                        className={`text-xs px-2 py-1 rounded transition-colors
                          ${
                            player.connected
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                      >
                        {player.connected ? 'Kick' : 'Remove'}
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
