import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
const ENEMY_COLORS = ['#e53935', '#ff7043', '#ef5350', '#d84315'];
const MISS_COLOR = '#2a2a2a';
const ARROW_COLOR = '#ffd700';
const HUB_COLOR = '#1e1e1e';

const CX = 150;
const CY = 150;
const RADIUS = 120;
const LABEL_RADIUS = RADIUS * 0.7;

/**
 * Build visual sectors for the wheel display.
 * Enemies at top (12 o'clock), party at bottom (6 o'clock), miss zones on left/right.
 *
 * @param {object[]} engineSectors - sectors from wheelResult.sectors
 * @param {object} attacker - the attacking character
 * @param {object[]} allCharacters - all alive characters
 * @returns {object[]} visual sectors with { type, label, color, startAngle, endAngle, character }
 */
function buildVisualSectors(engineSectors, attacker, allCharacters) {
  // Extract target sectors and miss sector from engine
  const targetSectors = engineSectors.filter((s) => s.type === 'target');
  const missSector = engineSectors.find((s) => s.type === 'miss');

  const totalTargetAngle = targetSectors.reduce(
    (sum, s) => sum + (s.end - s.start),
    0
  );
  const totalMissAngle = missSector ? missSector.end - missSector.start : 0;

  // Build visual sectors clockwise from top (0° = 12 o'clock)
  // Layout: targets at top, miss split into two halves at bottom
  const visualSectors = [];
  let angle = -(totalTargetAngle / 2); // Center targets at top (0°)
  const halfMiss = totalMissAngle / 2;

  // Target sectors
  targetSectors.forEach((sector, i) => {
    const sectorAngle = sector.end - sector.start;
    visualSectors.push({
      type: 'target',
      label: sector.target.name[0],
      fullName: sector.target.name,
      color: ENEMY_COLORS[i % ENEMY_COLORS.length],
      startAngle: angle,
      endAngle: angle + sectorAngle,
      character: sector.target,
      engineStart: sector.start,
      engineEnd: sector.end,
    });
    angle += sectorAngle;
  });

  // Miss-right (3 o'clock side)
  if (halfMiss > 0) {
    visualSectors.push({
      type: 'miss',
      label: '',
      color: MISS_COLOR,
      startAngle: angle,
      endAngle: angle + halfMiss,
    });
    angle += halfMiss;
  }

  // Miss-left (9 o'clock side)
  if (halfMiss > 0) {
    visualSectors.push({
      type: 'miss',
      label: '',
      color: MISS_COLOR,
      startAngle: angle,
      endAngle: angle + halfMiss,
    });
  }

  return visualSectors;
}

/**
 * Map the engine's roll value to a visual angle on the wheel.
 */
function rollToVisualAngle(roll, engineSectors, visualSectors) {
  // Find which engine sector the roll landed in
  const hitEngineSector = engineSectors.find(
    (s) => roll >= s.start && roll < s.end
  );
  if (!hitEngineSector) return 0;

  // Calculate fractional position within the engine sector
  const engineSectorSize = hitEngineSector.end - hitEngineSector.start;
  const fraction = (roll - hitEngineSector.start) / engineSectorSize;

  if (hitEngineSector.type === 'target') {
    // Find matching visual sector
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
    // Miss — land in the right miss zone (first miss sector)
    const missSector = visualSectors.find((vs) => vs.type === 'miss');
    if (missSector) {
      const visualSize = missSector.endAngle - missSector.startAngle;
      return missSector.startAngle + fraction * visualSize;
    }
  }

  return 0;
}

/**
 * Convert a polar sector to an SVG path arc.
 */
