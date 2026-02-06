import { Box, Typography } from '@mui/material';
import { GiSwordWound, GiShield } from 'react-icons/gi';
import { LuCheck } from 'react-icons/lu';

const STATUS_STYLES = {
  owned: {
    border: '1.5px solid #4CAF50',
    bg: 'rgba(76, 175, 80, 0.12)',
  },
  available: {
    border: '1.5px solid #3b82f6',
    bg: 'rgba(59, 130, 246, 0.12)',
  },
  locked: {
    border: '1.5px solid rgba(168, 160, 149, 0.15)',
    bg: 'rgba(100, 100, 100, 0.06)',
  },
};

const TYPE_COLORS = {
  ability: '#f59e0b',
  passive: '#a855f6',
};

export function SkillNodeCard({ skill, status, onClick }) {
  const s = STATUS_STYLES[status];

  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.75,
        borderRadius: '10px',
        border: s.border,
        backgroundColor: s.bg,
        opacity: status === 'locked' ? 0.4 : 1,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': {
          opacity: status === 'locked' ? 0.6 : 1,
          transform: 'scale(1.05)',
        },
      }}
    >
      <Box sx={{ color: TYPE_COLORS[skill.type], display: 'flex', flexShrink: 0 }}>
        {skill.type === 'ability'
          ? <GiSwordWound size={14} />
          : <GiShield size={14} />
        }
      </Box>
      <Typography
        sx={{
          fontSize: '0.78rem',
          fontWeight: 600,
          lineHeight: 1.2,
          color: status === 'locked' ? 'text.secondary' : 'text.primary',
          maxWidth: 80,
          textWrap: 'balance',
        }}
      >
        {skill.name}
      </Typography>
      {status === 'owned' && (
        <LuCheck size={12} style={{ color: '#4CAF50', flexShrink: 0 }} />
      )}
    </Box>
  );
}
