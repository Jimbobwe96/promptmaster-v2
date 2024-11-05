"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinLobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !lobbyCode.trim()) return;

    setError("");
    setIsLoading(true);
    // TODO: API call to validate lobby code
    // For now, just simulate with timeout
    setTimeout(() => {
      router.push(`/lobby/${lobbyCode}`);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-800 p-8 rounded-lg shadow-xl"
      >
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Join Lobby
        </h1>

        <div className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={20}
            className="w-full h-12 px-4 bg-slate-700 text-white rounded-lg 
                       border-2 border-slate-600 focus:border-blue-500 
                       outline-none transition-colors"
          />

          <input
            type="text"
            value={lobbyCode}
            onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
            placeholder="Lobby code"
            maxLength={6}
            className="w-full h-12 px-4 bg-slate-700 text-white rounded-lg 
                       border-2 border-slate-600 focus:border-blue-500 
                       outline-none transition-colors uppercase"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!name.trim() || !lobbyCode.trim() || isLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 
                     disabled:bg-blue-800 disabled:cursor-not-allowed
                     text-white font-medium rounded-lg
                     transition-colors duration-200"
          >
            {isLoading ? "Joining..." : "Join Lobby"}
          </button>
        </div>
      </form>
    </div>
  );
}
