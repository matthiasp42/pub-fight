import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { SkillTreeDialog } from '../components/SkillTreeDialog';

const ATTR_LABELS = {
  maxHealth: { name: 'Max Health', icon: '\u{2764}' },
  maxAP: { name: 'Max AP', icon: '\u{26A1}' },
  power: { name: 'Power', icon: '\u{1F4AA}' },
  shieldCapacity: { name: 'Shield Cap', icon: '\u{1F6E1}' },
  shieldStrength: { name: 'Shield Str', icon: '\u{1F6E1}' },
  dexterity: { name: 'Dexterity', icon: '\u{1F3AF}' },
  evasiveness: { name: 'Evasion', icon: '\u{1F4A8}' },
};

export function LevelUpScreen({ gameState, myPlayer, fetchState }) {
  const [deltas, setDeltas] = useState({});
  const [skillTreeOpen, setSkillTreeOpen] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const players = gameState?.players ? Object.values(gameState.players) : [];
  const clearedCount = gameState?.clearedDungeons?.length || 0;

  // Recalculate available points from server data
  const attrPointsAvailable = myPlayer?.attributePoints ?? 0;
  const perkPointsAvailable = myPlayer?.perkPoints ?? 0;
  const deltaSum = Object.values(deltas).reduce((sum, v) => sum + v, 0);
  const attrPointsRemaining = attrPointsAvailable - deltaSum;


  const handleIncrement = (attr) => {
    if (attrPointsRemaining <= 0) return;
    setDeltas(prev => ({ ...prev, [attr]: (prev[attr] || 0) + 1 }));
  };

  const handleDecrement = (attr) => {
    if ((deltas[attr] || 0) <= 0) return;
    setDeltas(prev => ({ ...prev, [attr]: prev[attr] - 1 }));
  };

  const handleSubmitAttributes = useCallback(async () => {
    if (deltaSum === 0) return;
    setSubmitting(true);
    setError('');

    try {
      const result = await api.distributeAttributes(myPlayer.id, deltas);
      if (result.success) {
        setDeltas({});
        fetchState();
      } else {
        setError(result.error || 'Failed to distribute');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setSubmitting(false);
    }
  }, [deltas, deltaSum, myPlayer?.id, fetchState]);

  const handleUnlockSkill = useCallback(async (skillId) => {
    setError('');
    try {
      const result = await api.unlockSkill(myPlayer.id, skillId);
      if (result.success) {
        fetchState();
      } else {
        setError(result.error || 'Failed to unlock skill');
      }
    } catch (err) {
      setError('Connection failed');
    }
  }, [myPlayer?.id, fetchState]);

  const handleRandom = useCallback(async () => {
    const attrs = Object.keys(ATTR_LABELS);
    const points = attrPointsAvailable;
    if (points <= 0) return;
    const randomDeltas = {};
    for (let i = 0; i < points; i++) {
      const attr = attrs[Math.floor(Math.random() * attrs.length)];
      randomDeltas[attr] = (randomDeltas[attr] || 0) + 1;
    }
    setSubmitting(true);
    setError('');
    try {
      const result = await api.distributeAttributes(myPlayer.id, randomDeltas);
      if (result.success) {
        setDeltas({});
        fetchState();
      } else {
        setError(result.error || 'Failed to distribute');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setSubmitting(false);
    }
  }, [attrPointsAvailable, myPlayer?.id, fetchState]);

  const handleUndo = useCallback(async () => {
    setError('');
    try {
      const result = await api.undoLevelup(myPlayer.id);
      if (result.success) {
        setDeltas({});
        fetchState();
      } else {
        setError(result.error || 'Failed to undo');
      }
    } catch (err) {
      setError('Connection failed');
    }
  }, [myPlayer?.id, fetchState]);

  const handleFinishLevelup = useCallback(async () => {
    setError('');
    try {
      const result = await api.finishLevelup();
      if (result.success) {
        fetchState();
      } else {
        setError(result.error || 'Not all players ready');
      }
    } catch (err) {
      setError('Connection failed');
    }
  }, [fetchState]);

  const allPlayersReady = players.every(p => p.attributePoints === 0 && p.perkPoints === 0);
  const iAmReady = attrPointsAvailable === 0 && perkPointsAvailable === 0;

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Level Up!</h1>
      <p style={styles.subtitle}>
        Level {myPlayer?.level || '?'} - {clearedCount}/7 dungeons cleared
      </p>

      <div style={styles.topActions}>
        {attrPointsAvailable > 0 && (
          <button
            style={styles.randomButton}
            onClick={handleRandom}
            disabled={submitting}
          >
            Random
          </button>
        )}
        {!allPlayersReady && (
          <button
            style={styles.undoButton}
            onClick={handleUndo}
          >
            Undo
          </button>
        )}
      </div>

      {error && <p style={styles.error}>{error}</p>}

      {!iAmReady ? (
        <>
          {/* Attribute Distribution */}
          {attrPointsAvailable > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                Distribute Attribute Points ({attrPointsRemaining} remaining)
              </h2>
              <div style={styles.attrList}>
                {Object.entries(ATTR_LABELS).map(([attr, { name, icon }]) => (
                  <div key={attr} style={styles.attrRow}>
                    <span style={styles.attrLabel}>
                      {icon} {name}
                    </span>
                    <span style={styles.attrValue}>
                      {myPlayer?.attributes?.[attr] || 0}
                      {(deltas[attr] || 0) > 0 && (
                        <span style={styles.attrDelta}> +{deltas[attr]}</span>
                      )}
                    </span>
                    <div style={styles.attrButtons}>
                      <button
                        style={styles.attrBtn}
                        onClick={() => handleDecrement(attr)}
                        disabled={(deltas[attr] || 0) <= 0}
                      >
                        -
                      </button>
                      <button
                        style={styles.attrBtn}
                        onClick={() => handleIncrement(attr)}
                        disabled={attrPointsRemaining <= 0}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                style={{
                  ...styles.confirmButton,
                  ...(deltaSum === 0 ? styles.disabledButton : {}),
                }}
                onClick={handleSubmitAttributes}
                disabled={deltaSum === 0 || submitting}
              >
                {submitting ? 'Applying...' : `Confirm ${deltaSum} point${deltaSum !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}

          {/* Perk Points */}
          {perkPointsAvailable > 0 && (
            <div style={styles.section}>
              <h2 style={styles.sectionTitle}>
                Unlock Skills ({perkPointsAvailable} perk point{perkPointsAvailable !== 1 ? 's' : ''})
              </h2>
              <button
                style={styles.skillButton}
                onClick={() => setSkillTreeOpen(true)}
              >
                Open Skill Tree
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={styles.readySection}>
          <span style={styles.readyIcon}>&#10003;</span>
          <h2 style={styles.readyText}>You're Ready!</h2>
          <p style={styles.readySubtext}>Waiting for other players...</p>
        </div>
      )}

      {/* Other players' progress */}
      <div style={styles.section}>
        <h3 style={styles.progressTitle}>Party Progress</h3>
        {players.map(p => {
          const ready = p.attributePoints === 0 && p.perkPoints === 0;
          return (
            <div key={p.id} style={styles.playerProgress}>
              <span style={styles.playerProgressName}>
                {p.name}
                {p.id === myPlayer?.id && ' (You)'}
              </span>
              {ready ? (
                <span style={styles.readyBadge}>Ready</span>
              ) : (
                <span style={styles.pendingBadge}>
                  {p.attributePoints} attr, {p.perkPoints} perk
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue button when everyone is ready */}
      {allPlayersReady && (
        <button style={styles.continueButton} onClick={handleFinishLevelup}>
          {clearedCount >= 7 ? 'Claim Victory!' : 'Continue Exploring'}
        </button>
      )}

      {/* Skill Tree Dialog */}
      {myPlayer && (
        <SkillTreeDialog
          open={skillTreeOpen}
          onClose={() => setSkillTreeOpen(false)}
          characterClass={myPlayer.class}
          characterLevel={myPlayer.level}
          ownedSkillIds={myPlayer.ownedSkillIds || []}
          perkPoints={perkPointsAvailable}
          onUnlockSkill={handleUnlockSkill}
        />
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
    padding: '20px',
    maxWidth: '500px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '0.25rem',
    color: '#ffd700',
  },
  subtitle: {
    color: '#888',
    marginBottom: '0.75rem',
  },
  topActions: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  randomButton: {
    padding: '0.4rem 1rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#aaa',
    border: '1px solid #444',
    cursor: 'pointer',
  },
  undoButton: {
    padding: '0.4rem 1rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    background: 'rgba(255,100,100,0.1)',
    color: '#ff8888',
    border: '1px solid #664444',
    cursor: 'pointer',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: '1rem',
  },
  section: {
    width: '100%',
    marginBottom: '1.5rem',
    padding: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem',
    color: '#ffd700',
  },
  attrList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  attrRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  attrLabel: {
    flex: 1,
    fontSize: '0.9rem',
  },
  attrValue: {
    width: '80px',
    textAlign: 'right',
    fontSize: '0.9rem',
    fontWeight: 'bold',
  },
  attrDelta: {
    color: '#4CAF50',
  },
  attrButtons: {
    display: 'flex',
    gap: '0.25rem',
  },
  attrBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #444',
    cursor: 'pointer',
  },
  confirmButton: {
    marginTop: '1rem',
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  },
  disabledButton: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  skillButton: {
    width: '100%',
    padding: '0.75rem',
    fontSize: '1rem',
    borderRadius: '12px',
    background: 'rgba(255,165,0,0.2)',
    color: '#ff9800',
    fontWeight: 'bold',
    border: '1px solid #ff9800',
    cursor: 'pointer',
  },
  readySection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '2rem',
    marginBottom: '1.5rem',
  },
  readyIcon: {
    fontSize: '3rem',
    color: '#4CAF50',
    marginBottom: '0.5rem',
  },
  readyText: {
    fontSize: '1.5rem',
    color: '#4CAF50',
    marginBottom: '0.25rem',
  },
  readySubtext: {
    color: '#888',
    fontSize: '0.9rem',
  },
  progressTitle: {
    fontSize: '1rem',
    marginBottom: '0.75rem',
    color: '#888',
  },
  playerProgress: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  playerProgressName: {
    fontSize: '0.9rem',
  },
  readyBadge: {
    fontSize: '0.8rem',
    color: '#4CAF50',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    background: 'rgba(76,175,80,0.15)',
  },
  pendingBadge: {
    fontSize: '0.8rem',
    color: '#ff9800',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    background: 'rgba(255,152,0,0.15)',
  },
  continueButton: {
    position: 'fixed',
    bottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
    left: '20px',
    right: '20px',
    maxWidth: '400px',
    margin: '0 auto',
    padding: '1rem',
    fontSize: '1.2rem',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  },
};
