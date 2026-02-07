import { useState, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GiDeathSkull, GiAngularSpider,
  GiVikingHelmet, GiAxeSword, GiWizardFace, GiCauldron,
  GiPerspectiveDiceSixFacesRandom,
} from 'react-icons/gi';
import { CHARACTER_TYPES } from '../game/types.js';

// Warm, saturated sector palettes
const ENEMY_FILLS = [
  ['#b91c1c', '#dc2626'], // red
  ['#c2410c', '#ea580c'], // orange
  ['#9f1239', '#e11d48'], // rose
  ['#7c2d12', '#d97706'], // amber
];
const PARTY_FILLS = [
  ['#065f46', '#10b981'],
  ['#0f766e', '#14b8a6'],
  ['#166534', '#22c55e'],
  ['#115e59', '#2dd4bf'],
];
const MISS_FILL = ['#1f1f1f', '#333'];

const ARROW_COLORS = ['#ffd700', '#ff6b6b', '#60a5fa', '#34d399'];

const CX = 150;
const CY = 150;
const RADIUS = 115;
const ICON_RADIUS = RADIUS * 0.65;

const SPIN_DURATION = 2500;
const LAND_PAUSE = 800;

// Map class names and character types to icons
const CLASS_ICONS = {
  tank: GiVikingHelmet,
  warrior: GiAxeSword,
  wizard: GiWizardFace,
  alchemist: GiCauldron,
};

function getCharacterIcon(character) {
  if (!character) return GiPerspectiveDiceSixFacesRandom;
  if (character.type === CHARACTER_TYPES.BOSS) return GiDeathSkull;
  if (character.type === CHARACTER_TYPES.MINION) return GiAngularSpider;
  return CLASS_ICONS[character.class] || GiAxeSword;
}

function buildVisualSectors(engineSectors, attacker, allCharacters) {
  const targetSectors = engineSectors.filter((s) => s.type === 'target');
  const missSector = engineSectors.find((s) => s.type === 'miss');

  const totalTargetAngle = targetSectors.reduce(
    (sum, s) => sum + (s.end - s.start),
    0
  );
  const totalMissAngle = missSector ? missSector.end - missSector.start : 0;

  const isPlayerAttacker = attacker.type === CHARACTER_TYPES.PLAYER;
  const friendlies = allCharacters.filter(
    (c) =>
      c.id !== attacker.id &&
      c.state.isAlive &&
      (isPlayerAttacker
        ? c.type === CHARACTER_TYPES.PLAYER
        : c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION)
  );

  const friendlyAngleEach =
    friendlies.length > 0
      ? Math.min((totalMissAngle * 0.6) / friendlies.length, 40)
      : 0;
  const totalFriendlyAngle = friendlyAngleEach * friendlies.length;
  const remainingMissAngle = totalMissAngle - totalFriendlyAngle;
  const halfMiss = remainingMissAngle / 2;

  const visualSectors = [];
  let angle = -(totalTargetAngle / 2);

  targetSectors.forEach((sector, i) => {
    const sectorAngle = sector.end - sector.start;
    const fills = ENEMY_FILLS[i % ENEMY_FILLS.length];
    visualSectors.push({
      type: 'target',
      fills,
      fullName: sector.target.name,
      startAngle: angle,
      endAngle: angle + sectorAngle,
      character: sector.target,
      engineStart: sector.start,
      engineEnd: sector.end,
    });
    angle += sectorAngle;
  });

  if (halfMiss > 0) {
    visualSectors.push({
      type: 'miss',
      fills: MISS_FILL,
      startAngle: angle,
      endAngle: angle + halfMiss,
      character: null,
    });
    angle += halfMiss;
  }

  friendlies.forEach((friendly, i) => {
    const fills = PARTY_FILLS[i % PARTY_FILLS.length];
    visualSectors.push({
      type: 'friendly',
      fills,
      fullName: friendly.name,
      startAngle: angle,
      endAngle: angle + friendlyAngleEach,
      character: friendly,
    });
    angle += friendlyAngleEach;
  });

  if (halfMiss > 0) {
    visualSectors.push({
      type: 'miss',
      fills: MISS_FILL,
      startAngle: angle,
      endAngle: angle + halfMiss,
      character: null,
    });
  }

  return visualSectors;
}

function rollToVisualAngle(roll, engineSectors, visualSectors) {
  const hitEngineSector = engineSectors.find(
    (s) => roll >= s.start && roll < s.end
  );
  if (!hitEngineSector) return 0;

  const engineSectorSize = hitEngineSector.end - hitEngineSector.start;
  const fraction = (roll - hitEngineSector.start) / engineSectorSize;

  if (hitEngineSector.type === 'target') {
    const visualSector = visualSectors.find(
      (vs) =>
        vs.type === 'target' &&
        vs.character &&
        vs.character.id === hitEngineSector.target.id
    );
    if (visualSector) {
      const visualSize = visualSector.endAngle - visualSector.startAngle;
      return visualSector.startAngle + fraction * visualSize;
    }
  } else {
    const ms = visualSectors.find((vs) => vs.type === 'miss');
    if (ms) {
      const visualSize = ms.endAngle - ms.startAngle;
      return ms.startAngle + fraction * visualSize;
    }
  }

  return 0;
}

