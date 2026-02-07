import { Box, Paper, Typography, Avatar } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import BugReportIcon from '@mui/icons-material/BugReport';
import PestControlIcon from '@mui/icons-material/PestControl';
import { CHARACTER_TYPES } from '../game/types.js';

/**
 * @param {{
 *   characters: import('../game/types.js').Character[],
 *   turnOrder: string[],
 *   currentTurnIndex: number
 * }} props
 */
export function TurnBar({ characters, turnOrder, currentTurnIndex }) {
  const getCharacterById = (id) => characters.find((c) => c.id === id);

  const getIcon = (type) => {
    switch (type) {
      case CHARACTER_TYPES.BOSS:
        return <BugReportIcon />;
      case CHARACTER_TYPES.MINION:
        return <PestControlIcon />;
      default:
        return <PersonIcon />;
    }
  };

  const getColor = (character, index) => {
    if (!character.state.isAlive) return '#666';
    if (index === currentTurnIndex) return '#ffd700';
    if (character.type === CHARACTER_TYPES.PLAYER) return '#4CAF50';
    return '#ff4444';
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 2,
        minWidth: 80,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          color: '#fff',
          textAlign: 'center',
          mb: 2,
          fontWeight: 'bold',
          borderBottom: '1px solid #444',
          pb: 1,
        }}
      >
        Turn Order
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {turnOrder.map((characterId, index) => {
          const character = getCharacterById(characterId);
          if (!character) return null;

          const isCurrent = index === currentTurnIndex;
          const color = getColor(character, index);

          return (
            <Box
              key={characterId}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                backgroundColor: isCurrent ? 'rgba(255, 215, 0, 0.2)' : 'transparent',
                border: isCurrent ? '2px solid #ffd700' : '2px solid transparent',
                opacity: character.state.isAlive ? 1 : 0.4,
                transition: 'all 0.3s ease',
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  backgroundColor: color,
                  border: isCurrent ? '2px solid #fff' : 'none',
                }}
              >
                {getIcon(character.type)}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#fff',
                    display: 'block',
                    fontWeight: isCurrent ? 'bold' : 'normal',
                    wordBreak: 'break-word',
                    lineHeight: 1.2,
                  }}
                >
                  {character.name}
                </Typography>
                {!character.state.isAlive && (
                  <Typography variant="caption" sx={{ color: '#ff4444', fontSize: '0.65rem' }}>
                    KO
                  </Typography>
                )}
              </Box>
              {isCurrent && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#ffd700',
                    animation: 'pulse 1s infinite',
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                      '100%': { opacity: 1 },
                    },
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
