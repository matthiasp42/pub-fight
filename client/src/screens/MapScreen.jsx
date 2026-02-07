import { useState, useEffect, useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { api } from '../api/client';
import { haversineDistance, hasGpsCoords } from '../utils/geo';
import { PlayerDetailOverlay } from '../components/PlayerDetailOverlay';
import { GiShield, GiSwordWound, GiWizardStaff, GiCauldron } from 'react-icons/gi';
import { LuX } from 'react-icons/lu';

const ARCHETYPE_LABELS = {
  swarmMaster: 'Swarm Master',
  executioner: 'Executioner',
  devastator: 'Devastator',
  tankBuster: 'Tank Buster',
  tempoManipulator: 'Tempo Manipulator',
  regenerator: 'Regenerator',
  hybridNightmare: 'Hybrid Nightmare',
};

const CLASS_ICON_MAP = { tank: GiShield, warrior: GiSwordWound, wizard: GiWizardStaff, alchemist: GiCauldron };
const PORTRAITS = { ehsan: '/portraits/ehsan.png', dennis: '/portraits/dennis.png', budde: '/portraits/budde.png', matthias: '/portraits/matthias.png' };

function makeMarkerSVG(level, isCleared, isEnterable) {
  const fill = isCleared ? '#4a6b3e' : isEnterable ? '#8b1a1a' : '#5a5244';
  const stroke = isCleared ? '#2d4426' : isEnterable ? '#5c0e0e' : '#3a3530';
  const textColor = '#f0e6d0';
  const flag = isCleared ? 'M8,4 L18,8 L8,12 Z' : 'M8,4 L20,4 L20,14 L8,14 Z';
  return `
    <svg width="48" height="56" viewBox="0 0 48 56" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="s${level}" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <!-- Pin body -->
      <path d="M24,52 L18,36 A16,16 0 1,1 30,36 Z" fill="${fill}" stroke="${stroke}" stroke-width="2" filter="url(#s${level})"/>
      <!-- Inner circle -->
      <circle cx="24" cy="20" r="13" fill="${fill}" stroke="${textColor}" stroke-width="1.5" stroke-dasharray="${isCleared ? '3,2' : 'none'}"/>
      <!-- Level number -->
      <text x="24" y="${isCleared ? '24' : '25'}" text-anchor="middle" fill="${textColor}" font-family="Georgia,serif" font-weight="bold" font-size="${isCleared ? '13' : '15'}">${isCleared ? '&#10003;' : level}</text>
      ${!isCleared ? `<!-- Banner -->
      <rect x="14" y="2" width="20" height="10" rx="1" fill="${isEnterable ? '#c9a84c' : '#777'}" stroke="${isEnterable ? '#8b6914' : '#555'}" stroke-width="1"/>
      <text x="24" y="10" text-anchor="middle" fill="${isEnterable ? '#3a1a00' : '#ddd'}" font-family="Georgia,serif" font-weight="bold" font-size="8">Lv.${level}</text>` : ''}
    </svg>`;
}

export function MapScreen({ gameState, myPlayer, fetchState }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef({});
  const playerMarkerRef = useRef(null);
  const bossesRef = useRef(null);

  const [position, setPosition] = useState(null);
  const [gpsError, setGpsError] = useState(null);
  const [entering, setEntering] = useState(null);
  const [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedDungeon, setSelectedDungeon] = useState(null);

  const dungeons = gameState?.dungeons || [];
  const clearedDungeons = gameState?.clearedDungeons || [];

  const gpsEnabled = hasGpsCoords(dungeons);

  // Fetch boss definitions once
  useEffect(() => {
    fetch('/api/bosses').then(r => r.json()).then(data => {
      bossesRef.current = {};
      data.forEach(b => { bossesRef.current[b.id] = b; });
    }).catch(() => {});
  }, []);

  const getCenter = () => {
    const withCoords = dungeons.filter(d => d.lat !== 0 || d.lng !== 0);
    if (withCoords.length === 0) return [9.72, 52.385];
    const avgLng = withCoords.reduce((s, d) => s + d.lng, 0) / withCoords.length;
    const avgLat = withCoords.reduce((s, d) => s + d.lat, 0) / withCoords.length;
    return [avgLng, avgLat];
  };

  // Initialize map
  useEffect(() => {
    if (!gpsEnabled || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = 'pk.eyJ1Ijoic3VwZHVwIiwiYSI6ImNtbGI2NXVodTBpYjAzZ3M5bm43dW96Y20ifQ.TbJniKcLAhgHRYs7IA0PzA';
    const center = getCenter();
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/stevage/ciywkc4dg000l2rmfzqopmwd1',
      center,
      zoom: 14.5,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.current.on('load', () => setMapReady(true));

    return () => {
      map.current?.remove();
      map.current = null;
      markersRef.current = {};
      playerMarkerRef.current = null;
      setMapReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsEnabled]);

  // Update dungeon markers
  useEffect(() => {
    if (!mapReady || !map.current) return;

    const sortedDungeons = [...dungeons].sort((a, b) => a.level - b.level);

    sortedDungeons.forEach(dungeon => {
      const isCleared = clearedDungeons.includes(dungeon.id);
      const dist = position && gpsEnabled && !(dungeon.lat === 0 && dungeon.lng === 0)
        ? haversineDistance(position.lat, position.lng, dungeon.lat, dungeon.lng)
        : null;
      const enterable = !isCleared && (!gpsEnabled || dist === null || dist <= dungeon.radiusMeters);

      let existing = markersRef.current[dungeon.id];
      if (!existing) {
        const el = document.createElement('div');
        el.style.cssText = 'cursor:pointer;width:48px;height:56px;';
        el.innerHTML = makeMarkerSVG(dungeon.level, isCleared, enterable);

        const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([dungeon.lng, dungeon.lat])
          .addTo(map.current);
        markersRef.current[dungeon.id] = { marker, el };
        existing = markersRef.current[dungeon.id];

        // Desktop
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedDungeon(dungeon);
        });
        // Mobile: touchend is more reliable than click (small finger movement cancels click)
        el.addEventListener('touchend', (e) => {
          e.stopPropagation();
          e.preventDefault();
          setSelectedDungeon(dungeon);
        });
      } else {
        existing.el.innerHTML = makeMarkerSVG(dungeon.level, isCleared, enterable);
      }

      // Radius circle
      const circleId = `radius-${dungeon.id}`;
      const circleColor = isCleared ? '#4a6b3e' : enterable ? '#8b1a1a' : '#5a5244';
      const circleData = createCircleGeoJSON(dungeon.lat, dungeon.lng, dungeon.radiusMeters);

      if (map.current.getSource(circleId)) {
        map.current.getSource(circleId).setData(circleData);
        map.current.setPaintProperty(circleId, 'fill-color', circleColor);
        map.current.setPaintProperty(`${circleId}-outline`, 'line-color', circleColor);
      } else {
        map.current.addSource(circleId, { type: 'geojson', data: circleData });
        map.current.addLayer({
          id: circleId,
          type: 'fill',
          source: circleId,
          paint: { 'fill-color': circleColor, 'fill-opacity': 0.15 },
        });
        map.current.addLayer({
          id: `${circleId}-outline`,
          type: 'line',
          source: circleId,
          paint: { 'line-color': circleColor, 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [4, 3] },
        });
      }
    });
  }, [mapReady, dungeons, clearedDungeons, position, gpsEnabled]);


  // Player position marker
  useEffect(() => {
    if (!mapReady || !map.current || !position) return;

    if (!playerMarkerRef.current) {
      const el = document.createElement('div');
      el.style.cssText = `
        width:18px;height:18px;border-radius:50%;
        background:#2255cc;border:3px solid #f0e6d0;
        box-shadow:0 0 0 2px #2255cc, 0 0 12px rgba(34,85,204,0.6);
      `;
      playerMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([position.lng, position.lat])
        .addTo(map.current);

      map.current.flyTo({ center: [position.lng, position.lat], zoom: 15 });
    } else {
      playerMarkerRef.current.setLngLat([position.lng, position.lat]);
    }
  }, [mapReady, position]);

  // Watch GPS
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
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsEnabled]);


  const handleEnterDungeon = useCallback(async (dungeonId) => {
    setEntering(dungeonId);
    setError('');
    try {
      const result = await api.enterDungeon(dungeonId);
      if (result.success) {
        setSelectedDungeon(null);
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

  const canEnterDungeon = (dungeon) => {
    if (clearedDungeons.includes(dungeon.id)) return false;
    if (!gpsEnabled) return true;
    if (!position) return true;
    const dist = haversineDistance(position.lat, position.lng, dungeon.lat, dungeon.lng);
    return dist <= dungeon.radiusMeters;
  };

  const sortedDungeons = [...dungeons].sort((a, b) => a.level - b.level);
  const players = gameState?.players ? Object.values(gameState.players) : [];

  // Keep selectedPlayer in sync with latest gameState
  const liveSelectedPlayer = selectedPlayer
    ? gameState?.players?.[selectedPlayer.id] ?? selectedPlayer
    : null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Pub Crawl</h1>
        <div style={styles.headerRight}>
          <span style={styles.partyLabel}>
            Lv {gameState?.clearedDungeons?.length + 1 || 1}
          </span>
          <span style={styles.clearedLabel}>
            {clearedDungeons.length}/7
          </span>
        </div>
      </div>

      {/* Player bar */}
      {players.length > 0 && (
        <div style={styles.playerBar}>
          {players.map(player => {
            const portrait = PORTRAITS[player.name.toLowerCase()];
            const ClassIcon = CLASS_ICON_MAP[player.class];
            const isMe = player.id === myPlayer?.id;
            return (
              <button
                key={player.id}
                style={{
                  ...styles.playerAvatar,
                  ...(isMe ? styles.playerAvatarMine : {}),
                  ...(portrait ? {
                    backgroundImage: `url(${portrait})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  } : {}),
                }}
                onClick={() => setSelectedPlayer(player)}
              >
                {!portrait && ClassIcon && <ClassIcon size={18} color="#f5f0e8" />}
              </button>
            );
          })}
        </div>
      )}

      {gpsEnabled && gpsError && (
        <div style={styles.gpsNotice}>GPS: {gpsError}</div>
      )}
      {error && <p style={styles.error}>{error}</p>}

      {gpsEnabled ? (
        <div ref={mapContainer} style={styles.mapWrapper} />
      ) : (
        <>
          <div style={styles.gpsNotice}>
            GPS not configured - all dungeons enterable (use Admin to set coords)
          </div>
          <div style={styles.dungeonList}>
            {sortedDungeons.map(dungeon => {
              const isCleared = clearedDungeons.includes(dungeon.id);
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
                    <span style={styles.dungeonLevel}>Lv.{dungeon.level}</span>
                    <span style={styles.dungeonName}>{dungeon.name}</span>
                    {isCleared && <span style={{ color: '#4CAF50', fontWeight: 'bold' }}> ✓</span>}
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
                      {isEntering ? '...' : 'Enter'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Dungeon detail modal */}
      {selectedDungeon && (() => {
        const dungeon = selectedDungeon;
        const isCleared = clearedDungeons.includes(dungeon.id);
        const dist = position && gpsEnabled
          ? haversineDistance(position.lat, position.lng, dungeon.lat, dungeon.lng)
          : null;
        const enterable = !isCleared && (!gpsEnabled || dist === null || dist <= dungeon.radiusMeters);
        const boss = bossesRef.current?.[dungeon.bossId];
        const archLabel = boss ? (ARCHETYPE_LABELS[boss.archetype] || boss.archetype) : '';
        const topAbilities = boss ? boss.abilities.slice(0, 3).map(a => a.name).join(', ') : '';

        return (
          <div style={styles.overlay} onClick={() => setSelectedDungeon(null)}>
            <div style={styles.dungeonModal} onClick={e => e.stopPropagation()}>
              <button style={styles.closeBtn} onClick={() => setSelectedDungeon(null)}>
                <LuX size={18} />
              </button>

              {/* Header */}
              <div style={styles.dungeonModalHeader}>
                <div style={styles.dungeonModalLabel}>Level {dungeon.level} Dungeon</div>
                <div style={styles.dungeonModalName}>{dungeon.name}</div>
                {isCleared && <div style={styles.dungeonModalConquered}>Conquered!</div>}
              </div>

              {/* Boss info */}
              {boss && !isCleared && (
                <div style={styles.dungeonModalBoss}>
                  <div style={styles.dungeonModalBossLabel}>Boss</div>
                  <div style={styles.dungeonModalBossName}>{boss.name}</div>
                  <div style={styles.dungeonModalArchetype}>{archLabel}</div>
                  <div style={styles.dungeonModalStats}>
                    <span style={{ color: '#10b981' }}>{'\u2665'} {boss.attributes.maxHealth}</span>
                    <span style={{ color: '#f59e0b' }}>{'\u2694'} {boss.attributes.power}</span>
                    <span style={{ color: '#3b82f6' }}>{'\u2605'} {boss.attributes.maxAP} AP</span>
                  </div>
                  <div style={styles.dungeonModalAbilities}>{topAbilities}</div>
                </div>
              )}

              {/* Distance */}
              {dist !== null && (
                <div style={styles.dungeonModalDist}>
                  {dist < 1000 ? `${Math.round(dist)}m away` : `${(dist / 1000).toFixed(1)}km away`}
                </div>
              )}

              {/* Enter buttons */}
              {!isCleared && (
                <div style={styles.dungeonModalButtons}>
                  <button
                    style={{
                      ...styles.dungeonModalEnter,
                      ...(enterable ? {} : styles.dungeonModalEnterDisabled),
                    }}
                    disabled={!enterable}
                    onClick={() => enterable && handleEnterDungeon(dungeon.id)}
                  >
                    Enter Dungeon
                  </button>
                  {!enterable && gpsEnabled && dist !== null && (
                    <button
                      style={styles.dungeonModalIgnore}
                      onClick={() => handleEnterDungeon(dungeon.id)}
                    >
                      Ignore distance
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Player detail overlay */}
      {liveSelectedPlayer && (
        <PlayerDetailOverlay
          player={liveSelectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}

function createCircleGeoJSON(lat, lng, radiusMeters, points = 48) {
  const coords = [];
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos((lat * Math.PI) / 180));
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100vh',
    padding: '10px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: '0.5rem',
    zIndex: 1,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  title: {
    fontSize: '1.5rem',
    margin: 0,
  },
  partyLabel: {
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#ffd700',
  },
  clearedLabel: {
    fontSize: '0.85rem',
    color: '#888',
  },
  gpsNotice: {
    padding: '0.4rem 0.8rem',
    borderRadius: '8px',
    background: 'rgba(255,165,0,0.15)',
    color: '#ffa500',
    fontSize: '0.75rem',
    marginBottom: '0.5rem',
    textAlign: 'center',
    zIndex: 1,
  },
  error: {
    color: '#ff6b6b',
    fontSize: '0.85rem',
    margin: '0 0 0.5rem',
    zIndex: 1,
  },
  mapWrapper: {
    flex: 1,
    width: '100%',
    borderRadius: '12px',
    overflow: 'hidden',
    border: '3px solid #5a4a32',
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
  dungeonCleared: { opacity: 0.5, borderColor: '#4CAF50' },
  dungeonAvailable: { borderColor: '#ffd700', background: 'rgba(255,215,0,0.05)' },
  dungeonInfo: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  dungeonLevel: {
    fontSize: '0.8rem', fontWeight: 'bold', color: '#ffd700',
    background: 'rgba(255,215,0,0.15)', padding: '0.15rem 0.4rem', borderRadius: '4px',
  },
  dungeonName: { fontSize: '1rem', fontWeight: 'bold' },
  enterButton: {
    padding: '0.5rem 1.5rem', fontSize: '0.9rem', borderRadius: '8px',
    background: 'linear-gradient(135deg, #ff6b00 0%, #ff9500 100%)',
    color: '#fff', fontWeight: 'bold', border: 'none', cursor: 'pointer',
  },
  enterDisabled: { opacity: 0.3, cursor: 'not-allowed' },

  // Player bar
  playerBar: {
    display: 'flex',
    gap: '8px',
    width: '100%',
    marginBottom: '8px',
    zIndex: 1,
    justifyContent: 'center',
  },
  playerAvatar: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: '2px solid rgba(168,160,149,0.3)',
    background: 'rgba(255,255,255,0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
  playerAvatarMine: {
    borderColor: '#f59e0b',
    boxShadow: '0 0 0 2px rgba(245,158,11,0.3)',
  },

  // Player detail overlay
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },

  // Dungeon modal
  dungeonModal: {
    background: '#2d2418',
    borderRadius: '16px',
    border: '2px solid rgba(245,158,11,0.3)',
    padding: '16px',
    width: '100%',
    maxWidth: 320,
    position: 'relative',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    fontFamily: 'Georgia, serif',
  },
  dungeonModalHeader: {
    borderBottom: '2px solid rgba(245,158,11,0.4)',
    paddingBottom: '6px',
    marginBottom: '10px',
  },
  dungeonModalLabel: {
    fontSize: '0.75rem',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  dungeonModalName: {
    fontSize: '1.15rem',
    fontWeight: 'bold',
    marginTop: '2px',
    color: '#f5f0e8',
  },
  dungeonModalConquered: {
    color: '#10b981',
    fontSize: '0.85rem',
    fontStyle: 'italic',
  },
  dungeonModalBoss: {
    background: 'rgba(220,38,38,0.1)',
    border: '1px solid rgba(220,38,38,0.25)',
    borderRadius: '8px',
    padding: '10px',
    marginBottom: '10px',
  },
  dungeonModalBossLabel: {
    fontSize: '0.7rem',
    color: '#f59e0b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '3px',
  },
  dungeonModalBossName: {
    fontWeight: 'bold',
    fontSize: '1rem',
    color: '#f5f0e8',
  },
  dungeonModalArchetype: {
    fontSize: '0.8rem',
    color: '#a8a095',
    fontStyle: 'italic',
    margin: '2px 0 6px',
  },
  dungeonModalStats: {
    display: 'flex',
    gap: '10px',
    fontSize: '0.8rem',
    marginBottom: '6px',
  },
  dungeonModalAbilities: {
    fontSize: '0.75rem',
    color: '#a8a095',
  },
  dungeonModalDist: {
    fontSize: '0.8rem',
    color: '#a8a095',
    fontStyle: 'italic',
    marginBottom: '8px',
  },
  dungeonModalButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  dungeonModalEnter: {
    padding: '10px 14px',
    fontSize: '0.95rem',
    borderRadius: '8px',
    width: '100%',
    background: '#dc2626',
    color: '#f5f0e8',
    fontWeight: 'bold',
    border: '2px solid rgba(220,38,38,0.6)',
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    letterSpacing: '0.5px',
    minHeight: '48px',
  },
  dungeonModalEnterDisabled: {
    background: 'rgba(168,160,149,0.2)',
    color: '#a8a095',
    border: '2px solid rgba(168,160,149,0.2)',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  dungeonModalIgnore: {
    padding: '8px 14px',
    fontSize: '0.8rem',
    borderRadius: '8px',
    width: '100%',
    background: 'transparent',
    color: '#a8a095',
    fontWeight: 'normal',
    border: '1px solid rgba(168,160,149,0.25)',
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
    minHeight: '48px',
  },
};
