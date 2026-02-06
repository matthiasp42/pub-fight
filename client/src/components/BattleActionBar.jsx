import { Box, Typography, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { canExecuteAction } from '../game/engine.js';

/**
 * Bottom action bar for the fight screen.
 * Shows action buttons when it's your turn, waiting message otherwise.
 */
export function BattleActionBar({
  isMyTurn,
  currentCharacter,
  myPlayer,
  fightOver,
  fightResult,
  onAction,
  onRetry,
  posting,
}) {
  // Fight over state
  if (fightOver) {
    const isVictory = fightResult === 'victory';
    return (
      <Box
        sx={{
          px: 2,
          py: 1.5,
          background: isVictory
            ? 'linear-gradient(0deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.05) 100%)'
            : 'linear-gradient(0deg, rgba(220, 38, 38, 0.25) 0%, rgba(220, 38, 38, 0.05) 100%)',
          borderTop: `2px solid ${isVictory ? 'rgba(16, 185, 129, 0.4)' : 'rgba(220, 38, 38, 0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <Typography
          sx={{
            color: isVictory ? 'success.main' : 'secondary.main',
            fontWeight: 800,
            fontSize: '1rem',
            textShadow: `0 0 10px ${isVictory ? 'rgba(16, 185, 129, 0.5)' : 'rgba(220, 38, 38, 0.5)'}`,
          }}
        >
          {isVictory ? 'VICTORY!' : 'DEFEAT'}
        </Typography>
        {!isVictory && (
          <Button
            variant="contained"
            size="small"
            color="secondary"
            onClick={onRetry}
            sx={{ fontWeight: 700, minHeight: 36 }}
          >
            Retry
          </Button>
        )}
      </Box>
    );
  }

  if (!currentCharacter) return null;

  // Not my turn - waiting message
  if (!isMyTurn) {
    return (
      <Box
        sx={{
          px: 2,
          py: 1.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.4) 0%, transparent 100%)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
          >
            Waiting for {currentCharacter.name}...
          </Typography>
        </motion.div>
      </Box>
    );
  }

  // My turn - show actions
  const playerChar = currentCharacter;
  const actions = playerChar.actions || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <Box
          sx={{
            px: 1.5,
            py: 1,
            background: 'linear-gradient(0deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.02) 100%)',
            borderTop: '2px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          {/* Your Turn indicator */}
          <Typography
            sx={{
              color: 'primary.main',
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              textAlign: 'center',
              mb: 0.75,
              textShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
            }}
          >
            Your Turn &mdash; AP: {playerChar.state.ap}/{playerChar.attributes.maxAP}
          </Typography>

          {/* Action buttons */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {actions.map((action) => {
              const check = canExecuteAction(playerChar, action);
              return (
                <Button
                  key={action.id}
                  variant="contained"
                  disabled={!check.canExecute || posting}
                  onClick={() => onAction(action.id)}
                  sx={{
                    flex: '1 1 0',
                    maxWidth: 120,
                    minHeight: 44,
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    background: check.canExecute
                      ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(245, 158, 11, 0.15) 100%)'
                      : undefined,
                    borderColor: 'rgba(245, 158, 11, 0.4)',
                    color: check.canExecute ? 'primary.main' : 'text.secondary',
                    border: '1px solid',
                    '&:hover': {
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.45) 0%, rgba(245, 158, 11, 0.25) 100%)',
                    },
                    '&.Mui-disabled': {
                      borderColor: 'rgba(255,255,255,0.08)',
                      color: 'rgba(168, 160, 149, 0.4)',
                    },
                    flexDirection: 'column',
                    gap: 0,
                    lineHeight: 1.2,
                  }}
                >
                  <span>{action.name}</span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.7 }}>{action.cost} AP</span>
                </Button>
              );
            })}

          </Box>
        </Box>
      </motion.div>
    </AnimatePresence>
  );
}
