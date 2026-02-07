import { useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { motion, useAnimationControls, AnimatePresence } from 'framer-motion';
import { GiVikingHelmet, GiAxeSword, GiWizardFace, GiCauldron, GiDeathSkull, GiAngularSpider } from 'react-icons/gi';
import { CHARACTER_TYPES } from '../game/types.js';

const CLASS_CONFIG = {
  tank: { icon: GiVikingHelmet, color: '#3b82f6' },
  warrior: { icon: GiAxeSword, color: '#dc2626' },
  wizard: { icon: GiWizardFace, color: '#a855f7' },
  alchemist: { icon: GiCauldron, color: '#10b981' },
};

const ENEMY_CONFIG = {
  [CHARACTER_TYPES.BOSS]: { icon: GiDeathSkull, color: '#dc2626' },
  [CHARACTER_TYPES.MINION]: { icon: GiAngularSpider, color: '#f97316' },
};

// Map player names (lowercase) to portrait files in /portraits/
const PORTRAITS = {
  ehsan: '/portraits/ehsan.png',
  dennis: '/portraits/dennis.png',
  budde: '/portraits/budde.png',
  matthias: '/portraits/matthias.png',
};

/**
 * Game-like character display for the battlefield.
 * Shows an avatar placeholder with overlaid HP/AP bars.
 * Outer div handles shake (x), inner div handles breathing (scale/y).
 */
export function BattleCharacter({
  character,
  isCurrentTurn,
  isEnemy,
  onClick,
  size = 'normal',
  isBeingHit = false,
  isTargetable = false,
}) {
  const { name, type, attributes, state } = character;
  const characterClass = character.class;
  const isDead = !state.isAlive;
  const healthPercent = (state.health / attributes.maxHealth) * 100;

  const config = isEnemy
    ? ENEMY_CONFIG[type] || ENEMY_CONFIG[CHARACTER_TYPES.MINION]
    : CLASS_CONFIG[characterClass] || { icon: GiAxeSword, color: '#f59e0b' };

  const IconComponent = config.icon;
  const portrait = !isEnemy ? PORTRAITS[name.toLowerCase()] : null;
  const avatarSize = size === 'boss' ? 72 : 56;
  const barWidth = avatarSize + 16;

  // Shake controls for the outer wrapper
  const shakeControls = useAnimationControls();

  useEffect(() => {
    if (isBeingHit) {
      shakeControls.start({
        x: [0, -8, 8, -5, 5, -2, 0],
        transition: { duration: 0.4 },
      });
    }
  }, [isBeingHit, shakeControls]);

  return (
    <motion.div
      data-character-id={character.id}
      animate={shakeControls}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {/* Inner div for breathing/idle animation */}
      <motion.div
        animate={
          isTargetable
            ? { scale: [1, 1.08, 1], y: [0, -3, 0] }
            : isCurrentTurn && !isDead
              ? { scale: [1, 1.05, 1], y: [0, -4, 0] }
              : { scale: 1, y: 0 }
        }
        transition={
          isTargetable
            ? { duration: 0.8, repeat: Infinity, ease: 'easeInOut' }
            : isCurrentTurn && !isDead
              ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
              : { duration: 0.3 }
        }
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        {/* Name */}
        <Typography
          variant="caption"
          sx={{
            color: isCurrentTurn ? 'primary.main' : 'text.primary',
            fontWeight: isCurrentTurn ? 800 : 600,
            fontSize: size === 'boss' ? '0.75rem' : '0.65rem',
            textAlign: 'center',
            maxWidth: barWidth + 20,
            wordBreak: 'break-word',
            lineHeight: 1.2,
            mb: 0.5,
            textShadow: '0 1px 4px rgba(0,0,0,0.8)',
          }}
        >
          {name}
        </Typography>

        {/* Avatar */}
        <Box
          sx={{
            position: 'relative',
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...(portrait
              ? {
                  backgroundImage: `url(${portrait})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : {
                  background: isDead
                    ? 'radial-gradient(circle, #333 0%, #1a1a1a 100%)'
                    : isEnemy
                      ? 'radial-gradient(circle, #3d1515 0%, #1a0808 100%)'
                      : 'radial-gradient(circle, #1a2a1a 0%, #0a1a0a 100%)',
                }),
            border: isDead
              ? '2px solid #444'
              : isTargetable
                ? '3px solid'
                : isCurrentTurn
                  ? '3px solid'
                  : '2px solid',
            borderColor: isDead
              ? '#444'
              : isTargetable
                ? '#f59e0b'
                : isCurrentTurn
                  ? 'primary.main'
                  : isEnemy
                    ? 'rgba(220, 38, 38, 0.6)'
                    : 'rgba(16, 185, 129, 0.4)',
            boxShadow: isDead
              ? 'none'
              : isTargetable
                ? '0 0 16px rgba(245, 158, 11, 0.6), 0 0 32px rgba(245, 158, 11, 0.3)'
                : isCurrentTurn
                  ? '0 0 20px rgba(245, 158, 11, 0.6), 0 0 40px rgba(245, 158, 11, 0.3), inset 0 0 15px rgba(245, 158, 11, 0.15)'
                  : isEnemy
                    ? '0 0 10px rgba(220, 38, 38, 0.2)'
                    : '0 0 10px rgba(16, 185, 129, 0.15)',
            opacity: isDead ? 0.4 : 1,
            filter: isDead ? 'grayscale(0.8)' : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          {portrait ? (
            <Box
              sx={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 20,
                height: 20,
                borderRadius: '50%',
                backgroundColor: 'rgba(0,0,0,0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `1.5px solid ${config.color}`,
                zIndex: 2,
              }}
            >
              <IconComponent size={12} color={config.color} />
            </Box>
          ) : (
            <IconComponent
              size={avatarSize * 0.5}
              color={isDead ? '#555' : config.color}
              style={{ filter: isDead ? 'none' : `drop-shadow(0 0 4px ${config.color}40)` }}
            />
          )}

          {/* Shield diamonds — filled for active, outlined for empty */}
          {attributes.shieldCapacity > 0 && !isDead && (
            <Box
              sx={{
                position: 'absolute',
                top: -5,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '2px',
                zIndex: 3,
              }}
            >
              {Array.from({ length: attributes.shieldCapacity }, (_, i) => {
                const active = i < state.shield;
                return (
                  <Box
                    key={i}
                    sx={{
                      width: 8,
                      height: 8,
                      transform: 'rotate(45deg)',
                      border: '1.5px solid',
                      borderColor: active ? '#60a5fa' : 'rgba(59, 130, 246, 0.5)',
                      backgroundColor: active ? '#3b82f6' : 'rgba(10, 15, 30, 0.7)',
                      boxShadow: active
                        ? '0 0 5px rgba(59, 130, 246, 0.8), inset 0 0 2px rgba(255,255,255,0.2)'
                        : 'inset 0 0 2px rgba(0,0,0,0.4)',
                      transition: 'all 0.3s ease',
                    }}
                  />
                );
              })}
            </Box>
          )}

          {/* Red flash on hit */}
          <AnimatePresence>
            {isBeingHit && (
              <motion.div
                initial={{ opacity: 0.6 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{
                  position: 'absolute',
                  inset: -6,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(220, 38, 38, 0.5) 0%, transparent 70%)',
                  pointerEvents: 'none',
                }}
              />
            )}
          </AnimatePresence>

          {/* Dead X overlay */}
          {isDead && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ fontSize: avatarSize * 0.6, color: '#dc2626', fontWeight: 900, lineHeight: 1, opacity: 0.7 }}>
                X
              </Typography>
            </Box>
          )}
        </Box>

        {/* HP Bar */}
        <Box sx={{ width: barWidth, mt: 0.5 }}>
          <Box
            sx={{
              width: '100%',
              height: 5,
              borderRadius: 3,
              backgroundColor: 'rgba(0,0,0,0.6)',
              overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <Box
              sx={{
                width: `${healthPercent}%`,
                height: '100%',
                borderRadius: 3,
                background: healthPercent > 50
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : healthPercent > 25
                    ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                    : 'linear-gradient(90deg, #b91c1c, #dc2626)',
                transition: 'width 0.4s ease',
                boxShadow: healthPercent > 25
                  ? '0 0 4px rgba(16, 185, 129, 0.4)'
                  : '0 0 4px rgba(220, 38, 38, 0.4)',
              }}
            />
          </Box>
          <Typography
            sx={{
              fontSize: '0.5rem',
              color: 'text.secondary',
              textAlign: 'center',
              mt: 0.125,
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            {state.health}/{attributes.maxHealth}
          </Typography>
        </Box>

        {/* AP pips — hidden for enemies (they refill each turn) */}
        {!isEnemy && (
          <Box sx={{ display: 'flex', gap: '3px', justifyContent: 'center', mt: 0.25 }}>
            {Array.from({ length: attributes.maxAP }, (_, i) => (
              <Box
                key={i}
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: i < state.ap ? 'rgba(220, 38, 38, 0.8)' : 'rgba(220, 38, 38, 0.25)',
                  backgroundColor: i < state.ap ? 'rgba(220, 38, 38, 0.9)' : 'transparent',
                  boxShadow: i < state.ap ? '0 0 3px rgba(220, 38, 38, 0.4)' : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
            ))}
          </Box>
        )}

        {/* Ground shadow / pedestal */}
        {!isDead && (
          <Box
            sx={{
              width: avatarSize * 0.8,
              height: 4,
              borderRadius: '50%',
              background: isCurrentTurn
                ? 'radial-gradient(ellipse, rgba(245, 158, 11, 0.3) 0%, transparent 70%)'
                : 'radial-gradient(ellipse, rgba(255,255,255,0.08) 0%, transparent 70%)',
              mt: 0.25,
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
