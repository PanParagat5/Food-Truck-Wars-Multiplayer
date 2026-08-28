import { useState, useCallback } from 'react';
import type { GameSession } from '@workspace/api-client-react';

export function useGameSession(code?: string) {
  const getSession = useCallback(() => {
    if (!code) return null;
    try {
      const stored = localStorage.getItem(`foodtruck-session-${code}`);
      return stored ? JSON.parse(stored) as GameSession : null;
    } catch {
      return null;
    }
  }, [code]);

  const [session, setSessionState] = useState<GameSession | null>(getSession);

  const saveSession = useCallback((newSession: GameSession) => {
    localStorage.setItem(`foodtruck-session-${newSession.code}`, JSON.stringify(newSession));
    setSessionState(newSession);
  }, []);

  return { session, saveSession };
}
