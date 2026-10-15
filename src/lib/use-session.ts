'use client';

import { useState, useEffect } from 'react';
import { getSession, type Session } from './auth-client';

export function useSession() {
  const [session, setSession] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let mounted = true;
    getSession()
      .then((s) => {
        if (!mounted) return;
        setSession(s);
        setError(false);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [attempt]);

  const retry = () => {
    setLoading(true);
    setError(false);
    setAttempt((current) => current + 1);
  };

  return { session, loading, error, retry };
}
