import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api/client';

const POLL_INTERVAL = 2000;

export function useGameState() {
  const [gameState, setGameState] = useState(null);
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [error, setError] = useState(null);
  const localStateRef = useRef(null);
  const pollingRef = useRef(null);

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

  return {
    gameState,
    syncStatus,
    error,
    startPolling,
    stopPolling,
    fetchState,
    updateLocalState
  };
}
