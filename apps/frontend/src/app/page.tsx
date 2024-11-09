// "use client";

// import { useRouter } from "next/navigation";
// import { useState, useEffect } from "react";
// import { useSocket } from "@/hooks/useSocket";
// import type { LobbyError, Lobby } from "@promptmaster/shared";

// const CONNECTION_TIMEOUT = 10000; // 10 seconds

// export default function Home() {
//   const router = useRouter();
//   const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
//   const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
//   const [createName, setCreateName] = useState("");
//   const [joinName, setJoinName] = useState("");
//   const [lobbyCode, setLobbyCode] = useState("");
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const { connect, emit, socket } = useSocket();

//   // Handle socket events
//   useEffect(() => {
//     if (!socket) return;

//     const handleLobbyCreated = (lobby: Lobby) => {
//       // Store session data before redirect
//       sessionStorage.setItem(
//         `lobby:${lobby.code}`,
//         JSON.stringify({
//           username: createName.trim(),
//           isHost: true,
//           joinedAt: new Date().toISOString(),
//         })
//       );

//       setIsLoading(false);
//       setError(null);
//       router.push(`/lobby/${lobby.code}`);
//     };

//     const handleLobbyJoined = (lobby: Lobby) => {
//       // Store session data before redirect
//       sessionStorage.setItem(
//         `lobby:${lobby.code}`,
//         JSON.stringify({
//           username: joinName.trim(),
//           isHost: false,
//           joinedAt: new Date().toISOString(),
//         })
//       );

//       setIsLoading(false);
//       setError(null);
//       router.push(`/lobby/${lobby.code}`);
//     };

//     const handleError = (error: LobbyError) => {
//       setIsLoading(false);
//       setError(error.message);
//     };

//     socket.on("lobby:created", handleLobbyCreated);
//     socket.on("lobby:joined", handleLobbyJoined);
//     socket.on("lobby:error", handleError);

//     return () => {
//       socket.off("lobby:created", handleLobbyCreated);
//       socket.off("lobby:joined", handleLobbyJoined);
//       socket.off("lobby:error", handleError);
//     };
//   }, [router, socket, createName, joinName]);

//   const handleCreate = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!createName.trim()) return;

//     setIsLoading(true);
//     setError(null);

//     try {
//       // Set up connection timeout
//       const timeoutPromise = new Promise((_, reject) => {
//         setTimeout(
//           () => reject(new Error("Connection timed out. Please try again.")),
//           CONNECTION_TIMEOUT
//         );
//       });

//       // Try to connect with timeout
//       await Promise.race([connect(), timeoutPromise]);

//       // If we get here, connection was successful
//       emit("lobby:create", createName.trim());
//     } catch (err) {
//       setIsLoading(false);
//       setError(
//         err instanceof Error
//           ? err.message
//           : "Failed to connect to server. Please try again."
//       );
//       setIsCreateModalOpen(false);
//     }
//   };

//   const handleJoin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!joinName.trim() || !lobbyCode.trim()) return;

//     setIsLoading(true);
//     setError(null);

//     try {
//       // Set up connection timeout
//       const timeoutPromise = new Promise((_, reject) => {
//         setTimeout(
//           () => reject(new Error("Connection timed out. Please try again.")),
//           CONNECTION_TIMEOUT
//         );
//       });

//       // Try to connect with timeout
//       await Promise.race([connect(), timeoutPromise]);

//       // If we get here, connection was successful
//       emit("lobby:join", lobbyCode.trim(), joinName.trim());
//     } catch (err) {
//       setIsLoading(false);
//       setError(
//         err instanceof Error
//           ? err.message
//           : "Failed to connect to server. Please try again."
//       );
//       setIsJoinModalOpen(false);
//     }
//   };

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
// import type { LobbyError, Lobby } from "@promptmaster/shared";

// const CONNECTION_TIMEOUT = 10000; // 10 seconds

export default function Home() {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [lobbyCode, setLobbyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // REMOVED: socket-related code and effects

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting to create lobby...");
      const response = await fetch("http://localhost:4000/api/lobbies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: createName.trim() }),
      });
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);

      if (!response.ok) {
        const error = await response.json();
        console.error("Error response:", errorText);
        throw new Error(error.message || "Failed to create lobby");
      }

      const lobby = await response.json();

      // Store session data
      const session = {
        code: lobby.code,
        username: createName.trim(),
        isHost: true,
        joinedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(`lobby:${lobby.code}`, JSON.stringify(session));

      // Close modal before redirect
      setIsCreateModalOpen(false);
      router.push(`/lobby/${lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create lobby");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim() || !lobbyCode.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/lobbies/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: joinName.trim(),
          code: lobbyCode.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to join lobby");
      }

      const lobby = await response.json();

      // Store session data
      const session = {
        code: lobby.code,
        username: joinName.trim(),
        isHost: false,
        joinedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(`lobby:${lobby.code}`, JSON.stringify(session));

      // Close modal before redirect
      setIsJoinModalOpen(false);
      router.push(`/lobby/${lobby.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join lobby");
    } finally {
      setIsLoading(false);
    }
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
            onClick={() => {
              setError(null);
              setIsCreateModalOpen(true);
            }}
            className="px-8 py-4 bg-[#4F46E5] text-white rounded-xl text-lg font-medium 
                     shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 
                     hover:translate-y-[-2px] transition-all duration-200"
          >
            Create Lobby
          </button>
          <button
            onClick={() => {
              setError(null);
              setIsJoinModalOpen(true);
            }}
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
                disabled={isLoading}
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 text-[#1E293B]
                           focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent
                           disabled:bg-slate-50 disabled:text-slate-400"
                  required
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-[#4F46E5] text-white rounded-lg
                         hover:bg-[#4F46E5]/90 transition-colors duration-200
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
                    Connecting...
                  </>
                ) : (
                  "Create Lobby"
                )}
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
                disabled={isLoading}
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 text-[#1E293B]
                           focus:outline-none focus:ring-2 focus:ring-[#F97066] focus:border-transparent
                           disabled:bg-slate-50 disabled:text-slate-400"
                  required
                  maxLength={6}
                  disabled={isLoading}
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
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 text-[#1E293B]
                           focus:outline-none focus:ring-2 focus:ring-[#F97066] focus:border-transparent
                           disabled:bg-slate-50 disabled:text-slate-400"
                  required
                  disabled={isLoading}
                />
              </div>
              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-2 bg-[#F97066] text-white rounded-lg
                         hover:bg-[#F97066]/90 transition-colors duration-200
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
                    Connecting...
                  </>
                ) : (
                  "Join Lobby"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
