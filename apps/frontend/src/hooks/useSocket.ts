import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Lobby,
} from "@promptmaster/shared";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

// Global socket instance
let globalSocket: SocketType | null = null;

interface UseSocketProps {
  url?: string;
  autoConnect?: boolean;
}

interface UseSocketReturn {
  socket: SocketType | null;
  isConnected: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  validateLobby: (code: string, username: string) => Promise<Lobby>;
  emit: <Event extends keyof ClientToServerEvents>(
    event: Event,
    ...args: Parameters<ClientToServerEvents[Event]>
  ) => void;
  on: <Event extends keyof ServerToClientEvents>(
    event: Event,
    callback: Parameters<ServerToClientEvents[Event]> extends []
      ? () => void
      : (...args: Parameters<ServerToClientEvents[Event]>) => void
  ) => void;
  off: <Event extends keyof ServerToClientEvents>(
    event: Event,
    callback?: Parameters<ServerToClientEvents[Event]> extends []
      ? () => void
      : (...args: Parameters<ServerToClientEvents[Event]>) => void
  ) => void;
}

export const useSocket = ({
  url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
  autoConnect = false,
}: UseSocketProps = {}): UseSocketReturn => {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      // If we already have a connected socket, use it
      if (globalSocket?.connected) {
        setIsConnected(true);
        setError(null);
        resolve();
        return;
      }

      try {
        // Only create a new socket if we don't have one
        if (!globalSocket) {
          globalSocket = io(url, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
          });
        }

        globalSocket.on("connect", () => {
          console.log("Socket connected successfully");
          setIsConnected(true);
          setError(null);
          resolve();
        });

        globalSocket.on("connect_error", (err) => {
          console.error("Socket connection error:", err);
          setError(err);
          setIsConnected(false);
          reject(err);
        });

        globalSocket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          setIsConnected(false);
          if (reason === "io server disconnect") {
            globalSocket?.connect();
          }
        });

        globalSocket.on("lobby:kicked", () => {
          console.log("You have been kicked from the lobby");
          const code = window.location.pathname.split("/").pop();
          if (code) {
            sessionStorage.removeItem(`lobby:${code}`);
          }
          router.push("/");
        });

        // If socket exists but isn't connected, try to connect
        if (!globalSocket.connected) {
          globalSocket.connect();
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to connect to socket");
        console.error("Socket initialization error:", error);
        setError(error);
        reject(error);
      }
    });
  }, [url, router]);

  const validateLobby = useCallback((code: string, username: string) => {
    return new Promise<Lobby>((resolve, reject) => {
      if (!globalSocket?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      const handleValidated = (lobby: Lobby) => {
        resolve(lobby);
      };

      const handleError = (error: { message: string }) => {
        reject(new Error(error.message));
      };

      globalSocket.once("lobby:validated", handleValidated);
      globalSocket.once("lobby:error", handleError);

      globalSocket.emit("lobby:validate", { code, username });

      setTimeout(() => {
        globalSocket?.off("lobby:validated", handleValidated);
        globalSocket?.off("lobby:error", handleError);
        reject(new Error("Validation timeout"));
      }, 10000);
    });
  }, []);

  const disconnect = useCallback(() => {
    // Instead of disconnecting, we just remove listeners
    if (globalSocket) {
      globalSocket.removeAllListeners();
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback(
    <Event extends keyof ClientToServerEvents>(
      event: Event,
      ...args: Parameters<ClientToServerEvents[Event]>
    ) => {
      if (!globalSocket?.connected) {
        throw new Error("Socket not connected");
      }
      globalSocket.emit(event, ...args);
    },
    []
  );

  const on = useCallback(
    <Event extends keyof ServerToClientEvents>(
      event: Event,
      callback: Parameters<ServerToClientEvents[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents[Event]>) => void
    ) => {
      globalSocket?.on(event, callback as any);
    },
    []
  );

  const off = useCallback(
    <Event extends keyof ServerToClientEvents>(
      event: Event,
      callback?: Parameters<ServerToClientEvents[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents[Event]>) => void
    ) => {
      if (callback) {
        globalSocket?.off(event, callback as any);
      } else {
        globalSocket?.off(event);
      }
    },
    []
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      // Don't actually disconnect, just clean up listeners
      if (globalSocket) {
        globalSocket.removeAllListeners();
      }
    };
  }, [autoConnect, connect]);

  return {
    socket: globalSocket,
    isConnected,
    error,
    connect,
    disconnect,
    validateLobby,
    emit,
    on,
    off,
  };
};
