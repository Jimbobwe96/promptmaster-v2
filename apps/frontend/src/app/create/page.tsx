"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateLobby() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    // TODO: API call to create lobby and get lobby ID
    // For now, just simulate with timeout
    setTimeout(() => {
      router.push(`/lobby/test-id`);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-slate-800 p-8 rounded-lg shadow-xl"
      >
        <h1 className="text-3xl font-bold text-white mb-8 text-center">
          Enter Your Name
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

          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 
                     disabled:bg-blue-800 disabled:cursor-not-allowed
                     text-white font-medium rounded-lg
                     transition-colors duration-200"
          >
            {isLoading ? "Creating Lobby..." : "Create Lobby"}
          </button>
        </div>
      </form>
    </div>
  );
}
