"use client";

interface HostControlsProps {
  canStart: boolean; // Based on player count >= 2
  onStart: () => void;
}

export function HostControls({ canStart, onStart }: HostControlsProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="text-center space-y-4">
        <h2 className="text-lg font-medium text-slate-600">Host Controls</h2>

        <button
          onClick={onStart}
          disabled={!canStart}
          className="w-full px-6 py-3 bg-[#4F46E5] text-white rounded-lg
                   font-medium shadow-lg shadow-indigo-500/25
                   hover:shadow-indigo-500/40 hover:translate-y-[-2px]
                   transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed
                   disabled:hover:translate-y-0 disabled:hover:shadow-indigo-500/25"
        >
          {!canStart ? (
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
          )}
        </button>
      </div>
    </div>
  );
}
