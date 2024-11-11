"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import type { Lobby, LobbySession } from "@promptmaster/shared";
import { PlayerList } from "./components/PlayerList";
import { ShareCode } from "./components/ShareCode";
import { LobbySettings } from "./components/LobbySettings";

interface LobbyPageProps {
  params: Promise<{
    code: string;
  }>;
}

export default function LobbyPage({ params }: LobbyPageProps) {
  const { code } = use(params); // Properly unwrap the params promise
  const router = useRouter();
  const { connect, disconnect, validateLobby, error, socket, emit, on } =
    useSocket();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeLobby = async () => {
      try {
        // Get session data
        const sessionData = sessionStorage.getItem(`lobby:${code}`);
        if (!sessionData) {
          throw new Error("No session data found");
        }

        const session: LobbySession = JSON.parse(sessionData);

        // Establish socket connection
        await connect();

        if (!mounted) return;

        // Validate lobby membership
        const lobbyData = await validateLobby(code, session.username);

        if (!mounted) return;

        setLobby(lobbyData);
        setIsLoading(false);
        setConnectionError(null);

        // Set up lobby update listener
        on("lobby:updated", (updatedLobby) => {
          if (mounted) {
            setLobby(updatedLobby);
          }
        });
      } catch (err) {
        if (!mounted) return;

        console.error("Lobby initialization error:", err);

        if (err instanceof Error) {
          setConnectionError(err.message);
        } else {
          setConnectionError("Failed to join lobby");
        }

        setIsLoading(false);

        // If no session or invalid, redirect to home
        if (err instanceof Error && err.message === "No session data found") {
          router.replace("/");
        }
      }
    };

    initializeLobby();

    return () => {
      mounted = false;
      disconnect();
    };
  }, [code, connect, disconnect, validateLobby, router, on]);

  const handleKickPlayer = (playerId: string) => {
    emit("lobby:kick_player", playerId);
  };

  const handleLeaveLobby = () => {
    try {
      emit("lobby:leave");

      // Remove session data
      sessionStorage.removeItem(`lobby:${code}`);

      // Set up one-time listener for leave confirmation
      on("lobby:left", () => {
        router.push("/");
      });
    } catch (error) {
      console.error("Error leaving lobby:", error);
      setConnectionError("Failed to leave lobby");
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full mb-4" />
          <p className="text-slate-600">Connecting to lobby...</p>
        </div>
      </div>
    );
  }

  // Show error state
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

  if (!lobby) return null;

  return (
    <main className="min-h-screen bg-[#FAFBFF] relative overflow-hidden">
      {/* Keep your existing decorative circles */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#4F46E5] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F97066] opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="text-center pt-8">
        <h1 className="text-5xl font-bold text-slate-800">
          Prompt<span className="text-[#4F46E5]">master</span>
        </h1>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[1fr,300px]">
          <div className="space-y-8">
            <ShareCode code={lobby.code} />
            <PlayerList
              players={lobby.players}
              hostId={lobby.hostId}
              currentUserId={socket?.id ?? ""}
              isHost={lobby.hostId === socket?.id}
              onKickPlayer={handleKickPlayer}
            />
          </div>

          <div>
            <LobbySettings
              settings={lobby.settings}
              isHost={lobby.hostId === socket?.id}
              canStart={lobby.players.filter((p) => p.connected).length >= 2}
              onStart={() => emit("lobby:start_game")}
              onUpdate={(settings) => emit("lobby:update_settings", settings)}
              onLeave={handleLeaveLobby}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
