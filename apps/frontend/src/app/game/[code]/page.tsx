"use client";

import React, { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import type {
  GameState,
  LobbySession,
  RoundStatus,
} from "@promptmaster/shared";
import { PromptingPhase } from "./components/PromptingPhase/PromptingPhase";

interface GamePageProps {
  params: Promise<{
    code: string;
  }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { code } = use(params);
  const router = useRouter();
  const { socket, connect, disconnect, error, validateLobby, emit } =
    useSocket();

  const [isLoading, setIsLoading] = useState(true);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lobbySettings, setLobbySettings] = useState<{ timeLimit: number }>({
    timeLimit: 30,
  });

  // Keep track of current player's ID
  const [currentPlayerId, setCurrentPlayerId] = useState<string>("");

  useEffect(() => {
    let mounted = true;

    // const initializeGame = async () => {
    //   try {
    //     // Get session data
    //     const sessionData = sessionStorage.getItem(`lobby:${code}`);
    //     if (!sessionData) {
    //       throw new Error("No session data found");
    //     }

    //     const session: LobbySession = JSON.parse(sessionData);

    //     // Establish socket connection
    //     await connect();

    //     if (!mounted) return;

    //     // if (socket?.id) {
    //     //   setCurrentPlayerId(socket.id);
    //     // }
    //     if (socket) {
    //       setCurrentPlayerId(socket.id || ""); // Provide default empty string
    //     }

    //     // Validate lobby membership
    //     const lobby = await validateLobby(code, session.username);

    //     // Store lobby settings
    //     setLobbySettings({
    //       timeLimit: lobby.settings.timeLimit,
    //     });

    //     socket?.on("game:started", (initialState: GameState) => {
    //       console.log("Received game:started event with state:", initialState);
    //       if (mounted) setGameState(initialState);
    //     });

    //     socket?.on("game:round_started", (round) => {
    //       if (!mounted || !gameState) return;
    //       setGameState((prev) =>
    //         prev
    //           ? {
    //               ...prev,
    //               rounds: [...prev.rounds, round],
    //             }
    //           : null
    //       );
    //     });

    //     socket?.on("game:prompt_submitted", (prompterId) => {
    //       if (!mounted || !gameState) return;
    //       const currentRound = gameState.rounds[gameState.rounds.length - 1];
    //       if (currentRound) {
    //         currentRound.status = "generating";
    //         setGameState({ ...gameState });
    //       }
    //     });

    //     // ... other socket listeners remain the same ...

    //     setIsLoading(false);
    //     setConnectionError(null);
    //   } catch (err) {
    //     if (!mounted) return;
    //     console.error("Game initialization error:", err);
    //     if (err instanceof Error) {
    //       setConnectionError(err.message);
    //     } else {
    //       setConnectionError("Failed to join game");
    //     }
    //     setIsLoading(false);
    //     if (err instanceof Error && err.message === "No session data found") {
    //       router.replace("/");
    //     }
    //   }
    // };

    const initializeGame = async () => {
      try {
        // Get session data
        const sessionData = sessionStorage.getItem(`lobby:${code}`);
        if (!sessionData) {
          throw new Error("No session data found");
        }

        const session: LobbySession = JSON.parse(sessionData);

        // Get initial game state if it exists
        const initialGameState = sessionStorage.getItem(`game:${code}:state`);
        if (initialGameState) {
          setGameState(JSON.parse(initialGameState));
          // Clean up
          sessionStorage.removeItem(`game:${code}:state`);
        }

        // Establish socket connection
        await connect();

        if (!mounted) return;

        // if (socket?.id) {
        //   setCurrentPlayerId(socket.id);
        // }
        if (socket) {
          setCurrentPlayerId(socket.id || ""); // Provide default empty string
        }

        // Validate lobby membership
        const lobby = await validateLobby(code, session.username);

        // Store lobby settings
        setLobbySettings({
          timeLimit: lobby.settings.timeLimit,
        });

        socket?.on("game:started", (initialState: GameState) => {
          console.log("Received game:started event with state:", initialState);
          if (mounted) setGameState(initialState);
        });

        socket?.on("game:round_started", (round) => {
          if (!mounted || !gameState) return;
          setGameState((prev) =>
            prev
              ? {
                  ...prev,
                  rounds: [...prev.rounds, round],
                }
              : null
          );
        });

        socket?.on("game:prompt_submitted", (prompterId) => {
          if (!mounted || !gameState) return;
          const currentRound = gameState.rounds[gameState.rounds.length - 1];
          if (currentRound) {
            currentRound.status = "generating";
            setGameState({ ...gameState });
          }
        });

        // ... other socket listeners remain the same ...

        setIsLoading(false);
        setConnectionError(null);
      } catch (err) {
        if (!mounted) return;
        console.error("Game initialization error:", err);
        if (err instanceof Error) {
          setConnectionError(err.message);
        } else {
          setConnectionError("Failed to join game");
        }
        setIsLoading(false);
        if (err instanceof Error && err.message === "No session data found") {
          router.replace("/");
        }
      }
    };

    initializeGame();

    return () => {
      mounted = false;
      if (socket) {
        socket.off("game:started");
        socket.off("game:round_started");
        socket.off("game:prompt_submitted");
        socket.off("game:guessing_started");
        socket.off("game:scoring_started");
        socket.off("game:results");
        socket.off("game:ended");
      }
      disconnect();
    };
  }, [code, connect, disconnect, validateLobby, router, socket, gameState]);

  // Handle prompt draft changes
  const handleDraftChange = (draft: string) => {
    emit("game:prompt_draft_changed", currentPlayerId, draft);
  };

  // Handle prompt submission
  const handlePromptSubmit = (prompt: string) => {
    emit("game:submit_prompt", prompt);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full mb-4" />
          <p className="text-slate-600">Joining game...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (connectionError || error) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 mb-4">⚠️</div>
          <p className="text-slate-600 mb-4">
            {connectionError || error?.message}
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-[#4F46E5] text-white rounded-lg hover:bg-[#4F46E5]/90 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    console.log("No game state available");
    return null;
  }

  // Get current round
  const currentRound = gameState.rounds[gameState.rounds.length - 1];
  console.log("Current game state:", gameState);
  console.log("Current round:", currentRound);

  if (!currentRound) {
    console.log("No current round");
    return null;
  }

  // Render appropriate phase component based on current round status
  return (
    <main className="min-h-screen bg-[#FAFBFF] relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#4F46E5] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F97066] opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Game header with round info */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">
            Round {gameState.rounds.length}
          </h1>
          <p className="text-slate-600">
            {currentRound.status === "prompting" && "Waiting for prompt..."}
            {currentRound.status === "generating" && "Generating image..."}
            {currentRound.status === "guessing" && "Time to guess!"}
            {currentRound.status === "scoring" && "Scoring guesses..."}
            {currentRound.status === "results" && "Round results"}
          </p>
        </div>

        {/* Phase-specific components */}
        {currentRound.status === "prompting" && (
          <PromptingPhase
            round={currentRound}
            timeLimit={lobbySettings.timeLimit}
            currentPlayerId={currentPlayerId}
            onPromptSubmit={handlePromptSubmit}
            onDraftChange={handleDraftChange}
          />
        )}

        {/* Add other phase components here as we implement them */}

        {/* Game progress/scores */}
        <div className="mt-8">{/* TODO: Add PlayerScores component */}</div>
      </div>
    </main>
  );
}
