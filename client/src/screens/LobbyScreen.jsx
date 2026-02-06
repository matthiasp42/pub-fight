import { useState, useEffect } from 'react';
import { api } from '../api/client';

const CLASS_OPTIONS = [
  { id: 'tank', name: 'Tank', icon: '\u{1F6E1}', desc: 'High HP, shields, protects allies' },
  { id: 'warrior', name: 'Warrior', icon: '\u{2694}', desc: 'High damage, multi-hit attacks' },
  { id: 'wizard', name: 'Wizard', icon: '\u{1F9D9}', desc: 'Powerful AoE magic, high dexterity' },
  { id: 'alchemist', name: 'Alchemist', icon: '\u{1F9EA}', desc: 'Healing, buffs, support' },
];

export function LobbyScreen({ gameState, myPlayerId, onSelectPlayer, onReleasePlayer, onLogout, fetchState }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedClass, setSelectedClass] = useState('warrior');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sessionId = localStorage.getItem('sessionId');
  const players = gameState?.players ? Object.values(gameState.players) : [];
  const phase = gameState?.phase || 'lobby';

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleTakeControl = async (playerId) => {
    try {
      const result = await api.join(playerId);
      if (result.success) {
        onSelectPlayer(playerId);
        fetchState();
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
    setLoading(true);

    try {
      const result = await api.join(null, newName.trim(), selectedClass);
      if (result.success) {
        onSelectPlayer(result.player.id);
        setShowCreate(false);
        setNewName('');
        fetchState();
      } else {
        setError(result.error || 'Failed to create player');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!myPlayerId) return;
    try {
      await api.release(myPlayerId);
      onReleasePlayer();
      fetchState();
    } catch (err) {
      setError('Failed to release');
    }
  };

  const handleStartGame = async () => {
    try {
      const result = await api.startGame();
      if (result.success) {
        fetchState();
      } else {
        setError(result.error || 'Failed to start game');
      }
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Pub Fight</h1>
      <p style={styles.subtitle}>
        {phase === 'lobby' ? 'Pick your fighter' : 'Game in progress - select your character'}
      </p>

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.playerList}>
        {players.length === 0 && (
          <p style={styles.empty}>No players yet. Create one!</p>
        )}
        {players.map(player => {
          const isControlled = !!player.controlledBy;
          const isMine = player.controlledBy === sessionId;
          const classIcon = CLASS_OPTIONS.find(c => c.id === player.class)?.icon || '';

          return (
            <div
              key={player.id}
              style={{
                ...styles.playerCard,
                ...(isMine ? styles.myCard : {}),
                ...(isControlled && !isMine ? styles.takenCard : {})
              }}
              onClick={() => !isMine && handleTakeControl(player.id)}
            >
              <div style={styles.playerInfo}>
                <span style={styles.playerName}>
                  {classIcon} {player.name}
                </span>
                <span style={styles.playerClass}>
                  {player.class} Lv.{player.level}
                </span>
              </div>
              <span style={styles.playerStatus}>
                {isMine ? '(You)' : isControlled ? '(Taken)' : '(Available)'}
              </span>
            </div>
          );
        })}
      </div>

      {phase === 'lobby' && !showCreate && (
        <button
          style={styles.addButton}
          onClick={() => setShowCreate(true)}
        >
          + New Player
        </button>
      )}

      {showCreate && (
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

          <div style={styles.classGrid}>
            {CLASS_OPTIONS.map(cls => (
              <div
                key={cls.id}
                style={{
                  ...styles.classCard,
                  ...(selectedClass === cls.id ? styles.classCardSelected : {})
                }}
                onClick={() => setSelectedClass(cls.id)}
              >
                <span style={styles.classIcon}>{cls.icon}</span>
                <span style={styles.className}>{cls.name}</span>
                <span style={styles.classDesc}>{cls.desc}</span>
              </div>
            ))}
          </div>

          <div style={styles.createButtons}>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Creating...' : 'Create'}
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
      )}

      {myPlayerId && phase === 'lobby' && (
        <div style={styles.bottomButtons}>
          <button style={styles.releaseButton} onClick={handleRelease}>
            Release
          </button>
          <button
            style={{
              ...styles.enterButton,
              ...(players.length < 1 ? styles.disabledButton : {})
            }}
            onClick={handleStartGame}
            disabled={players.length < 1}
          >
            Start Game ({players.length} player{players.length !== 1 ? 's' : ''})
          </button>
        </div>
      )}

      <button style={styles.logoutButton} onClick={onLogout}>
        Logout
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
  title: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#888',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: '1rem',
  },
  empty: {
    color: '#888',
    fontStyle: 'italic',
  },
  playerList: {
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  playerCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    cursor: 'pointer',
    transition: 'transform 0.1s, background 0.2s',
  },
  myCard: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    cursor: 'default',
  },
  takenCard: {
    opacity: 0.5,
    cursor: 'pointer',
  },
  playerInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  playerName: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
  },
  playerClass: {
    fontSize: '0.8rem',
    opacity: 0.7,
    textTransform: 'capitalize',
  },
  playerStatus: {
    fontSize: '0.9rem',
    opacity: 0.7,
  },
  addButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    marginBottom: '2rem',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    maxWidth: '400px',
    marginBottom: '2rem',
  },
  input: {
    padding: '1rem',
    fontSize: '1.1rem',
    borderRadius: '12px',
    border: '2px solid #4a4a6a',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    textAlign: 'center',
  },
  classGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
  classCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0.75rem',
    borderRadius: '12px',
    border: '2px solid transparent',
    background: 'rgba(255,255,255,0.05)',
    cursor: 'pointer',
    gap: '0.25rem',
    transition: 'border-color 0.2s',
  },
  classCardSelected: {
    borderColor: '#ffd700',
    background: 'rgba(255,215,0,0.1)',
  },
  classIcon: {
    fontSize: '1.5rem',
  },
  className: {
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  classDesc: {
    fontSize: '0.7rem',
    opacity: 0.6,
    textAlign: 'center',
  },
  createButtons: {
    display: 'flex',
    gap: '1rem',
  },
  button: {
    flex: 1,
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: 'bold',
  },
  cancelButton: {
    flex: 1,
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
  },
  bottomButtons: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    right: '20px',
    display: 'flex',
    gap: '1rem',
    maxWidth: '400px',
    margin: '0 auto',
  },
  releaseButton: {
    flex: 1,
    padding: '1rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,107,107,0.3)',
    color: '#fff',
  },
  enterButton: {
    flex: 2,
    padding: '1rem',
    fontSize: '1.2rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: '#fff',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  logoutButton: {
    marginTop: '1rem',
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    background: 'transparent',
    color: '#666',
    border: '1px solid #333',
  },
};
