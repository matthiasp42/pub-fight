import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { GiDeathSkull, GiAngularSpider } from 'react-icons/gi';
import { EFFECT_TYPES, CHARACTER_TYPES } from '../game/types.js';

function getCharacterPos(id) {
  const el = document.querySelector(`[data-character-id="${id}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function getBeamColor(effects) {
  if (!effects || effects.length === 0) return '#dc2626';
  const t = effects[0]?.type;
  if (t === EFFECT_TYPES.HEAL) return '#10b981';
  if (t === EFFECT_TYPES.ADD_SHIELD) return '#a855f7';
  if (t === EFFECT_TYPES.MODIFY_AP) return '#3b82f6';
  return '#dc2626';
}

function getCombatTexts(target) {
  if (!target.hit) return [{ text: 'MISS', color: '#888' }];

  const texts = [];
  for (const e of (target.effects || [])) {
    if (e.type === EFFECT_TYPES.DAMAGE) {
      if (e.healthDamage > 0) {
        texts.push({ text: `-${e.healthDamage}`, color: '#ff6b6b' });
      } else if (e.shieldDamageAbsorbed > 0) {
        texts.push({ text: 'BLOCKED', color: '#c084fc' });
      }
    } else if (e.type === EFFECT_TYPES.HEAL && e.amount > 0) {
      texts.push({ text: `+${e.amount}`, color: '#34d399' });
    } else if (e.type === EFFECT_TYPES.ADD_SHIELD && e.amount > 0) {
      texts.push({ text: `+${e.amount}`, color: '#c084fc' });
    } else if (e.type === EFFECT_TYPES.MODIFY_AP) {
      texts.push({ text: `${e.amount > 0 ? '+' : ''}${e.amount} AP`, color: '#60a5fa' });
    }
  }
  return texts.length > 0 ? texts : [];
}

function getSelfCombatTexts(selfEffects) {
  const texts = [];
  for (const e of (selfEffects || [])) {
    if (e.type === EFFECT_TYPES.HEAL && e.amount > 0) {
      texts.push({ text: `+${e.amount}`, color: '#34d399' });
    } else if (e.type === EFFECT_TYPES.MODIFY_AP) {
      texts.push({ text: `${e.amount > 0 ? '+' : ''}${e.amount} AP`, color: '#60a5fa' });
    }
  }
  return texts;
}

/**
 * Full-screen overlay for battle animations.
 * Renders: action banner, SVG beams, impact effects, floating combat text.
 *
 * @param {{ animation: object|null, showImpact: boolean }} props
 * animation shape: { actorId, actorName, actorType, actionName, targetResults, selfEffects }
 */
export function BattleFeedback({ animation, showImpact }) {
  const [positions, setPositions] = useState({ from: null, targets: [], self: null });

  useEffect(() => {
    if (!animation) {
      setPositions({ from: null, targets: [], self: null });
      return;
    }

    // Small delay for layout to settle after any state changes
    const timer = requestAnimationFrame(() => {
      const from = getCharacterPos(animation.actorId);
      const targets = (animation.targetResults || [])
        .filter(tr => tr.targetId !== animation.actorId)
        .map(tr => ({
          ...tr,
          pos: getCharacterPos(tr.targetId),
        }));
      const self = getCharacterPos(animation.actorId);
      setPositions({ from, targets, self });
    });

    return () => cancelAnimationFrame(timer);
  }, [animation]);

  if (!animation) return null;

  const { from, targets, self: selfPos } = positions;
  const BossIcon = animation.actorType === CHARACTER_TYPES.MINION ? GiAngularSpider : GiDeathSkull;
  const selfTexts = getSelfCombatTexts(animation.selfEffects);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {/* Action Banner */}
      <AnimatePresence>
        <motion.div
          key={`banner-${animation.actorId}-${animation.actionName}-${Date.now()}`}
          initial={{ y: -50, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -30, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          style={{
            position: 'absolute',
            top: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 110,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2.5,
              py: 1,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(0,0,0,0.85) 50%, rgba(220, 38, 38, 0.25) 100%)',
              border: '1px solid rgba(220, 38, 38, 0.4)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.6), 0 0 20px rgba(220, 38, 38, 0.15)',
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
            }}
          >
            <BossIcon size={20} color="#dc2626" />
            <Typography
              sx={{
                color: 'text.primary',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {animation.actorName}
            </Typography>
            <Typography
              sx={{
                color: 'secondary.main',
                fontWeight: 800,
                fontSize: '0.85rem',
                textShadow: '0 0 8px rgba(220, 38, 38, 0.4)',
              }}
            >
              {animation.actionName}
            </Typography>
          </Box>
        </motion.div>
      </AnimatePresence>

      {/* SVG Layer - Beams & Impact Effects */}
      {from && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <defs>
            <filter id="beam-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="impact-glow">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          {targets.map((target, i) => {
            if (!target.pos) return null;
            const color = getBeamColor(target.effects);
            const d = `M ${from.x} ${from.y} L ${target.pos.x} ${target.pos.y}`;

            return (
              <g key={i}>
                {/* Glow beam */}
                <motion.path
                  d={d}
                  stroke={color}
                  strokeWidth={10}
                  fill="none"
                  opacity={0.25}
                  filter="url(#beam-glow)"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1, opacity: [0.35, 0.3, 0] }}
                  transition={{ duration: 0.6, delay: 0.4, opacity: { duration: 2, delay: 0.4 } }}
                />
                {/* Core beam */}
                <motion.path
                  d={d}
                  stroke={target.hit ? color : '#555'}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.9 }}
                  animate={{ pathLength: 1, opacity: [0.9, 0.85, 0] }}
                  transition={{ duration: 0.55, delay: 0.4, opacity: { duration: 2, delay: 0.4 } }}
                />

                {/* Impact ring at target (after beam arrives) */}
                {showImpact && target.hit && (
                  <motion.circle
                    cx={target.pos.x}
                    cy={target.pos.y}
                    fill="none"
                    stroke={color}
                    strokeWidth={3}
                    filter="url(#impact-glow)"
                    initial={{ r: 5, opacity: 0.9 }}
                    animate={{ r: 35, opacity: 0, strokeWidth: 0.5 }}
                    transition={{ duration: 0.7 }}
                  />
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Floating Combat Text - Targets */}
      {showImpact && targets.map((target, i) => {
        if (!target.pos) return null;
        const texts = getCombatTexts(target);
        return texts.map((t, j) => (
          <motion.div
            key={`${i}-${j}`}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: -55, scale: [0.7, 1.15, 1, 0.9] }}
            transition={{ duration: 1.6, times: [0, 0.1, 0.75, 1] }}
            style={{
              position: 'absolute',
              left: target.pos.x + 28 + j * 8,
              top: target.pos.y - 14 - j * 18,
              fontWeight: 900,
              fontSize: t.text === 'MISS' || t.text === 'BLOCKED' ? '0.85rem' : '1.3rem',
              color: t.color,
              textShadow: `0 0 8px ${t.color}80, 0 2px 4px rgba(0,0,0,0.8)`,
              fontFamily: 'inherit',
              pointerEvents: 'none',
              zIndex: 120,
            }}
          >
            {t.text}
          </motion.div>
        ));
      })}

      {/* Floating Combat Text - Self Effects (on the actor) */}
      {showImpact && selfPos && selfTexts.map((t, j) => (
        <motion.div
          key={`self-${j}`}
          initial={{ opacity: 0, y: 0, scale: 0.7 }}
          animate={{ opacity: [0, 1, 1, 0], y: -50, scale: [0.7, 1.15, 1, 0.9] }}
          transition={{ duration: 1.6, times: [0, 0.1, 0.75, 1] }}
          style={{
            position: 'absolute',
            left: selfPos.x - 20,
            top: selfPos.y - 10 - j * 18,
            fontWeight: 900,
            fontSize: '1.2rem',
            color: t.color,
            textShadow: `0 0 8px ${t.color}80, 0 2px 4px rgba(0,0,0,0.8)`,
            fontFamily: 'inherit',
            pointerEvents: 'none',
            zIndex: 120,
          }}
        >
          {t.text}
        </motion.div>
      ))}
    </Box>
  );
}
