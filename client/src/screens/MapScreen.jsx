import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { haversineDistance, hasGpsCoords } from '../utils/geo';
import { AdminModal } from '../components/AdminModal';

export function MapScreen({ gameState, myPlayer, fetchState }) {
  const [position, setPosition] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [entering, setEntering] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [error, setError] = useState('');

  const dungeons = gameState?.dungeons || [];
  const clearedDungeons = gameState?.clearedDungeons || [];
  const gpsEnabled = hasGpsCoords(dungeons);

  // Watch GPS position
  useEffect(() => {
    if (!gpsEnabled) return;

    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(null);
      },
      (err) => {
        setGpsError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsEnabled]);

  // Poll for state updates
  useEffect(() => {
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleEnterDungeon = useCallback(async (dungeonId) => {
    setEntering(dungeonId);
    setError('');
    try {
      const result = await api.enterDungeon(dungeonId);
      if (result.success) {
        fetchState();
      } else {
        setError(result.error || 'Failed to enter dungeon');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setEntering(null);
    }
  }, [fetchState]);

  const getDungeonDistance = (dungeon) => {
    if (!position || !gpsEnabled || (dungeon.lat === 0 && dungeon.lng === 0)) return null;
    return haversineDistance(position.lat, position.lng, dungeon.lat, dungeon.lng);
  };

  const canEnterDungeon = (dungeon) => {
    if (clearedDungeons.includes(dungeon.id)) return false;
    if (!gpsEnabled) return true; // No GPS = all enterable (testing mode)
    const dist = getDungeonDistance(dungeon);
    if (dist === null) return true; // No position yet = allow
    return dist <= dungeon.radiusMeters;
  };

  // Sort dungeons by level
  const sortedDungeons = [...dungeons].sort((a, b) => a.level - b.level);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pub Crawl</h1>
        <button style={styles.adminButton} onClick={() => setShowAdmin(true)}>
          Admin
        </button>
      </div>

      <div style={styles.partyInfo}>
        <span style={styles.partyLabel}>
          Party Level {gameState?.clearedDungeons?.length + 1 || 1}
        </span>
        <span style={styles.clearedLabel}>
          {clearedDungeons.length}/7 dungeons cleared
        </span>
      </div>

      {!gpsEnabled && (
        <div style={styles.gpsNotice}>
          GPS not configured - all dungeons enterable (use Admin to set coords)
        </div>
      )}

      {gpsEnabled && gpsError && (
        <div style={styles.gpsNotice}>
          GPS: {gpsError}
        </div>
      )}

      {gpsEnabled && position && (
        <div style={styles.gpsPosition}>
          Your position: {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
        </div>
      )}

      {error && <p style={styles.error}>{error}</p>}

      <div style={styles.dungeonList}>
        {sortedDungeons.map(dungeon => {
          const isCleared = clearedDungeons.includes(dungeon.id);
          const dist = getDungeonDistance(dungeon);
          const enterable = canEnterDungeon(dungeon);
          const isEntering = entering === dungeon.id;

          return (
            <div
              key={dungeon.id}
              style={{
                ...styles.dungeonCard,
                ...(isCleared ? styles.dungeonCleared : {}),
                ...(enterable && !isCleared ? styles.dungeonAvailable : {}),
              }}
            >
              <div style={styles.dungeonInfo}>
                <div style={styles.dungeonHeader}>
                  <span style={styles.dungeonLevel}>Lv.{dungeon.level}</span>
                  <span style={styles.dungeonName}>{dungeon.name}</span>
                  {isCleared && <span style={styles.checkmark}> ✓</span>}
                </div>
                {dist !== null && (
                  <span style={styles.dungeonDistance}>
                    {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
                    {dist <= dungeon.radiusMeters && ' (in range)'}
                  </span>
                )}
              </div>

              {!isCleared && (
                <button
                  style={{
                    ...styles.enterButton,
                    ...((!enterable || isEntering) ? styles.enterDisabled : {}),
                  }}
                  onClick={() => enterable && handleEnterDungeon(dungeon.id)}
                  disabled={!enterable || isEntering}
                >
                  {isEntering ? 'Entering...' : enterable ? 'Enter' : 'Too far'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {showAdmin && (
        <AdminModal
          gameState={gameState}
          dungeons={dungeons}
          onClose={() => setShowAdmin(false)}
          fetchState={fetchState}
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
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    maxWidth: '500px',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '2rem',
    margin: 0,
  },
  adminButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.8rem',
    borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)',
    color: '#888',
    border: '1px solid #444',
  },
  partyInfo: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  partyLabel: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#ffd700',
  },
  clearedLabel: {
    fontSize: '0.9rem',
    color: '#888',
  },
  gpsNotice: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    background: 'rgba(255,165,0,0.15)',
    color: '#ffa500',
    fontSize: '0.8rem',
    marginBottom: '1rem',
    maxWidth: '500px',
    textAlign: 'center',
  },
  gpsPosition: {
    fontSize: '0.7rem',
    color: '#666',
    marginBottom: '0.5rem',
  },
  error: {
    color: '#ff6b6b',
    marginBottom: '1rem',
  },
  dungeonList: {
    width: '100%',
    maxWidth: '500px',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  dungeonCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.05)',
    border: '2px solid #333',
  },
  dungeonCleared: {
    opacity: 0.5,
    borderColor: '#4CAF50',
  },
  dungeonAvailable: {
    borderColor: '#ffd700',
    background: 'rgba(255,215,0,0.05)',
  },
  dungeonInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  dungeonHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  dungeonLevel: {
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: '#ffd700',
    background: 'rgba(255,215,0,0.15)',
    padding: '0.15rem 0.4rem',
    borderRadius: '4px',
  },
  dungeonName: {
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  checkmark: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  dungeonDistance: {
    fontSize: '0.8rem',
    color: '#888',
  },
  enterButton: {
    padding: '0.5rem 1.5rem',
    fontSize: '0.9rem',
    borderRadius: '8px',
    background: 'linear-gradient(135deg, #ff6b00 0%, #ff9500 100%)',
    color: '#fff',
    fontWeight: 'bold',
    border: 'none',
    cursor: 'pointer',
  },
  enterDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
  },
};
