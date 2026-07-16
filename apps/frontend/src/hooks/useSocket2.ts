/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents2, ServerToClientEvents2, Lobby2, LobbyError } from '@promptmaster/shared';

type SocketType = Socket<ServerToClientEvents2, ClientToServerEvents2>;

// Global socket instance
let globalSocket: SocketType | null = null;

interface UseSocket2Props {
  url?: string;
  autoConnect?: boolean;
}

interface UseSocket2Return {
  socket: SocketType | null;
  isConnected: boolean;
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  validateLobby: (code: string, username: string) => Promise<Lobby2>;
  emit: <Event extends keyof ClientToServerEvents2>(
    event: Event,
    ...args: Parameters<ClientToServerEvents2[Event]>
  ) => void;
  on: <Event extends keyof ServerToClientEvents2>(
    event: Event,
    callback: Parameters<ServerToClientEvents2[Event]> extends []
      ? () => void
      : (...args: Parameters<ServerToClientEvents2[Event]>) => void
  ) => void;
  off: <Event extends keyof ServerToClientEvents2>(
    event: Event,
    callback?: Parameters<ServerToClientEvents2[Event]> extends []
      ? () => void
      : (...args: Parameters<ServerToClientEvents2[Event]>) => void
  ) => void;
}

export const useSocket2 = ({
  url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000',
  autoConnect = false
}: UseSocket2Props = {}): UseSocket2Return => {
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
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
          });
        }

        globalSocket.on('connect', () => {
          console.log('Socket connected successfully');
          setIsConnected(true);
          setError(null);
          resolve();
        });

        globalSocket.on('connect_error', (err) => {
          console.error('Socket connection error:', err);
          setError(err);
          setIsConnected(false);
          reject(err);
        });

        globalSocket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          setIsConnected(false);
          if (reason === 'io server disconnect') {
            globalSocket?.connect();
          }
        });

        // Note: `lobby:kicked` is handled per-page (lobby page), not here — registering it
        // inside connect() is unreliable because the early-return path above skips it and
        // removeAllListeners() on cleanup wipes it.

        // If socket exists but isn't connected, try to connect
        if (!globalSocket.connected) {
          globalSocket.connect();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to connect to socket');
        console.error('Socket initialization error:', error);
        setError(error);
        reject(error);
      }
    });
  }, [url]);

  const validateLobby = useCallback((code: string, username: string) => {
    return new Promise<Lobby2>((resolve, reject) => {
      if (!globalSocket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      const handleValidated = (lobby: Lobby2) => {
        resolve(lobby);
      };

      const handleError = (error: LobbyError) => {
        reject(new Error(error.message));
      };

      globalSocket.once('lobby:validated', handleValidated);
      globalSocket.once('lobby:error', handleError);

      globalSocket.emit('lobby:validate', { code, username });

      setTimeout(() => {
        globalSocket?.off('lobby:validated', handleValidated);
        globalSocket?.off('lobby:error', handleError);
        reject(new Error('Validation timeout'));
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
    <Event extends keyof ClientToServerEvents2>(event: Event, ...args: Parameters<ClientToServerEvents2[Event]>) => {
      if (!globalSocket?.connected) {
        throw new Error('Socket not connected');
      }
      globalSocket.emit(event, ...args);
    },
    []
  );

  const on = useCallback(
    <Event extends keyof ServerToClientEvents2>(
      event: Event,
      callback: Parameters<ServerToClientEvents2[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents2[Event]>) => void
    ) => {
      globalSocket?.on(event, callback as any);
    },
    []
  );

  const off = useCallback(
    <Event extends keyof ServerToClientEvents2>(
      event: Event,
      callback?: Parameters<ServerToClientEvents2[Event]> extends []
        ? () => void
        : (...args: Parameters<ServerToClientEvents2[Event]>) => void
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
    off
  };
};
