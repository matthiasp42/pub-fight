import { useEffect } from 'react';
import { useGameState } from '../hooks/useGameState';
import { api } from '../api/client';

export function GameScreen({ myPlayerId, onBack }) {
  const { gameState, syncStatus, startPolling, stopPolling, updateLocalState } = useGameState();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handleScoreChange = async (delta) => {
    // Optimistic update
    updateLocalState(prev => ({
      ...prev,
      version: prev.version + 1,
      players: {
        ...prev.players,
        [myPlayerId]: {
          ...prev.players[myPlayerId],
          score: prev.players[myPlayerId].score + delta
        }
      }
    }));

    try {
      await api.action(myPlayerId, delta);
    } catch (err) {
      console.error('Action failed:', err);
    }
  };

  if (!gameState) {
    return (
      <div style={styles.container}>
        <p>Loading...</p>
      </div>
    );
  }

  const players = Object.values(gameState.players);
  const myPlayer = gameState.players[myPlayerId];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onBack}>
          ← Lobby
        </button>
        <div style={styles.syncIndicator}>
          <span
            style={{
              ...styles.syncDot,
              background: syncStatus === 'synced' ? '#38ef7d' :
                          syncStatus === 'restoring' ? '#f9ca24' : '#ff6b6b'
            }}
          />
          <span style={styles.syncText}>
            {syncStatus === 'synced' ? 'Synced' :
             syncStatus === 'restoring' ? 'Restoring...' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div style={styles.cardGrid}>
        {players.map(player => {
          const isMine = player.id === myPlayerId;

          return (
            <div
              key={player.id}
              style={{
                ...styles.card,
                ...(isMine ? styles.myCard : {})
              }}
            >
              <h2 style={styles.cardName}>{player.name}</h2>
              <div style={styles.scoreDisplay}>
                <span style={styles.score}>{player.score}</span>
              </div>

              {isMine && (
                <div style={styles.controls}>
                  <button
                    style={styles.minusButton}
                    onClick={() => handleScoreChange(-1)}
                  >
                    −
                  </button>
                  <button
                    style={styles.plusButton}
                    onClick={() => handleScoreChange(1)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={styles.footer}>
        <p style={styles.versionText}>State v{gameState.version}</p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    padding: '15px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem'
  },
  backButton: {
    padding: '0.5rem 1rem',
    fontSize: '1rem',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff'
  },
  syncIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  syncDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%'
  },
  syncText: {
    fontSize: '0.85rem',
    opacity: 0.8
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '1rem',
    flex: 1
  },
  card: {
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem'
  },
  myCard: {
    background: 'linear-gradient(135deg, rgba(102,126,234,0.3) 0%, rgba(118,75,162,0.3) 100%)',
    border: '2px solid rgba(102,126,234,0.5)'
  },
  cardName: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  scoreDisplay: {
    padding: '0.5rem 1.5rem',
    background: 'rgba(0,0,0,0.2)',
    borderRadius: '12px'
  },
  score: {
    fontSize: '2.5rem',
    fontWeight: 'bold'
  },
  controls: {
    display: 'flex',
    gap: '1rem',
    marginTop: '0.5rem'
  },
  minusButton: {
    width: '56px',
    height: '56px',
    fontSize: '2rem',
    fontWeight: 'bold',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  },
  plusButton: {
    width: '56px',
    height: '56px',
    fontSize: '2rem',
    fontWeight: 'bold',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  },
  footer: {
    marginTop: 'auto',
    paddingTop: '1rem',
    textAlign: 'center'
  },
  versionText: {
    fontSize: '0.8rem',
    opacity: 0.5
  }
};
