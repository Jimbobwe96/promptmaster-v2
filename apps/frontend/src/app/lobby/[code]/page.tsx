"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import type { Lobby } from "@promptmaster/shared";
import type { LobbySessionData } from "@/types/lobby";

// We'll create these components next
import { PlayerList } from "./components/PlayerList";
import { ShareCode } from "./components/ShareCode";
import { HostControls } from "./components/HostControls";
import { LobbySettings } from "./components/LobbySettings";

export default function LobbyPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const { socket, connect, emit } = useSocket();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check for session data on mount
  useEffect(() => {
    const sessionData = sessionStorage.getItem(`lobby:${params.code}`);
    if (!sessionData) {
      router.replace("/"); // Redirect to home if no session
      return;
    }

    const session: LobbySessionData = JSON.parse(sessionData);

    const initializeSocket = async () => {
      try {
        await connect();
        // Rejoin lobby with stored session data
        emit("lobby:join", params.code, session.username);
      } catch (err) {
        setError("Failed to connect to server");
        setIsLoading(false);
      }
    };

    initializeSocket();
  }, [params.code, router, connect, emit]);

  // Handle socket events
  useEffect(() => {
    if (!socket) return;

    const handleLobbyUpdate = (updatedLobby: Lobby) => {
      setLobby(updatedLobby);
      setIsLoading(false);
    };

    const handleError = (error: { message: string }) => {
      setError(error.message);
      setIsLoading(false);
    };

    socket.on("lobby:updated", handleLobbyUpdate);
    socket.on("lobby:error", handleError);

    return () => {
      socket.off("lobby:updated", handleLobbyUpdate);
      socket.off("lobby:error", handleError);
    };
  }, [socket]);

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

  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFBFF] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-500 mb-4">⚠️</div>
          <p className="text-slate-600 mb-4">{error}</p>
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
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#4F46E5] opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#F97066] opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-[1fr,300px]">
          {/* Main content */}
          <div className="space-y-8">
            <ShareCode code={lobby.code} />
            <PlayerList players={lobby.players} hostId={lobby.hostId} />
            {lobby.hostId === socket?.id && (
              <HostControls
                canStart={lobby.players.length >= 2}
                onStart={() => emit("lobby:start_game")}
              />
            )}
          </div>

          {/* Sidebar */}
          <div>
            <LobbySettings
              settings={lobby.settings}
              isHost={lobby.hostId === socket?.id}
              onUpdate={(settings) => emit("lobby:update_settings", settings)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
