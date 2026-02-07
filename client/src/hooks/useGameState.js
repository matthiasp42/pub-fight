import { useState, useEffect, useRef, useCallback } from 'react';
import { api, GameNotFoundError } from '../api/client';

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
        try {
          await api.restore(localStateRef.current);
        } catch (restoreErr) {
          if (restoreErr instanceof GameNotFoundError) {
            setSyncStatus('game_not_found');
            return;
          }
          throw restoreErr;
        }
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
      if (err instanceof GameNotFoundError) {
        // Game was deleted or server restarted without it
        // Try restore if we have cached state
        if (localStateRef.current) {
          try {
            await api.restore(localStateRef.current);
            setSyncStatus('synced');
            return;
          } catch (restoreErr) {
            // Restore also failed, game is truly gone
          }
        }
        setSyncStatus('game_not_found');
        return;
      }
      console.error('Fetch error:', err);
      setSyncStatus('disconnected');
      setError(err.message);
    }
  }, []);

  const [pollingActive, setPollingActive] = useState(false);
  const wantPollingRef = useRef(false);

  const startPolling = useCallback(() => {
    wantPollingRef.current = true;
    if (pollingRef.current) clearInterval(pollingRef.current);
    fetchState();
    pollingRef.current = setInterval(fetchState, POLL_INTERVAL);
    setPollingActive(true);
  }, [fetchState]);

  const stopPolling = useCallback(() => {
    wantPollingRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPollingActive(false);
  }, []);

  // Pause polling when tab is hidden, resume when visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          setPollingActive(false);
        }
      } else if (wantPollingRef.current) {
        fetchState();
        pollingRef.current = setInterval(fetchState, POLL_INTERVAL);
        setPollingActive(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchState]);

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

  const resetState = useCallback(() => {
    localStateRef.current = null;
    setGameState(null);
    setSyncStatus('connecting');
    setError(null);
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
    pollingActive,
    error,
    startPolling,
    stopPolling,
    fetchState,
    updateLocalState,
    getMyPlayer,
    resetState,
  };
}
