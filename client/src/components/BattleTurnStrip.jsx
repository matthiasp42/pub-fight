import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { GiVikingHelmet, GiAxeSword, GiWizardFace, GiCauldron, GiDeathSkull, GiAngularSpider } from 'react-icons/gi';
import { CHARACTER_TYPES } from '../game/types.js';

const CLASS_ICONS = {
  tank: GiVikingHelmet,
  warrior: GiAxeSword,
  wizard: GiWizardFace,
  alchemist: GiCauldron,
};

const PORTRAITS = {
  ehsan: '/portraits/ehsan.png',
  dennis: '/portraits/dennis.png',
  budde: '/portraits/budde.png',
  matthias: '/portraits/matthias.png',
};

const getIcon = (character) => {
  if (character.type === CHARACTER_TYPES.BOSS) return GiDeathSkull;
  if (character.type === CHARACTER_TYPES.MINION) return GiAngularSpider;
  return CLASS_ICONS[character.class] || GiAxeSword;
};

const getColor = (character, isCurrent) => {
  if (!character.state.isAlive) return '#444';
  if (isCurrent) return '#f59e0b';
  if (character.type === CHARACTER_TYPES.PLAYER) return '#10b981';
  return '#dc2626';
};

/**
 * Slim floating vertical turn order strip, centered on the left side.
 */
export function BattleTurnStrip({ characters, turnOrder, currentTurnIndex }) {
  const getCharacterById = (id) => characters.find((c) => c.id === id);

  return (
    <Box
      sx={{
        position: 'absolute',
        left: 8,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
        px: 0.5,
        gap: 0.5,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Title */}
      <Typography
        sx={{
          fontSize: '0.45rem',
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: 1,
          mb: 0.25,
        }}
      >
        Turn
      </Typography>

      {turnOrder.map((characterId, index) => {
        const character = getCharacterById(characterId);
        if (!character) return null;

        const isCurrent = index === currentTurnIndex;
        const color = getColor(character, isCurrent);
        const IconComp = getIcon(character);
        const isPast = index < currentTurnIndex;
        const portrait = character.type === CHARACTER_TYPES.PLAYER
          ? PORTRAITS[character.name.toLowerCase()]
          : null;

        return (
          <motion.div
            key={characterId}
            animate={isCurrent ? { scale: [1, 1.15, 1] } : {}}
            transition={isCurrent ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
          >
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isCurrent ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0,0,0,0.3)',
                backgroundImage: portrait ? `url(${portrait})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: isCurrent ? '2px solid' : '1.5px solid',
                borderColor: color,
                opacity: character.state.isAlive ? (isPast ? 0.5 : 1) : 0.25,
                boxShadow: isCurrent ? `0 0 8px ${color}60` : 'none',
                transition: 'all 0.3s ease',
              }}
              title={character.name}
            >
              {!portrait && <IconComp size={14} color={color} />}
            </Box>
          </motion.div>
        );
      })}
    </Box>
  );
}
