import { SessionData } from '@promptmaster/shared';

export const useSessionManager = () => {
  /**
   * Saves a session to storage
   */
  const saveSession = (
    lobbyCode: string,
    username: string,
    socketID: string = ''
  ): void => {
    const session: SessionData = {
      lobbyCode,
      username,
      socketID,
      joinedAt: new Date().toISOString()
    };

    sessionStorage.setItem(`lobby:${lobbyCode}`, JSON.stringify(session));
  };

  /**
   * Gets a session by lobby code
   */
  const getSession = (lobbyCode: string): SessionData | null => {
    try {
      const data = sessionStorage.getItem(`lobby:${lobbyCode}`);
      if (!data) return null;

      const session = JSON.parse(data) as SessionData;
      return session;
    } catch (error) {
      console.error('Error parsing session data:', error);
      return null;
    }
  };

  /**
   * Updates a session's socketID
   */
  const updateSessionSocketId = (lobbyCode: string, socketID: string): void => {
    const session = getSession(lobbyCode);
    if (session) {
      session.socketID = socketID;
      sessionStorage.setItem(`lobby:${lobbyCode}`, JSON.stringify(session));
    }
  };

  /**
   * Clears a session from storage
   */
  const clearSession = (lobbyCode: string): void => {
    sessionStorage.removeItem(`lobby:${lobbyCode}`);
  };

  /**
   * Gets all active sessions
   */
  const getActiveSessions = (): SessionData[] => {
    const sessions: SessionData[] = [];

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('lobby:')) {
        try {
          const lobbyCode = key.replace('lobby:', '');
          const session = getSession(lobbyCode);
          if (session) {
            sessions.push(session);
          }
        } catch (error) {
          console.error('Error parsing session data:', error);
        }
      }
    }

    return sessions;
  };

  /**
   * Validates all sessions against the backend
   */
  const validateSessions = async (): Promise<SessionData[]> => {
    const sessions = getActiveSessions();
    const validSessions: SessionData[] = [];

    for (const session of sessions) {
      try {
        const queryParams = new URLSearchParams({
          lobbyCode: session.lobbyCode,
          username: session.username,
          socketID: session.socketID || ''
        });

        const response = await fetch(`/api/sessions/validate?${queryParams}`);

        if (!response.ok) {
          console.error('Session validation failed:', await response.text());
          continue;
        }

        const validation = await response.json();

        if (validation.canReconnect) {
          validSessions.push(session);
        } else {
          // If we can't reconnect, clean up the session
          clearSession(session.lobbyCode);
        }
      } catch (error) {
        console.error('Error validating session:', error);
      }
    }

    return validSessions;
  };

  return {
    saveSession,
    getSession,
    updateSessionSocketId,
    clearSession,
    getActiveSessions,
    validateSessions
  };
};
