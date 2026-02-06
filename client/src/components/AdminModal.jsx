import { useState, useCallback } from 'react';
import { api } from '../api/client';

export function AdminModal({ gameState, dungeons, onClose, fetchState }) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [coordsInput, setCoordsInput] = useState('');

  const clearedDungeons = gameState?.clearedDungeons || [];

  const handleToggleDungeon = useCallback(async (dungeonId) => {
    setError('');
    setSuccess('');
    const newCleared = clearedDungeons.includes(dungeonId)
      ? clearedDungeons.filter(id => id !== dungeonId)
      : [...clearedDungeons, dungeonId];

    try {
      const result = await api.adminSetCleared(newCleared);
      if (result.success) {
        setSuccess('Cleared dungeons updated');
        fetchState();
      } else {
        setError(result.error || 'Failed');
      }
    } catch (err) {
      setError('Connection failed');
    }
  }, [clearedDungeons, fetchState]);

  const handleResetGame = useCallback(async () => {
    if (!confirm('Reset the entire game? All progress will be lost.')) return;
    setError('');
    try {
      const result = await api.adminResetGame();
      if (result.success) {
        localStorage.removeItem('myPlayerId');
        fetchState();
        onClose();
      } else {
        setError(result.error || 'Failed');
      }
    } catch (err) {
      setError('Connection failed');
    }
  }, [fetchState, onClose]);

  const handleSetPhase = useCallback(async (phase) => {
    setError('');
    setSuccess('');
    try {
      const result = await api.adminSetPhase(phase);
      if (result.success) {
        setSuccess(`Phase set to ${phase}`);
        fetchState();
      } else {
        setError(result.error || 'Failed');
      }
    } catch (err) {
      setError('Connection failed');
    }
  }, [fetchState]);

  const handleSetCoords = useCallback(async () => {
    setError('');
    setSuccess('');
    try {
      const updates = JSON.parse(coordsInput);
      const result = await api.adminSetDungeonCoords(updates);
      if (result.success) {
        setSuccess('Coordinates updated');
        fetchState();
      } else {
        setError(result.error || 'Failed');
      }
    } catch (err) {
      setError('Invalid JSON or connection failed');
    }
  }, [coordsInput, fetchState]);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Admin Controls</h2>
          <button style={styles.closeButton} onClick={onClose}>X</button>
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {success && <p style={styles.success}>{success}</p>}

        <div style={styles.info}>
          Phase: <strong>{gameState?.phase}</strong> | Version: {gameState?.version}
        </div>

        {/* Set Cleared Dungeons */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Cleared Dungeons</h3>
          {dungeons.map(d => (
            <label key={d.id} style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={clearedDungeons.includes(d.id)}
                onChange={() => handleToggleDungeon(d.id)}
              />
              <span>Lv.{d.level} - {d.name}</span>
            </label>
          ))}
        </div>

        {/* Force Phase */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Force Phase</h3>
          <div style={styles.phaseButtons}>
            {['lobby', 'map', 'fight', 'levelup', 'victory'].map(phase => (
              <button
                key={phase}
                style={{
                  ...styles.phaseButton,
                  ...(gameState?.phase === phase ? styles.activePhase : {}),
                }}
                onClick={() => handleSetPhase(phase)}
              >
                {phase}
              </button>
            ))}
          </div>
        </div>

        {/* Set GPS Coordinates */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Set GPS Coords</h3>
          <textarea
            style={styles.textarea}
            value={coordsInput}
            onChange={e => setCoordsInput(e.target.value)}
            placeholder={'[\n  {"id":"dungeon_1","lat":51.5,"lng":-0.1}\n]'}
            rows={4}
          />
          <button style={styles.applyButton} onClick={handleSetCoords}>
            Apply Coordinates
          </button>
        </div>

        {/* Reset Game */}
        <div style={styles.section}>
          <button style={styles.resetButton} onClick={handleResetGame}>
            Reset Entire Game
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#1e1e1e',
    borderRadius: '16px',
    padding: '1.5rem',
    width: '90%',
    maxWidth: '450px',
    maxHeight: '85vh',
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '1.3rem',
    margin: 0,
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.5rem',
  },
  info: {
    fontSize: '0.8rem',
    color: '#888',
    marginBottom: '1rem',
    padding: '0.5rem',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.85rem',
    marginBottom: '0.5rem',
  },
  success: {
    color: '#4CAF50',
    fontSize: '0.85rem',
    marginBottom: '0.5rem',
  },
  section: {
    marginBottom: '1.25rem',
    padding: '0.75rem',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    color: '#ffd700',
    marginBottom: '0.75rem',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.3rem 0',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  phaseButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  phaseButton: {
    padding: '0.4rem 0.8rem',
    fontSize: '0.8rem',
    borderRadius: '6px',
    background: 'rgba(255,255,255,0.1)',
    color: '#ccc',
    border: '1px solid #444',
    cursor: 'pointer',
    textTransform: 'capitalize',
  },
  activePhase: {
    borderColor: '#ffd700',
    color: '#ffd700',
    background: 'rgba(255,215,0,0.1)',
  },
  textarea: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    border: '1px solid #444',
    background: 'rgba(0,0,0,0.3)',
    color: '#ccc',
    fontFamily: 'monospace',
    resize: 'vertical',
    boxSizing: 'border-box',
  },
  applyButton: {
    marginTop: '0.5rem',
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.85rem',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#ccc',
    border: '1px solid #444',
    cursor: 'pointer',
  },
  resetButton: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.9rem',
    borderRadius: '8px',
    background: 'rgba(255,0,0,0.15)',
    color: '#ff4444',
    border: '1px solid #ff4444',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};
