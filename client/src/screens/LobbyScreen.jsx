import { useState, useEffect } from 'react';
import { api } from '../api/client';

export function LobbyScreen({ onEnterGame }) {
  const [players, setPlayers] = useState({});
  const [myPlayerId, setMyPlayerId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const sessionId = localStorage.getItem('sessionId');

  const fetchPlayers = async () => {
    try {
      const state = await api.getState();
      setPlayers(state.players);
      // Check if we already control a player
      const controlled = Object.values(state.players).find(
        p => p.controlledBy === sessionId
      );
      if (controlled) {
        setMyPlayerId(controlled.id);
      }
      setError('');
    } catch (err) {
      setError('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
    const interval = setInterval(fetchPlayers, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTakeControl = async (playerId) => {
    try {
      const result = await api.join(playerId);
      if (result.success) {
        setMyPlayerId(playerId);
        fetchPlayers();
      } else {
        setError(result.error || 'Failed to take control');
      }
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const result = await api.join(null, newName.trim());
      if (result.success) {
        setMyPlayerId(result.player.id);
        setShowCreate(false);
        setNewName('');
        fetchPlayers();
      } else {
        setError(result.error || 'Failed to create player');
      }
    } catch (err) {
      setError('Connection failed');
    }
  };

  const handleRelease = async () => {
    if (!myPlayerId) return;
    try {
      await api.release(myPlayerId);
      setMyPlayerId(null);
      fetchPlayers();
    } catch (err) {
      setError('Failed to release');
    }
  };

  const playerList = Object.values(players);

  if (loading) {
    return (
      <div style={styles.container}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Lobby</h1>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.playerList}>
        {playerList.length === 0 && (
          <p style={styles.empty}>No players yet. Create one!</p>
        )}
        {playerList.map(player => {
          const isControlled = !!player.controlledBy;
          const isMine = player.controlledBy === sessionId;

          return (
            <div
              key={player.id}
              style={{
                ...styles.playerCard,
                ...(isMine ? styles.myCard : {}),
                ...(isControlled && !isMine ? styles.takenCard : {})
              }}
              onClick={() => !isControlled && handleTakeControl(player.id)}
            >
              <span style={styles.playerName}>{player.name}</span>
              <span style={styles.playerStatus}>
                {isMine ? '(You)' : isControlled ? '(Taken)' : '(Available)'}
              </span>
            </div>
          );
        })}
      </div>

      {showCreate ? (
        <form onSubmit={handleCreate} style={styles.createForm}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter your name"
            style={styles.input}
            autoFocus
            maxLength={20}
          />
          <div style={styles.createButtons}>
            <button type="submit" style={styles.button}>
              Create
            </button>
            <button
              type="button"
              style={styles.cancelButton}
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          style={styles.addButton}
          onClick={() => setShowCreate(true)}
        >
          + New Player
        </button>
      )}

      {myPlayerId && (
        <div style={styles.bottomButtons}>
          <button style={styles.releaseButton} onClick={handleRelease}>
            Release Character
          </button>
          <button
            style={styles.enterButton}
            onClick={() => onEnterGame(myPlayerId)}
          >
            Enter Game
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px'
  },
  title: {
    fontSize: '2rem',
    marginBottom: '1.5rem'
  },
  error: {
    color: '#ff6b6b',
    marginBottom: '1rem'
  },
  empty: {
    color: '#888',
    fontStyle: 'italic'
  },
  playerList: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem'
  },
  playerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.1s, background 0.2s'
  },
  myCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cursor: 'default'
  },
  takenCard: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  playerName: {
    fontSize: '1.2rem',
    fontWeight: 'bold'
  },
  playerStatus: {
    fontSize: '0.9rem',
    opacity: 0.7
  },
  addButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    marginBottom: '2rem'
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: '300px',
    marginBottom: '2rem'
  },
  input: {
    padding: '1rem',
    fontSize: '1.1rem',
    borderRadius: '12px',
    border: '2px solid #4a4a6a',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    textAlign: 'center'
  },
  createButtons: {
    display: 'flex',
    gap: '1rem'
  },
  button: {
    flex: 1,
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: 'bold'
  },
  cancelButton: {
    flex: 1,
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff'
  },
  bottomButtons: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    right: '20px',
    display: 'flex',
    gap: '1rem',
    maxWidth: '400px',
    margin: '0 auto'
  },
  releaseButton: {
    flex: 1,
    padding: '1rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,107,107,0.3)',
    color: '#fff'
  },
  enterButton: {
    flex: 2,
    padding: '1rem',
    fontSize: '1.2rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: '#fff',
    fontWeight: 'bold'
  }
};
