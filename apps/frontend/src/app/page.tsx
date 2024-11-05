"use client";

import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    // TODO: Handle lobby creation
    console.log("Creating lobby with name:", createName);
    setIsCreateModalOpen(false);
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim() || !lobbyCode.trim()) return;

    // TODO: Handle lobby joining
    console.log("Joining lobby:", { name: joinName, code: lobbyCode });
    setIsJoinModalOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#FAFBFF] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#4F46E5] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F97066] opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-7xl font-bold text-[#1E293B] mb-6 tracking-tight">
            Prompt
            <span className="text-[#4F46E5]">master</span>
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Unleash your creativity with the original AI image prompt-guessing
            game
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-6">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-8 py-4 bg-[#4F46E5] text-white rounded-xl text-lg font-medium 
                     shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 
                     hover:translate-y-[-2px] transition-all duration-200"
          >
            Create Lobby
          </button>
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="px-8 py-4 bg-[#F97066] text-white rounded-xl text-lg font-medium 
                     shadow-lg shadow-[#F97066]/25 hover:shadow-[#F97066]/40 
                     hover:translate-y-[-2px] transition-all duration-200"
          >
            Join Lobby
          </button>
        </div>

        {/* Visual flair */}
        <div className="absolute bottom-8 text-center text-slate-400 text-sm">
          Ready to play? Create or join a lobby to get started!
        </div>
      </div>

      {/* Create Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#1E293B]">
                Create a Lobby
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label
                  htmlFor="createName"
                  className="block text-sm font-medium text-slate-600 mb-2"
                >
                  Your Name
                </label>
                <input
                  id="createName"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 
                           focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#4F46E5] text-white rounded-lg
                         hover:bg-[#4F46E5]/90 transition-colors duration-200"
              >
                Create Lobby
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-[#1E293B]">
                Join a Lobby
              </h2>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleJoin}>
              <div className="mb-4">
                <label
                  htmlFor="lobbyCode"
                  className="block text-sm font-medium text-slate-600 mb-2"
                >
                  Lobby Code
                </label>
                <input
                  id="lobbyCode"
                  type="text"
                  value={lobbyCode}
                  onChange={(e) => setLobbyCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 
                           focus:outline-none focus:ring-2 focus:ring-[#F97066] focus:border-transparent"
                  required
                  maxLength={6}
                />
              </div>
              <div className="mb-4">
                <label
                  htmlFor="joinName"
                  className="block text-sm font-medium text-slate-600 mb-2"
                >
                  Your Name
                </label>
                <input
                  id="joinName"
                  type="text"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 
                           focus:outline-none focus:ring-2 focus:ring-[#F97066] focus:border-transparent"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-2 bg-[#F97066] text-white rounded-lg
                         hover:bg-[#F97066]/90 transition-colors duration-200"
              >
                Join Lobby
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
