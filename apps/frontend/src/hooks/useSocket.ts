import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export const useSocket = () => {
  const socket = useRef<Socket | null>(null);

  useEffect(() => {
    console.log("Initializing socket connection...");
    console.log("API URL:", process.env.NEXT_PUBLIC_BACKEND_URL);

    socket.current = io(
      process.env.NEXT_PUBLIC_BACKEND_URL!.replace("backend", "localhost"),
      {
        transports: ["websocket"],
        autoConnect: true,
      }
    );

    socket.current.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });

    socket.current.on("connect", () => {
      console.log("Connected to server");
      socket.current?.emit("ping");
    });

    socket.current.on("pong", () => {
      console.log("Received pong from server");
    });

    socket.current.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    return () => {
      console.log("Cleaning up socket connection...");
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, []);

  return socket.current;
};