function sectorPath(cx, cy, r, startDeg, endDeg) {
  // Convert from our coordinate system (0° = top, clockwise)
  // to SVG (0° = right, counterclockwise by default)
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

/**
 * Get the label position at the midpoint of a sector.
 */
function labelPosition(cx, cy, r, startDeg, endDeg) {
  const midDeg = (startDeg + endDeg) / 2;
  const rad = ((midDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * AttackWheel component — SVG wheel with spinning arrow animation.
 *
 * @param {{
 *   wheelResult: { target: object|null, roll: number, sectors: object[] },
 *   attacker: object,
 *   allCharacters: object[],
 *   spinState: 'idle' | 'spinning' | 'landed',
 *   onSpin: () => void,
 *   onSpinComplete: () => void,
 *   spinIndex: number,
 *   totalSpins: number,
 *   results: Array<{ target: object|null }>,
 * }} props
 */
export function AttackWheel({
  wheelResult,
  attacker,
  allCharacters,
  spinState,
  onSpin,
  onSpinComplete,
  spinIndex,
  totalSpins,
  results,
}) {
  const [arrowAngle, setArrowAngle] = useState(() => Math.random() * 360);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef(null);

  const visualSectors = buildVisualSectors(
    wheelResult.sectors,
    attacker,
    allCharacters
  );

  // Handle spin trigger
  useEffect(() => {
    if (spinState === 'spinning') {
      const targetAngle = rollToVisualAngle(
        wheelResult.roll,
        wheelResult.sectors,
        visualSectors
      );
      const fullRotations = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5 full rotations
      const finalAngle = arrowAngle + fullRotations * 360 + (targetAngle - (arrowAngle % 360) + 360) % 360;

      // Small delay to ensure CSS transition applies after state change
      requestAnimationFrame(() => {
        setTransitioning(true);
        setArrowAngle(finalAngle);
      });

      timerRef.current = setTimeout(() => {
        setTransitioning(false);
        onSpinComplete();
      }, 3000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [spinState]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 1,
      }}
    >
      {/* Spin counter for multi-hit */}
      {totalSpins > 1 && (
        <Typography
          variant="subtitle2"
          sx={{ color: '#aaa', fontWeight: 'bold' }}
        >
          Spin {spinIndex + 1} / {totalSpins}
        </Typography>
      )}

      {/* SVG Wheel */}
      <svg
        viewBox="0 0 300 300"
        style={{ maxWidth: 280, width: '100%' }}
      >
        {/* Sector wedges */}
        {visualSectors.map((sector, i) => (
          <path
            key={i}
            d={sectorPath(CX, CY, RADIUS, sector.startAngle, sector.endAngle)}
            fill={sector.color}
            stroke="#111"
            strokeWidth={1.5}
          />
        ))}

        {/* Sector labels */}
        {visualSectors
          .filter((s) => s.label)
          .map((sector, i) => {
            const pos = labelPosition(
              CX,
              CY,
              LABEL_RADIUS,
              sector.startAngle,
              sector.endAngle
            );
            return (
              <text
                key={`label-${i}`}
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={14}
                fontWeight="bold"
                style={{ pointerEvents: 'none' }}
              >
                {sector.label}
              </text>
            );
          })}

        {/* Rotating arrow group */}
        <g
          style={{
            transformOrigin: `${CX}px ${CY}px`,
            transform: `rotate(${arrowAngle}deg)`,
            transition: transitioning
              ? 'transform 3s cubic-bezier(0.15, 0.85, 0.25, 1)'
              : 'none',
          }}
        >
          {/* Arrow line */}
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - RADIUS + 10}
            stroke={ARROW_COLOR}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Arrow head */}
          <polygon
            points={`${CX},${CY - RADIUS + 5} ${CX - 8},${CY - RADIUS + 22} ${CX + 8},${CY - RADIUS + 22}`}
            fill={ARROW_COLOR}
          />
        </g>

        {/* Center hub */}
        <circle
          cx={CX}
          cy={CY}
          r={16}
          fill={HUB_COLOR}
          stroke={ARROW_COLOR}
          strokeWidth={2.5}
        />
      </svg>

      {/* Spin button */}
      {spinState === 'idle' && (
        <Button
          variant="contained"
          onClick={onSpin}
          sx={{
            mt: 1,
            fontWeight: 'bold',
            fontSize: '1.1rem',
            backgroundColor: ARROW_COLOR,
            color: '#000',
            '&:hover': { backgroundColor: '#ffca28' },
          }}
        >
          Spin!
        </Button>
      )}

      {/* Result after landing */}
      {spinState === 'landed' && (
        <Typography
          variant="h6"
          sx={{
            mt: 1,
            fontWeight: 'bold',
            color: wheelResult.target ? '#4CAF50' : '#f44336',
          }}
        >
          {wheelResult.target
            ? `Hit: ${wheelResult.target.name}!`
            : 'Miss!'}
        </Typography>
      )}

      {/* Running tally for multi-hit */}
      {results.length > 0 && (
        <Box sx={{ mt: 1, width: '100%' }}>
          {results.map((r, i) => (
            <Typography
              key={i}
              variant="body2"
              sx={{
                color: r.target ? '#4CAF50' : '#f44336',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {r.target ? `\u2713 Hit: ${r.target.name}` : '\u2717 Miss'}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