function sectorPath(cx, cy, r, startDeg, endDeg) {
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  const start = toRad(startDeg);
  const end = toRad(endDeg);
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

function iconPosition(cx, cy, r, startDeg, endDeg) {
  const midDeg = (startDeg + endDeg) / 2;
  const rad = ((midDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * BattleWheel — inline battlefield overlay with auto-spinning wheel.
 * Sectors show character icons (skulls, spiders, class icons).
 * Multi-hit: multiple arrows on the same wheel.
 */
export function BattleWheel({ wheelResults, attacker, allCharacters, onComplete }) {
  const [phase, setPhase] = useState('spinning');
  const timersRef = useRef([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const firstResult = wheelResults[0];
  const visualSectors = buildVisualSectors(
    firstResult.sectors,
    attacker,
    allCharacters
  );

  const targetAngles = wheelResults.map((wr) =>
    rollToVisualAngle(wr.roll, wr.sectors, visualSectors)
  );

  const [arrowStates] = useState(() =>
    wheelResults.map((_, i) => {
      const startAngle = Math.random() * 360;
      const targetAngle = targetAngles[i];
      const fullRotations = 3 + Math.random() * 2;
      const finalAngle =
        startAngle +
        fullRotations * 360 +
        ((targetAngle - (startAngle % 360) + 360) % 360);
      return { startAngle, finalAngle };
    })
  );

  const [currentAngles, setCurrentAngles] = useState(
    arrowStates.map((a) => a.startAngle)
  );
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const t0 = requestAnimationFrame(() => {
      setTransitioning(true);
      setCurrentAngles(arrowStates.map((a) => a.finalAngle));
    });

    const t1 = setTimeout(() => {
      setTransitioning(false);
      setPhase('landed');
    }, SPIN_DURATION);

    const t2 = setTimeout(() => {
      setPhase('done');
    }, SPIN_DURATION + LAND_PAUSE);

    const t3 = setTimeout(() => {
      onCompleteRef.current();
    }, SPIN_DURATION + LAND_PAUSE + 300);

    timersRef.current = [t1, t2, t3];
    return () => {
      cancelAnimationFrame(t0);
      timersRef.current.forEach(clearTimeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Build icon elements to render via foreignObject
  const sectorIcons = visualSectors
    .filter((s) => s.type !== 'miss')
    .map((sector, i) => {
      const Icon = getCharacterIcon(sector.character);
      const pos = iconPosition(CX, CY, ICON_RADIUS, sector.startAngle, sector.endAngle);
      const iconSize = 22;
      return { Icon, pos, iconSize, sector, key: i };
    });

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 150,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {/* Backdrop with warm vignette */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(ellipse at center, rgba(26,26,46,0.6) 0%, rgba(0,0,0,0.4) 100%)',
            }}
          />

          {/* Wheel container */}
          <Box sx={{ position: 'relative', width: 220, height: 220 }}>
            {/* Outer glow ring */}
            <Box
              sx={{
                position: 'absolute',
                inset: -8,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(245,158,11,0.15) 60%, transparent 70%)',
                filter: 'blur(6px)',
              }}
            />

            <svg viewBox="0 0 300 300" style={{ width: '100%', height: '100%', filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}>
              <defs>
                {/* Radial gradients for each sector */}
                {visualSectors.map((sector, i) => (
                  <radialGradient key={`grad-${i}`} id={`sector-grad-${i}`} cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor={sector.fills[1]} stopOpacity="1" />
                    <stop offset="100%" stopColor={sector.fills[0]} stopOpacity="1" />
                  </radialGradient>
                ))}
                <filter id="bw-glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Sector wedges with gradients */}
              {visualSectors.map((sector, i) => (
                <path
                  key={i}
                  d={sectorPath(CX, CY, RADIUS, sector.startAngle, sector.endAngle)}
                  fill={`url(#sector-grad-${i})`}
                  stroke="rgba(0,0,0,0.4)"
                  strokeWidth={1.5}
                />
              ))}

              {/* Sector divider highlights (subtle gold lines) */}
              {visualSectors.map((sector, i) => {
                const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
                const rad = toRad(sector.startAngle);
                const x2 = CX + RADIUS * Math.cos(rad);
                const y2 = CY + RADIUS * Math.sin(rad);
                return (
                  <line
                    key={`div-${i}`}
                    x1={CX} y1={CY} x2={x2} y2={y2}
                    stroke="rgba(245,158,11,0.15)"
                    strokeWidth={0.5}
                  />
                );
              })}

              {/* Character icons via foreignObject */}
              {sectorIcons.map(({ Icon, pos, iconSize, sector, key }) => (
                <foreignObject
                  key={`icon-${key}`}
                  x={pos.x - iconSize / 2}
                  y={pos.y - iconSize / 2}
                  width={iconSize}
                  height={iconSize}
                  style={{ pointerEvents: 'none', overflow: 'visible' }}
                >
                  <div style={{
                    width: iconSize,
                    height: iconSize,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))',
                  }}>
                    <Icon size={iconSize} color="#fff" />
                  </div>
                </foreignObject>
              ))}

              {/* "X" for miss sectors */}
              {visualSectors
                .filter((s) => s.type === 'miss')
                .map((sector, i) => {
                  const pos = iconPosition(CX, CY, ICON_RADIUS, sector.startAngle, sector.endAngle);
                  return (
                    <text
                      key={`miss-${i}`}
                      x={pos.x}
                      y={pos.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="rgba(255,255,255,0.25)"
                      fontSize={16}
                      fontWeight="bold"
                    >
                      X
                    </text>
                  );
                })}

              {/* Arrows */}
              {arrowStates.map((_, i) => {
                const color = ARROW_COLORS[i % ARROW_COLORS.length];
                const arrowLength = wheelResults.length > 1 ? RADIUS * 0.72 : RADIUS - 12;
                const arrowY = CY - arrowLength;
                return (
                  <g
                    key={`arrow-${i}`}
                    style={{
                      transformOrigin: `${CX}px ${CY}px`,
                      transform: `rotate(${currentAngles[i]}deg)`,
                      transition: transitioning
                        ? `transform ${SPIN_DURATION}ms cubic-bezier(0.15, 0.85, 0.25, 1)`
                        : 'none',
                    }}
                  >
                    {/* Arrow shadow */}
                    <line
                      x1={CX} y1={CY} x2={CX} y2={arrowY + 2}
                      stroke="rgba(0,0,0,0.3)"
                      strokeWidth={5}
                      strokeLinecap="round"
                    />
                    {/* Arrow body */}
                    <line
                      x1={CX} y1={CY} x2={CX} y2={arrowY}
                      stroke={color}
                      strokeWidth={3}
                      strokeLinecap="round"
                      filter="url(#bw-glow)"
                    />
                    {/* Arrow head */}
                    <polygon
                      points={`${CX},${arrowY - 4} ${CX - 6},${arrowY + 10} ${CX + 6},${arrowY + 10}`}
                      fill={color}
                      filter="url(#bw-glow)"
                    />
                  </g>
                );
              })}

              {/* Center hub — golden with gradient */}
              <defs>
                <radialGradient id="hub-grad" cx="40%" cy="35%">
                  <stop offset="0%" stopColor="#ffd700" />
                  <stop offset="100%" stopColor="#b45309" />
                </radialGradient>
              </defs>
              <circle
                cx={CX} cy={CY} r={18}
                fill="url(#hub-grad)"
                stroke="#78350f"
                strokeWidth={2}
              />
              <circle
                cx={CX} cy={CY} r={12}
                fill="none"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth={0.5}
              />

              {/* Hit count in hub for multi-hit */}
              {wheelResults.length > 1 && (
                <text
                  x={CX} y={CY + 1}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#1a1a2e"
                  fontSize={13}
                  fontWeight="bold"
                >
                  x{wheelResults.length}
                </text>
              )}
            </svg>

            {/* Landing results below wheel */}
            <AnimatePresence>
              {phase === 'landed' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    position: 'absolute',
                    bottom: -30,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  {wheelResults.map((wr, i) => {
                    const Icon = wr.target
                      ? getCharacterIcon(wr.target)
                      : null;
                    return (
                      <Box
                        key={i}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          px: 0.8,
                          py: 0.3,
                          borderRadius: 1,
                          background: wr.target
                            ? 'rgba(16,185,129,0.2)'
                            : 'rgba(136,136,136,0.2)',
                          border: wr.target
                            ? '1px solid rgba(16,185,129,0.4)'
                            : '1px solid rgba(136,136,136,0.3)',
                        }}
                      >
                        {Icon ? (
                          <Icon size={12} color="#34d399" />
                        ) : (
                          <Box
                            component="span"
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              color: '#888',
                            }}
                          >
                            X
                          </Box>
                        )}
                        <Box
                          component="span"
                          sx={{
                            fontSize: '0.6rem',
                            fontWeight: 700,
                            color: wr.target ? '#34d399' : '#888',
                            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                          }}
                        >
                          {wr.target ? wr.target.name.split(' ')[0] : 'Miss'}
                        </Box>
                      </Box>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
