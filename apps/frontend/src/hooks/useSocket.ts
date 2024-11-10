import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Lobby,
} from "@promptmaster/shared";

type SocketType = Socket<ServerToClientEvents, ClientToServerEvents>;

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
      : (...args: Parameters<ServerToClientEvents[Event]>) => void,
  ) => void;
  off: <Event extends keyof ServerToClientEvents>(
    event: Event,
    callback?: Parameters<ServerToClientEvents[Event]> extends []
      ? () => void
      : (...args: Parameters<ServerToClientEvents[Event]>) => void,
  ) => void;
}

export const useSocket = ({
  url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000",
  autoConnect = false,
}: UseSocketProps = {}): UseSocketReturn => {
  const router = useRouter();
  const socketRef = useRef<SocketType | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (socketRef.current?.connected) {
        resolve();
        return;
      }

      try {
        socketRef.current = io(url, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketRef.current.on("connect", () => {
          console.log("Socket connected successfully");
          setIsConnected(true);
          setError(null);
          resolve();
        });

        socketRef.current.on("connect_error", (err) => {
          console.error("Socket connection error:", err);
          setError(err);
          setIsConnected(false);
          reject(err);
        });

        socketRef.current.on("disconnect", (reason) => {
          console.log("Socket disconnected:", reason);
          setIsConnected(false);
          if (reason === "io server disconnect") {
            socketRef.current?.connect();
          }
        });

        socketRef.current.on("lobby:kicked", () => {
          console.log("You have been kicked from the lobby");
          const code = window.location.pathname.split("/").pop();
          if (code) {
            sessionStorage.removeItem(`lobby:${code}`);
          }
          router.push("/");
        });
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
      if (!socketRef.current?.connected) {
        reject(new Error("Socket not connected"));
        return;
      }

      const handleValidated = (lobby: Lobby) => {
        resolve(lobby);
      };

      const handleError = (error: { message: string }) => {
        reject(new Error(error.message));
      };

      socketRef.current.once("lobby:validated", handleValidated);
      socketRef.current.once("lobby:error", handleError);

      socketRef.current.emit("lobby:validate", { code, username });

      setTimeout(() => {
        socketRef.current?.off("lobby:validated", handleValidated);
        socketRef.current?.off("lobby:error", handleError);
        reject(new Error("Validation timeout"));
      }, 10000);
    });
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const emit = useCallback(
    <Event extends keyof ClientToServerEvents>(
      event: Event,
      ...args: Parameters<ClientToServerEvents[Event]>
    ) => {
      if (!socketRef.current?.connected) {
        throw new Error("Socket not connected");
      }
      socketRef.current.emit(event, ...args);
    },
    [],
  );

  const on = useCallback(
    <Event extends keyof ServerToClientEvents>(
      event: Event,
      callback: Parameters<ServerToClientEvents[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents[Event]>) => void,
    ) => {
      socketRef.current?.on(event, callback as any);
    },
    [],
  );

  const off = useCallback(
    <Event extends keyof ServerToClientEvents>(
      event: Event,
      callback?: Parameters<ServerToClientEvents[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents[Event]>) => void,
    ) => {
      if (callback) {
        socketRef.current?.off(event, callback as any);
      } else {
        socketRef.current?.off(event);
      }
    },
    [],
  );

  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off("lobby:kicked");
      }
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
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
