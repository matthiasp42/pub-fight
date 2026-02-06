import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

const POLL_INTERVAL = 2000;
const STATE_CACHE_KEY = 'pubfight_gameState';

export function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const localStateRef = useRef(null);
  const pollingRef = useRef(null);

  // Load cached state on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STATE_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        localStateRef.current = parsed;
        setGameState(parsed);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const serverState = await api.getState();

      if (localStateRef.current && serverState.version < localStateRef.current.version) {
        // Server restarted - push our state
        console.log('Server behind, restoring state...');
        setSyncStatus('restoring');
        await api.restore(localStateRef.current);
        setSyncStatus('synced');
      } else {
        // Server has same or newer - update local
        localStateRef.current = serverState;
        setGameState(serverState);
        setSyncStatus('synced');

        // Cache to localStorage
        try {
          localStorage.setItem(STATE_CACHE_KEY, JSON.stringify(serverState));
        } catch (e) {
          // ignore storage errors
        }
      }
      setError(null);
    } catch (err) {
      console.error('Fetch error:', err);
      setSyncStatus('disconnected');
      setError(err.message);
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    fetchState();
    pollingRef.current = setInterval(fetchState, POLL_INTERVAL);
  }, [fetchState]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const updateLocalState = useCallback((updater) => {
    setGameState(prev => {
      const newState = updater(prev);
      localStateRef.current = newState;
      return newState;
    });
  }, []);

  // Helper to find which player this session controls
  const getMyPlayer = useCallback(() => {
    if (!gameState?.players) return null;
    const sessionId = localStorage.getItem('sessionId');
    return Object.values(gameState.players).find(p => p.controlledBy === sessionId) || null;
  }, [gameState]);

  return {
    gameState,
    syncStatus,
    error,
    startPolling,
    stopPolling,
    fetchState,
    updateLocalState,
    getMyPlayer,
  };
}
