import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Tooltip,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ShieldIcon from '@mui/icons-material/Shield';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * @param {{
 *   skill: import('../game/types').SkillNode,
 *   status: 'owned' | 'available' | 'locked',
 *   onClick?: () => void,
 *   compact?: boolean
 * }} props
 */
export function SkillNodeCard({ skill, status, onClick, compact = false }) {
  const getBorderColor = () => {
    switch (status) {
      case 'owned':
        return '#4CAF50'; // green
      case 'available':
        return '#2196F3'; // blue
      case 'locked':
      default:
        return '#666'; // gray
    }
  };

  const getBackgroundColor = () => {
    switch (status) {
      case 'owned':
        return 'rgba(76, 175, 80, 0.1)';
      case 'available':
        return 'rgba(33, 150, 243, 0.1)';
      case 'locked':
      default:
        return 'rgba(100, 100, 100, 0.1)';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'owned':
        return <CheckCircleIcon sx={{ fontSize: 14, color: '#4CAF50' }} />;
      case 'locked':
        return <LockIcon sx={{ fontSize: 14, color: '#666' }} />;
      default:
        return null;
    }
  };

  const getTypeIcon = () => {
    if (skill.type === 'ability') {
      return <AutoFixHighIcon sx={{ fontSize: 14, color: '#ff9800' }} />;
    }
    return <ShieldIcon sx={{ fontSize: 14, color: '#9c27b0' }} />;
  };

  const getEffectSummary = () => {
    if (skill.type === 'ability' && skill.ability) {
      const { cost, effects, selfEffects } = skill.ability;
      const parts = [`${cost} AP`];

      effects.forEach((e) => {
        if (e.type === 'damage') parts.push(`${e.amount} dmg${e.piercing ? ' (pierce)' : ''}`);
        if (e.type === 'heal') parts.push(`${e.amount} heal`);
        if (e.type === 'addShield') parts.push(`+${e.amount} shield`);
        if (e.type === 'modifyAP') parts.push(`${e.amount > 0 ? '+' : ''}${e.amount} AP`);
      });

      selfEffects.forEach((e) => {
        if (e.type === 'heal') parts.push(`self +${e.amount} HP`);
        if (e.type === 'addShield') parts.push(`self +${e.amount} shield`);
      });

      return parts.join(' | ');
    }

    if (skill.type === 'passive' && skill.passive) {
      const { trigger, effect } = skill.passive;
      const triggerLabels = {
        always: 'Always',
        onHit: 'On hit',
        onTakeDamage: 'When hit',
        onLowHP: 'Low HP',
        onTurnStart: 'Turn start',
        onKill: 'On kill',
        onFightStart: 'Fight start',
        onFatalDamage: 'Fatal blow',
      };
      return triggerLabels[trigger] || trigger;
    }

    return '';
  };

  const cardContent = (
    <Card
      sx={{
        minWidth: compact ? 100 : 140,
        maxWidth: compact ? 120 : 160,
        border: `2px solid ${getBorderColor()}`,
        backgroundColor: getBackgroundColor(),
        opacity: status === 'locked' ? 0.6 : 1,
        cursor: status === 'available' && onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        '&:hover': status === 'available' && onClick ? {
          transform: 'scale(1.02)',
          boxShadow: 3,
        } : {},
      }}
      onClick={status === 'available' && onClick ? onClick : undefined}
    >
      <CardContent sx={{ p: compact ? 1 : 1.5, '&:last-child': { pb: compact ? 1 : 1.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          {getTypeIcon()}
          <Typography
            variant={compact ? 'caption' : 'body2'}
            sx={{
              fontWeight: 'bold',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {skill.name}
          </Typography>
          {getStatusIcon()}
        </Box>

        {/* Effect summary */}
        {!compact && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              fontSize: '0.65rem',
              lineHeight: 1.2,
            }}
          >
            {getEffectSummary()}
          </Typography>
        )}

        {/* Type chip */}
        <Box sx={{ mt: 0.5 }}>
          <Chip
            label={skill.type === 'ability' ? 'Ability' : 'Passive'}
            size="small"
            sx={{
              height: 16,
              fontSize: '0.6rem',
              backgroundColor: skill.type === 'ability' ? 'rgba(255, 152, 0, 0.2)' : 'rgba(156, 39, 176, 0.2)',
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {skill.name}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {skill.description}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Level {skill.levelRequired} required
            {skill.requires && ` | Requires: ${skill.requires.replace(/_/g, ' ')}`}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      {cardContent}
    </Tooltip>
  );
}
