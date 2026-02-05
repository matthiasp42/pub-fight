import {
  Card,
  CardContent,
  Typography,
  Box,
  LinearProgress,
  Chip,
  Button,
  Stack,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import BoltIcon from '@mui/icons-material/Bolt';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { CHARACTER_TYPES } from '../game/types.js';
import { canExecuteAction } from '../game/engine.js';

const CLASS_ICONS = {
  tank: '\u{1F6E1}',
  wizard: '\u{1F9D9}',
  alchemist: '\u{1F9EA}',
  warrior: '\u{2694}',
};

/**
 * @param {{
 *   character: import('../game/types.js').Character,
 *   isCurrentTurn: boolean,
 *   onAction?: (actionId: string) => void,
 *   showActions?: boolean,
 *   onOpenSkills?: () => void,
 *   ownedSkillCount?: number,
 *   perkPoints?: number
 * }} props
 */
export function CharacterCard({
  character,
  isCurrentTurn,
  onAction,
  showActions = false,
  onOpenSkills,
  ownedSkillCount = 0,
  perkPoints = 0,
}) {
  const { name, type, attributes, state, actions } = character;
  const characterClass = character.class;
  const isEnemy = type === CHARACTER_TYPES.BOSS || type === CHARACTER_TYPES.MINION;

  const healthPercent = (state.health / attributes.maxHealth) * 100;
  const apPercent = (state.ap / attributes.maxAP) * 100;

  const getBorderColor = () => {
    if (!state.isAlive) return '#666';
    if (isCurrentTurn) return '#ffd700';
    if (isEnemy) return '#ff4444';
    return '#4CAF50';
  };

  const getTypeLabel = () => {
    switch (type) {
      case CHARACTER_TYPES.BOSS:
        return 'BOSS';
      case CHARACTER_TYPES.MINION:
        return 'Minion';
      default:
        return 'Player';
    }
  };

  return (
    <Card
      sx={{
        minWidth: 200,
        maxWidth: 280,
        border: `3px solid ${getBorderColor()}`,
        opacity: state.isAlive ? 1 : 0.5,
        backgroundColor: isCurrentTurn ? 'rgba(255, 215, 0, 0.1)' : 'background.paper',
        transition: 'all 0.3s ease',
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
            {name}
          </Typography>
          <Chip
            label={getTypeLabel()}
            size="small"
            color={isEnemy ? 'error' : 'success'}
            variant="outlined"
          />
        </Box>

        {/* Health Bar */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <FavoriteIcon sx={{ fontSize: 16, color: '#ff4444' }} />
            <Typography variant="caption" color="text.secondary">
              HP: {state.health} / {attributes.maxHealth}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={healthPercent}
            sx={{
              height: 8,
              borderRadius: 1,
              backgroundColor: '#333',
              '& .MuiLinearProgress-bar': {
                backgroundColor: healthPercent > 30 ? '#4CAF50' : '#ff4444',
              },
            }}
          />
        </Box>

        {/* AP Bar */}
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <BoltIcon sx={{ fontSize: 16, color: '#2196F3' }} />
            <Typography variant="caption" color="text.secondary">
              AP: {state.ap} / {attributes.maxAP}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={apPercent}
            sx={{
              height: 6,
              borderRadius: 1,
              backgroundColor: '#333',
              '& .MuiLinearProgress-bar': {
                backgroundColor: '#2196F3',
              },
            }}
          />
        </Box>

        {/* Shield */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <ShieldIcon sx={{ fontSize: 16, color: '#9c27b0' }} />
          <Typography variant="caption" color="text.secondary">
            Shield: {state.shield} / {attributes.shieldCapacity} (Str: {attributes.shieldStrength})
          </Typography>
        </Box>

        {/* Stats */}
        <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Chip label={`DEX: ${attributes.dexterity}`} size="small" variant="outlined" />
          <Chip label={`EVA: ${attributes.evasiveness}`} size="small" variant="outlined" />
        </Box>

        {/* Class & Skills (only for players) */}
        {type === CHARACTER_TYPES.PLAYER && characterClass && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={`${CLASS_ICONS[characterClass] || ''} ${characterClass}`}
              size="small"
              sx={{ textTransform: 'capitalize' }}
            />
            {onOpenSkills && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<AutoFixHighIcon sx={{ fontSize: 14 }} />}
                onClick={onOpenSkills}
                sx={{
                  fontSize: '0.7rem',
                  py: 0,
                  minHeight: 24,
                  borderColor: perkPoints > 0 ? '#ff9800' : undefined,
                  color: perkPoints > 0 ? '#ff9800' : undefined,
                }}
              >
                Skills ({ownedSkillCount})
                {perkPoints > 0 && ` +${perkPoints}`}
              </Button>
            )}
          </Box>
        )}

        {/* Dead overlay */}
        {!state.isAlive && (
          <Typography
            variant="h5"
            sx={{
              color: '#ff4444',
              textAlign: 'center',
              fontWeight: 'bold',
              textTransform: 'uppercase',
            }}
          >
            KNOCKED OUT
          </Typography>
        )}

        {/* Actions */}
        {showActions && state.isAlive && isCurrentTurn && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            {actions.map((action) => {
              const check = canExecuteAction(character, action);
              return (
                <Button
                  key={action.id}
                  variant="contained"
                  size="small"
                  disabled={!check.canExecute}
                  onClick={() => onAction?.(action.id)}
                  sx={{ flex: 1 }}
                >
                  {action.name} ({action.cost} AP)
                </Button>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
