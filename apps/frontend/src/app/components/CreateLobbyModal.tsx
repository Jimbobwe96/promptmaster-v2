'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LOBBY_CONSTRAINTS } from '@promptmaster/shared';

interface CreateLobbyModalProps {
  onClose: () => void;
}

export const CreateLobbyModal: React.FC<CreateLobbyModalProps> = ({
  onClose
}) => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUsername = username.trim();

    if (!trimmedUsername) {
      setError('Please enter a username');
      return;
    }

    if (
      trimmedUsername.length < LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH ||
      trimmedUsername.length > LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH
    ) {
      setError(
        `Username must be between ${LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH} and ${LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH} characters`
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lobbies/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create lobby');
      }

      const lobby = await response.json();

      // Store session data
      const session = {
        lobbyCode: lobby.code,
        username: trimmedUsername,
        socketID: '', // Will be set when socket connects
        joinedAt: new Date().toISOString()
      };

      sessionStorage.setItem(`lobby:${lobby.code}`, JSON.stringify(session));

      // Close modal before redirect
      onClose();
      router.push(`/lobby/${lobby.code}`);
    } catch (err) {
      console.error('Error creating lobby:', err);
      setError(err instanceof Error ? err.message : 'Failed to create lobby');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[#1E293B]">Create a Lobby</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCreate}>
          <div className="mb-6">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-600 mb-2"
            >
              Your Name
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 text-[#1E293B]
                       focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent
                       disabled:bg-slate-50 disabled:text-slate-400"
              required
              disabled={isLoading}
              minLength={LOBBY_CONSTRAINTS.USERNAME_MIN_LENGTH}
              maxLength={LOBBY_CONSTRAINTS.USERNAME_MAX_LENGTH}
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg
                       hover:bg-slate-200 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-[#4F46E5] text-white rounded-lg
                       hover:bg-[#4F46E5]/90 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                'Create Lobby'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
