import { useCallback, useState } from 'react';
import { api } from '../api/client';

export function VictoryScreen({ gameState, myPlayer, fetchState }) {
  const [resetting, setResetting] = useState(false);
  const players = gameState?.players ? Object.values(gameState.players) : [];

  const handleNewGame = useCallback(async () => {
    setResetting(true);
    try {
      await api.adminResetGame();
      fetchState();
    } catch (err) {
      console.error('Failed to reset:', err);
    }
    setResetting(false);
  }, [fetchState]);

  return (
    <div style={styles.container}>
      <div style={styles.celebration}>
        <div style={styles.trophy}>&#127942;</div>
        <h1 style={styles.title}>VICTORY!</h1>
        <p style={styles.subtitle}>All 7 dungeons conquered!</p>
      </div>

      <div style={styles.partyStats}>
        <h2 style={styles.statsTitle}>Final Party</h2>
        {players.map(player => (
          <div key={player.id} style={styles.playerCard}>
            <div style={styles.playerHeader}>
              <span style={styles.playerName}>{player.name}</span>
              <span style={styles.playerClass}>
                Lv.{player.level} {player.class}
              </span>
            </div>
            <div style={styles.statRow}>
              <span>HP: {player.attributes.maxHealth}</span>
              <span>AP: {player.attributes.maxAP}</span>
              <span>POW: {player.attributes.power}</span>
            </div>
            <div style={styles.statRow}>
              <span>DEX: {player.attributes.dexterity}</span>
              <span>EVA: {player.attributes.evasiveness}</span>
              <span>Skills: {player.ownedSkillIds?.length || 0}</span>
            </div>
          </div>
        ))}
      </div>

      <button
        style={styles.newGameButton}
        onClick={handleNewGame}
        disabled={resetting}
      >
        {resetting ? 'Resetting...' : 'New Game'}
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  celebration: {
    textAlign: 'center',
    marginBottom: '2rem',
    paddingTop: '2rem',
  },
  trophy: {
    fontSize: '5rem',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '3rem',
    color: '#ffd700',
    marginBottom: '0.5rem',
    textShadow: '0 0 20px rgba(255,215,0,0.4)',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: '#888',
  },
  partyStats: {
    width: '100%',
    maxWidth: '400px',
    marginBottom: '2rem',
  },
  statsTitle: {
    fontSize: '1.2rem',
    color: '#ffd700',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  playerCard: {
    padding: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,215,0,0.2)',
    marginBottom: '0.75rem',
  },
  playerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
  },
  playerName: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
  },
  playerClass: {
    fontSize: '0.9rem',
    color: '#888',
    textTransform: 'capitalize',
  },
  statRow: {
    display: 'flex',
    gap: '1rem',
    fontSize: '0.8rem',
    color: '#aaa',
  },
  newGameButton: {
    padding: '1rem 3rem',
    fontSize: '1.2rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  },
};
