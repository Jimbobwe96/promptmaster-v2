'use client';

import { useRouter } from 'next/navigation';
import { SessionData } from '@promptmaster/shared';

interface ReconnectionModalProps {
  sessions: SessionData[];
  onClearAll: () => void;
  onRemoveSession: (lobbyCode: string) => void;
  onClose: () => void;
}

export const ReconnectionModal: React.FC<ReconnectionModalProps> = ({
  sessions,
  onClearAll,
  onRemoveSession,
  onClose
}) => {
  const router = useRouter();

  const handleRejoin = (session: SessionData) => {
    // Since we've validated with the backend, we now know this is a game in progress
    // If server validation passed, navigate directly to the game page
    // The socket connection will be established on the game page
    router.push(`/game/${session.lobbyCode}`);
  };

  const formatTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Unknown time';
    }
  };

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#1E293B]">Resume Game</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <p className="text-slate-600 mb-4">
          You have{' '}
          {sessions.length === 1 ? 'an active session' : 'active sessions'} from
          a previous game.
        </p>

        <div className="space-y-3 mb-6">
          {sessions.map((session) => (
            <div
              key={session.lobbyCode}
              className="p-4 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-slate-800">
                  {session.username}
                </span>
                <span className="text-xs text-slate-500">
                  Joined at {formatTime(session.joinedAt)}
                </span>
              </div>

              <div className="text-sm text-slate-600 mb-3">
                Lobby Code:{' '}
                <span className="font-mono font-medium">
                  {session.lobbyCode}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRejoin(session)}
                  className="flex-1 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Rejoin
                </button>
                <button
                  onClick={() => onRemoveSession(session.lobbyCode)}
                  className="py-2 px-3 bg-slate-100 text-slate-600 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Forget
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClearAll}
            className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
          >
            Clear All Sessions
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
