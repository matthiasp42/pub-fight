import { Dialog, DialogContent, Box, Typography, IconButton, Chip } from '@mui/material';
import { LuX } from 'react-icons/lu';
import {
  GiDeathSkull,
  GiAngularSpider,
  GiSwordWound,
  GiShield,
  GiHearts,
  GiPowerLightning,
  GiBullseye,
  GiRunningNinja,
  GiShieldBounces,
} from 'react-icons/gi';
import { CHARACTER_TYPES } from '../game/types.js';

const TARGET_LABELS = {
  random: 'Random target',
  allParty: 'All heroes',
  allEnemies: 'All enemies',
  self: 'Self',
  manual: 'Single target',
};

function describeEffect(effect) {
  switch (effect.type) {
    case 'damage':
      return {
        text: `${effect.amount} ${effect.piercing ? 'piercing ' : ''}dmg`,
        color: '#ff6b6b',
      };
    case 'heal':
      return {
        text: effect.drain ? `Drain ${effect.amount} HP` : `Heal ${effect.amount}`,
        color: '#34d399',
      };
    case 'addShield':
      return { text: `+${effect.amount} shield`, color: '#c084fc' };
    case 'removeShield':
      return { text: 'Strip shield', color: '#f97316' };
    case 'modifyAP':
      return {
        text: `${effect.amount > 0 ? '+' : ''}${effect.amount} AP`,
        color: '#60a5fa',
      };
    case 'spawnMinion':
      return { text: 'Summon minion', color: '#f59e0b' };
    default:
      return { text: effect.type, color: '#a8a095' };
  }
}

function AbilityRow({ action, power }) {
  const allEffects = [
    ...(action.effects || []).map(e => ({ ...e, isSelf: false })),
    ...(action.selfEffects || []).map(e => ({ ...e, isSelf: true })),
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        py: 1,
        '&:not(:last-child)': {
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        },
      }}
    >
      {/* Name + cost row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.primary', flex: 1 }}>
          {action.name}
        </Typography>
        <Chip
          label={`${action.cost} AP`}
          size="small"
          sx={{
            height: 20,
            fontSize: '0.65rem',
            fontWeight: 700,
            backgroundColor: 'rgba(220, 38, 38, 0.15)',
            color: '#ff6b6b',
            border: '1px solid rgba(220, 38, 38, 0.3)',
          }}
        />
      </Box>

      {/* Caption: target type + hits */}
      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
        {TARGET_LABELS[action.targetType] || action.targetType}
        {action.hits > 1 ? ` · ${action.hits} hits` : ''}
      </Typography>

      {/* Effect tags */}
      {allEffects.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
          {allEffects.map((effect, i) => {
            const desc = describeEffect(effect);
            // Add power bonus display for damage effects
            const powerBonus = effect.type === 'damage' && power > 0
              ? ` (+${power})`
              : '';
            return (
              <Box
                key={i}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${desc.color}30`,
                }}
              >
                <Typography sx={{ fontSize: '0.65rem', color: desc.color, fontWeight: 600 }}>
                  {effect.isSelf ? '(self) ' : ''}
                  {desc.text}{powerBonus}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export function EnemyInfoDialog({ open, onClose, character }) {
  if (!character) return null;

  const { name, type, attributes, state, actions } = character;
  const isBoss = type === CHARACTER_TYPES.BOSS;
  const accentColor = isBoss ? '#dc2626' : '#f97316';
  const Icon = isBoss ? GiDeathSkull : GiAngularSpider;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
          borderRadius: 3,
          border: `1px solid ${accentColor}40`,
          maxHeight: '80dvh',
        },
      }}
    >
      <DialogContent sx={{ p: 2, pt: 1.5 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isBoss
                ? 'radial-gradient(circle, #3d1515 0%, #1a0808 100%)'
                : 'radial-gradient(circle, #3d2a15 0%, #1a1008 100%)',
              border: `2px solid ${accentColor}80`,
              flexShrink: 0,
            }}
          >
            <Icon size={24} color={accentColor} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'text.primary', lineHeight: 1.2 }}>
              {name}
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1 }}>
              {isBoss ? 'Boss' : 'Minion'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <LuX size={18} />
          </IconButton>
        </Box>

        {/* Stats row */}
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            mb: 1.5,
            p: 1,
            borderRadius: 2,
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        >
          {[
            { icon: GiHearts, label: 'HP', value: `${state.health}/${attributes.maxHealth}`, color: '#10b981' },
            { icon: GiPowerLightning, label: 'AP', value: `${attributes.maxAP}`, color: '#dc2626' },
            { icon: GiSwordWound, label: 'Pow', value: `${attributes.power}`, color: '#f59e0b' },
            { icon: GiBullseye, label: 'Dex', value: `${attributes.dexterity}`, color: '#60a5fa' },
            { icon: GiRunningNinja, label: 'Eva', value: `${attributes.evasiveness}`, color: '#a855f7' },
            ...(attributes.shieldCapacity > 0
              ? [{ icon: GiShieldBounces, label: 'Shield', value: `${state.shield}/${attributes.shieldCapacity}`, color: '#3b82f6' }]
              : []),
          ].map(({ icon: StatIcon, label, value, color }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StatIcon size={12} color={color} />
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{label}</Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
            </Box>
          ))}
        </Box>

        {/* Abilities */}
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1, mb: 0.5 }}>
          Abilities
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {(actions || []).map(action => (
            <AbilityRow key={action.id} action={action} power={attributes.power} />
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
