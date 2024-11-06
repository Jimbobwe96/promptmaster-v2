import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@promptmaster/shared/src/types/game";

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
          autoConnect: false,
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
        });

        socketRef.current.on("connect", () => {
          setIsConnected(true);
          setError(null);
          resolve(); // Resolve when actually connected
        });

        socketRef.current.on("connect_error", (err) => {
          setError(err);
          setIsConnected(false);
          reject(err); // Reject on connection error
        });

        socketRef.current.on("disconnect", (reason) => {
          setIsConnected(false);
          if (reason === "io server disconnect") {
            socketRef.current?.connect();
          }
        });

        socketRef.current.connect();
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to connect to socket");
        setError(error);
        reject(error);
      }
    });
  }, [url]);

  // Disconnect socket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Emit wrapper with type safety
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
    []
  );

  // On wrapper with type safety
  const on = useCallback(
    <Event extends keyof ServerToClientEvents>(
      event: Event,
      callback: Parameters<ServerToClientEvents[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents[Event]>) => void
    ) => {
      socketRef.current?.on(event, callback as any);
    },
    []
  );

  // Off wrapper with type safety
  const off = useCallback(
    <Event extends keyof ServerToClientEvents>(
      event: Event,
      callback?: Parameters<ServerToClientEvents[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents[Event]>) => void
    ) => {
      if (callback) {
        socketRef.current?.off(event, callback as any);
      } else {
        socketRef.current?.off(event);
      }
    },
    []
  );

  // Clean up on unmount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
};

// import { useEffect, useRef } from "react";
// import { io, Socket } from "socket.io-client";

// export const useSocket = () => {
//   const socket = useRef<Socket | null>(null);

//   useEffect(() => {
//     console.log("Initializing socket connection...");
//     console.log("API URL:", process.env.NEXT_PUBLIC_BACKEND_URL);

//     socket.current = io(
//       process.env.NEXT_PUBLIC_BACKEND_URL!.replace("backend", "localhost"),
//       {
//         transports: ["websocket"],
//         autoConnect: true,
//       }
//     );

//     socket.current.on("connect_error", (err) => {
//       console.error("Connection error:", err.message);
//     });

//     socket.current.on("connect", () => {
//       console.log("Connected to server");
//       socket.current?.emit("ping");
//     });

//     socket.current.on("pong", () => {
//       console.log("Received pong from server");
//     });

//     socket.current.on("disconnect", () => {
//       console.log("Disconnected from server");
//     });

//     return () => {
//       console.log("Cleaning up socket connection...");
//       if (socket.current) {
//         socket.current.disconnect();
//         socket.current = null;
//       }
//     };
//   }, []);

//   return socket.current;
// };
