import { useState, useEffect, useCallback, useRef } from 'react';
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
import { AttackWheel } from './AttackWheel.jsx';

/**
 * @param {{
 *   open: boolean,
 *   actionResult: import('../game/types.js').ActionResult | null,
 *   attacker: import('../game/types.js').Character | null,
 *   allCharacters: import('../game/types.js').Character[],
 *   onContinue: () => void
 * }} props
 */
export function ActionPopover({ open, actionResult, attacker, allCharacters, onContinue }) {
  const hasWheel = actionResult?.wheelResults?.length > 0;
  const totalSpins = hasWheel ? actionResult.wheelResults.length : 0;

  // Step: 'cost' | 'wheel' | 'summary'
  const [step, setStep] = useState('cost');
  const [spinIndex, setSpinIndex] = useState(0);
  const [spinState, setSpinState] = useState('idle'); // 'idle' | 'spinning' | 'landed'
  const [completedResults, setCompletedResults] = useState([]);
  const autoSpinTimer = useRef(null);

  // Reset state when dialog opens with new action
  useEffect(() => {
    if (open && actionResult) {
      if (hasWheel) {
        setStep('cost');
        setSpinIndex(0);
        setSpinState('idle');
        setCompletedResults([]);
      } else {
        setStep('summary');
      }
    }
    return () => {
      if (autoSpinTimer.current) clearTimeout(autoSpinTimer.current);
    };
  }, [open, actionResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProceedToWheel = useCallback(() => {
    setStep('wheel');
  }, []);

  const handleSpin = useCallback(() => {
    setSpinState('spinning');
  }, []);

  const handleSpinComplete = useCallback(() => {
    setSpinState('landed');
    const currentResult = actionResult.wheelResults[spinIndex];
    const newCompleted = [...completedResults, currentResult];
    setCompletedResults(newCompleted);

    if (spinIndex + 1 < totalSpins) {
      // More spins — auto-trigger next after pause
      autoSpinTimer.current = setTimeout(() => {
        setSpinIndex((prev) => prev + 1);
        setSpinState('idle');
        // Auto-spin subsequent spins after a brief idle moment
        autoSpinTimer.current = setTimeout(() => {
          setSpinState('spinning');
        }, 300);
      }, 1500);
    } else {
      // All spins done — transition to summary after a pause
      autoSpinTimer.current = setTimeout(() => {
        setStep('summary');
      }, 1500);
    }
  }, [actionResult, spinIndex, totalSpins, completedResults]);

  if (!actionResult) return null;

  const actorName = attacker?.name || '';

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
        {/* Step 1: Cost — always shown */}
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

        {/* Step 2: Wheel phase (only for random-target actions) */}
        {hasWheel && step === 'cost' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleProceedToWheel}
              size="large"
              sx={{
                fontWeight: 'bold',
                backgroundColor: '#ff9800',
                '&:hover': { backgroundColor: '#f57c00' },
              }}
            >
              Spin the Wheel
            </Button>
          </Box>
        )}

        {hasWheel && step === 'wheel' && attacker && (
          <Paper elevation={2} sx={{ p: 2, mb: 2, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <GpsFixedIcon sx={{ color: '#ff9800' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Step 2: Attack Wheel
              </Typography>
            </Box>
            <AttackWheel
              wheelResult={actionResult.wheelResults[spinIndex]}
              attacker={attacker}
              allCharacters={allCharacters}
              spinState={spinState}
              onSpin={handleSpin}
              onSpinComplete={handleSpinComplete}
              spinIndex={spinIndex}
              totalSpins={totalSpins}
              results={completedResults}
            />
          </Paper>
        )}

        {/* Step 3: Effects summary */}
        {step === 'summary' && (
          <Paper elevation={2} sx={{ p: 2, mb: 2, backgroundColor: 'rgba(255, 152, 0, 0.1)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <GpsFixedIcon sx={{ color: '#ff9800' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Step 2: Resolve Targets & Apply Effects
              </Typography>
            </Box>

            {/* Wheel Results summary */}
            {hasWheel && (
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
        )}

        {/* Step 3 state indicator — only shown in summary */}
        {step === 'summary' && (
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
        )}
      </DialogContent>

      {step === 'summary' && (
        <>
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
        </>
      )}
    </Dialog>
  );
}
