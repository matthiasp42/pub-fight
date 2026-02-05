import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  Paper,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import BoltIcon from '@mui/icons-material/Bolt';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { EFFECT_TYPES } from '../game/types.js';

/**
 * @param {{
 *   open: boolean,
 *   actionResult: import('../game/types.js').ActionResult | null,
 *   actorName: string,
 *   onContinue: () => void
 * }} props
 */
export function ActionPopover({ open, actionResult, actorName, onContinue }) {
  if (!actionResult) return null;

  const formatEffect = (effect) => {
    switch (effect.type) {
      case EFFECT_TYPES.DAMAGE:
        return (
          <Box sx={{ pl: 2, borderLeft: '3px solid #ff4444' }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#ff4444' }}>
              {effect.amount} damage
            </Typography>
            {effect.shieldPointsDestroyed > 0 && (
              <Typography variant="body2" color="text.secondary">
                Shield absorbed: {effect.shieldDamageAbsorbed} ({effect.shieldPointsDestroyed} shield point{effect.shieldPointsDestroyed > 1 ? 's' : ''} destroyed)
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: effect.healthDamage > 0 ? '#ff4444' : '#4CAF50' }}>
              HP damage: {effect.healthDamage}
            </Typography>
          </Box>
        );

      case EFFECT_TYPES.HEAL:
        return (
          <Box sx={{ pl: 2, borderLeft: '3px solid #4CAF50' }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
              +{effect.amount} HP healed
            </Typography>
          </Box>
        );

      case EFFECT_TYPES.ADD_SHIELD:
        return (
          <Box sx={{ pl: 2, borderLeft: '3px solid #9c27b0' }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#9c27b0' }}>
              +{effect.amount} shield point{effect.amount > 1 ? 's' : ''}
            </Typography>
          </Box>
        );

      case EFFECT_TYPES.MODIFY_AP:
        return (
          <Box sx={{ pl: 2, borderLeft: '3px solid #2196F3' }}>
            <Typography variant="body1" sx={{ fontWeight: 'bold', color: '#2196F3' }}>
              {effect.amount >= 0 ? '+' : ''}{effect.amount} AP
            </Typography>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" component="span">
            {actorName}
          </Typography>
          <ArrowForwardIcon />
          <Chip
            label={actionResult.actionName}
            color="primary"
            sx={{ fontSize: '1rem', fontWeight: 'bold' }}
          />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 2 }}>
        {/* Step 1: Cost */}
        <Paper elevation={2} sx={{ p: 2, mb: 2, backgroundColor: 'rgba(33, 150, 243, 0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <BoltIcon sx={{ color: '#2196F3' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Step 1: Deduct Cost
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ color: '#2196F3', ml: 4 }}>
            -{actionResult.apDeducted} AP
          </Typography>
        </Paper>

        {/* Step 2: Target Resolution & Effects */}
        <Paper elevation={2} sx={{ p: 2, mb: 2, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <GpsFixedIcon sx={{ color: '#ff9800' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Step 2: Resolve Targets & Apply Effects
            </Typography>
          </Box>

          {/* Wheel Results */}
          {actionResult.wheelResults?.length > 0 && (
            <Box sx={{ mb: 2, ml: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Attack Wheel Spins:
              </Typography>
              {actionResult.wheelResults.map((wr, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  {wr.target ? (
                    <>
                      <CheckCircleIcon sx={{ color: '#4CAF50', fontSize: 18 }} />
                      <Typography variant="body1">
                        Hit <strong>{wr.target.name}</strong>
                      </Typography>
                    </>
                  ) : (
                    <>
                      <CancelIcon sx={{ color: '#f44336', fontSize: 18 }} />
                      <Typography variant="body1" color="error">
                        Miss!
                      </Typography>
                    </>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Target Effects */}
          {actionResult.targetResults.length > 0 ? (
            <Box sx={{ ml: 4 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Effects Applied:
              </Typography>
              {actionResult.targetResults.map((tr, i) => (
                <Box
                  key={i}
                  sx={{
                    mb: 2,
                    p: 1.5,
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: 1
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                    Target: {tr.targetName}
                  </Typography>
                  {tr.effects.map((effect, j) => (
                    <Box key={j} sx={{ mt: 1 }}>
                      {formatEffect(effect)}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          ) : (
            <Box sx={{ ml: 4 }}>
              <Typography variant="body1" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No targets hit (all attacks missed)
              </Typography>
            </Box>
          )}

          {/* Self Effects */}
          {actionResult.selfResults.length > 0 && (
            <Box sx={{ ml: 4, mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Effects on Self:
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  backgroundColor: 'rgba(0,0,0,0.2)',
                  borderRadius: 1
                }}
              >
                <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Self: {actorName}
                </Typography>
                {actionResult.selfResults.map((effect, j) => (
                  <Box key={j} sx={{ mt: 1 }}>
                    {formatEffect(effect)}
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Step 3: State Updated */}
        <Paper elevation={2} sx={{ p: 2, backgroundColor: 'rgba(76, 175, 80, 0.1)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ color: '#4CAF50' }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Step 3: State Updated
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
            Game state has been updated. Click Continue for the next turn.
          </Typography>
        </Paper>
      </DialogContent>

      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button
          variant="contained"
          onClick={onContinue}
          size="large"
          autoFocus
        >
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
