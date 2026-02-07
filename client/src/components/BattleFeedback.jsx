import { useEffect, useState, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { GiDeathSkull, GiAngularSpider, GiSwordWound } from 'react-icons/gi';
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

/** Build compact effect summary tags for the action banner */
function getBannerTags(targetResults, selfEffects) {
  const tags = [];
  const hits = (targetResults || []).filter(tr => tr.hit !== false);
  const misses = (targetResults || []).filter(tr => tr.hit === false);

  // Target damage
  const dmgEffects = hits.flatMap(tr =>
    (tr.effects || []).filter(e => e.type === EFFECT_TYPES.DAMAGE && e.amount > 0)
  );
  if (dmgEffects.length > 0) {
    const dmgPerHit = dmgEffects[0].amount;
    if (hits.length > 1) {
      tags.push({ text: `${dmgPerHit} dmg`, color: '#ff6b6b' });
      tags.push({ text: `${hits.length} targets`, color: '#a8a095' });
    } else if (hits.length === 1) {
      tags.push({ text: `${dmgPerHit} dmg`, color: '#ff6b6b' });
      tags.push({ text: hits[0].targetName, color: '#a8a095' });
    }
  }

  // Target heal
  const healEffects = hits.flatMap(tr =>
    (tr.effects || []).filter(e => e.type === EFFECT_TYPES.HEAL && e.amount > 0)
  );
  if (healEffects.length > 0) {
    tags.push({ text: `+${healEffects[0].amount} HP`, color: '#34d399' });
    if (hits.length === 1) {
      tags.push({ text: hits[0].targetName, color: '#a8a095' });
    }
  }

  // Target shield
  const shieldEffects = hits.flatMap(tr =>
    (tr.effects || []).filter(e => e.type === EFFECT_TYPES.ADD_SHIELD && e.amount > 0)
  );
  if (shieldEffects.length > 0) {
    tags.push({ text: `+${shieldEffects[0].amount} shield`, color: '#c084fc' });
  }

  // Target AP modify
  const apEffects = hits.flatMap(tr =>
    (tr.effects || []).filter(e => e.type === EFFECT_TYPES.MODIFY_AP)
  );
  if (apEffects.length > 0) {
    const amt = apEffects[0].amount;
    tags.push({ text: `${amt > 0 ? '+' : ''}${amt} AP`, color: '#60a5fa' });
  }

  // Misses
  if (misses.length > 0 && hits.length === 0) {
    tags.push({ text: 'MISS', color: '#666' });
  }

  // Self effects
  for (const e of (selfEffects || [])) {
    if (e.type === EFFECT_TYPES.HEAL && e.amount > 0) {
      tags.push({ text: `self +${e.amount} HP`, color: '#34d399' });
    } else if (e.type === EFFECT_TYPES.ADD_SHIELD && e.amount > 0) {
      tags.push({ text: `self +${e.amount} shield`, color: '#c084fc' });
    } else if (e.type === EFFECT_TYPES.SPAWN_MINION) {
      const names = (e.spawnedMinions || []).map(m => m.name);
      const label = names.length > 0 ? names.join(', ') : (e.amount > 1 ? `${e.amount} minions` : 'minion');
      tags.push({ text: `spawns ${label}`, color: '#f59e0b' });
    } else if (e.type === EFFECT_TYPES.MODIFY_AP) {
      tags.push({ text: `self ${e.amount > 0 ? '+' : ''}${e.amount} AP`, color: '#60a5fa' });
    }
  }

  return tags;
}

/**
 * Full-screen overlay for battle animations.
 * Renders: action banner, SVG beams, impact effects, floating combat text.
 *
 * @param {{ animation: object|null, showImpact: boolean }} props
 * animation shape: { actorId, actorName, actorType, actionName, targetResults, selfEffects }
 */
export function BattleFeedback({ animation, showImpact, isPlayerAction }) {
  const [positions, setPositions] = useState({ from: null, targets: [], self: null });
  const bannerKeyRef = useRef(0);
  const prevAnimRef = useRef(null);

  // Increment banner key only when animation identity actually changes
  if (animation && (
    animation.actorId !== prevAnimRef.current?.actorId ||
    animation.actionName !== prevAnimRef.current?.actionName ||
    animation !== prevAnimRef.current
  )) {
    // Only increment if this is genuinely a new animation, not a re-render
    if (prevAnimRef.current !== animation) {
      bannerKeyRef.current++;
      prevAnimRef.current = animation;
    }
  }
  if (!animation) {
    prevAnimRef.current = null;
  }

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
  const BannerIcon = isPlayerAction
    ? GiSwordWound
    : animation.actorType === CHARACTER_TYPES.MINION ? GiAngularSpider : GiDeathSkull;
  const bannerColor = isPlayerAction ? '#f59e0b' : '#dc2626';
  const selfTexts = getSelfCombatTexts(animation.selfEffects);
  const bannerTags = getBannerTags(animation.targetResults, animation.selfEffects);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {/* Action Banner — full-width cinematic stripe */}
      <AnimatePresence mode="wait">
        {animation && (
          <motion.div
            key={bannerKeyRef.current}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '8%',
              left: 0,
              right: 0,
              zIndex: 110,
              display: 'flex',
              justifyContent: 'center',
              transformOrigin: 'center center',
            }}
          >
            <Box
              sx={{
                width: '100%',
                maxWidth: 420,
                mx: 'auto',
                textAlign: 'center',
                py: 1.5,
                px: 3,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Background gradient bar */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(90deg, transparent, ${bannerColor}18 20%, rgba(0,0,0,0.88) 40%, rgba(0,0,0,0.88) 60%, ${bannerColor}18 80%, transparent)`,
                  borderTop: `1px solid ${bannerColor}55`,
                  borderBottom: `1px solid ${bannerColor}55`,
                }}
              />
              {/* Accent glow line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '15%',
                  right: '15%',
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${bannerColor}, transparent)`,
                  transformOrigin: 'center',
                }}
              />
              {/* Content */}
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                {/* Actor name */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.3 }}>
                  <BannerIcon size={14} color={`${bannerColor}aa`} />
                  <Typography
                    sx={{
                      color: `${bannerColor}cc`,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                    }}
                  >
                    {animation.actorName}
                  </Typography>
                </Box>
                {/* Action name — big and bold */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                >
                  <Typography
                    sx={{
                      color: 'text.primary',
                      fontWeight: 900,
                      fontSize: '1.25rem',
                      lineHeight: 1.2,
                      textShadow: `0 0 16px ${bannerColor}66, 0 2px 4px rgba(0,0,0,0.8)`,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {animation.actionName}
                  </Typography>
                </motion.div>
                {/* Effect summary tags */}
                {bannerTags.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    {bannerTags.map((tag, i) => (
                      <Typography
                        key={i}
                        component="span"
                        sx={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: tag.color,
                          textShadow: `0 0 6px ${tag.color}44`,
                          lineHeight: 1,
                          '&:not(:last-child)::after': {
                            content: '"·"',
                            ml: '6px',
                            color: 'rgba(168, 160, 149, 0.3)',
                          },
                        }}
                      >
                        {tag.text}
                      </Typography>
                    ))}
                  </motion.div>
                )}
              </Box>
              {/* Bottom glow line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '15%',
                  right: '15%',
                  height: 1,
                  background: `linear-gradient(90deg, transparent, ${bannerColor}, transparent)`,
                  transformOrigin: 'center',
                }}
              />
            </Box>
          </motion.div>
        )}
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
