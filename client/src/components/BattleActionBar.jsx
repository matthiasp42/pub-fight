import { useState } from 'react';
import { Box, Typography, Button, Popover } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { GiSwordWound, GiShield, GiBed, GiScrollUnfurled, GiAura } from 'react-icons/gi';
import { LuInfo, LuCheck } from 'react-icons/lu';
import { canExecuteAction, getEffectiveCost } from '../game/engine.js';

/** Map action IDs to RPG icons */
const ACTION_ICONS = {
  attack: GiSwordWound,
  shield: GiShield,
  rest: GiBed,
};

/** Human-readable target type labels */
const TARGET_LABELS = {
  self: 'Self',
  manual: 'Choose target',
  random: 'Random enemy',
  allParty: 'All allies',
  allEnemies: 'All enemies',
};

/** Compute effective damage accounting for power + glassCannon passives */
function getEffectiveDamage(baseAmount, character) {
  let dmg = baseAmount;
  if (character?.attributes?.power) dmg += character.attributes.power;
  if (character?.passives) {
    for (const p of character.passives) {
      if (p.trigger === 'always' && p.effect.type === 'glassCannon') dmg += p.effect.amount;
    }
  }
  return dmg;
}

/** Compute effective heal accounting for healBonus passives */
function getEffectiveHeal(baseAmount, character) {
  let heal = baseAmount;
  if (character?.passives) {
    for (const p of character.passives) {
      if (p.trigger === 'always' && p.effect.type === 'healBonus') heal += p.effect.amount;
    }
  }
  return heal;
}

/** Generate a short effect summary from action effects/selfEffects, with character stats applied */
function getActionEffectSummary(action, character) {
  const parts = [];
  (action.effects || []).forEach((e) => {
    if (e.type === 'damage') {
      const effective = getEffectiveDamage(e.amount, character);
      parts.push(`${effective} dmg${e.piercing ? ' (pierce)' : ''}`);
    }
    if (e.type === 'heal') {
      const effective = getEffectiveHeal(e.amount, character);
      parts.push(`${effective} heal`);
    }
    if (e.type === 'addShield') parts.push(`+${e.amount} shield`);
    if (e.type === 'modifyAP') parts.push(`${e.amount > 0 ? '+' : ''}${e.amount} AP`);
    if (e.type === 'removeShield') parts.push('strip shield');
  });
  (action.selfEffects || []).forEach((e) => {
    if (e.type === 'heal') parts.push(`self +${e.amount} HP`);
    if (e.type === 'addShield') parts.push(`self +${e.amount} shield`);
    if (e.type === 'modifyAP') parts.push(`self ${e.amount > 0 ? '+' : ''}${e.amount} AP`);
  });
  return parts.join(' / ');
}

/** Trigger type → color for passive badges */
const TRIGGER_COLORS = {
  always: '#a855f7',
  onHit: '#f59e0b',
  onTakeDamage: '#dc2626',
  onKill: '#ef4444',
  onFightStart: '#3b82f6',
  onFatalDamage: '#10b981',
  onTurnStart: '#06b6d4',
  onLowHP: '#eab308',
};

/** Human-readable trigger labels */
const TRIGGER_LABELS = {
  always: 'Always active',
  onHit: 'On hit',
  onTakeDamage: 'When hit',
  onKill: 'On kill',
  onFightStart: 'Fight start',
  onFatalDamage: 'Fatal blow',
  onTurnStart: 'Turn start',
  onLowHP: 'Low HP',
};

/** Generate a readable description from a passive's effect */
function getPassiveDescription(passive) {
  const { type, amount, condition } = passive.effect;
  switch (type) {
    case 'modifyShieldCapacity': return `+${amount} max shield capacity.`;
    case 'modifyShieldStrength': return `Shields block ${amount} extra damage.`;
    case 'modifyMaxAP': return `+${amount} max AP.`;
    case 'modifyAbilityCost': return `Abilities cost ${amount} less AP (min 1).`;
    case 'glassCannon': return `+${amount} damage dealt and taken.`;
    case 'damageReduction': return `Take ${amount} less damage from all attacks.`;
    case 'healBonus': return `Heals restore ${amount} extra HP.`;
    case 'secondWind': return `Rest also heals for 20% max HP.`;
    case 'provoke': return `Draw more enemy attacks to yourself.`;
    case 'precision': return `Basic Attack targets a chosen enemy.`;
    case 'reflectDamage': return `Reflect ${amount} damage back when hit.`;
    case 'gainShield': return `Gain ${amount} shield when below ${condition?.hpBelow || 25}% HP.`;
    case 'modifyShieldGain': return `Shield gains doubled below ${condition?.hpBelow || 25}% HP.`;
    case 'surviveFatal': return `Survive a fatal blow once per fight (1 HP).`;
    case 'restoreAP': return `All allies gain ${amount} AP at fight start.`;
    default: return '';
  }
}

/**
 * Bottom sheet action bar for the fight screen.
 * Shows horizontally scrollable action cards when it's your turn.
 */
export function BattleActionBar({
  isMyTurn,
  currentCharacter,
  myPlayer,
  fightOver,
  fightResult,
  onAction,
  onRetry,
  onConfirmVictory,
  victoryConfirmations = [],
  gamePlayers = {},
  posting,
}) {
  const [infoAnchor, setInfoAnchor] = useState(null);
  const [infoAction, setInfoAction] = useState(null);
  const [passiveAnchor, setPassiveAnchor] = useState(null);
  const [passiveInfo, setPassiveInfo] = useState(null);

  const handleInfoOpen = (event, action) => {
    event.stopPropagation();
    setInfoAnchor(event.currentTarget);
    setInfoAction(action);
  };

  const handleInfoClose = () => {
    setInfoAnchor(null);
    setInfoAction(null);
  };

  const handlePassiveOpen = (event, passive) => {
    setPassiveAnchor(event.currentTarget);
    setPassiveInfo(passive);
  };

  const handlePassiveClose = () => {
    setPassiveAnchor(null);
    setPassiveInfo(null);
  };

  // Shared sheet styling for layout stability across all states
  const sheetSx = {
    borderTop: '2px solid',
    borderRadius: '16px 16px 0 0',
    pb: 'env(safe-area-inset-bottom, 8px)',
  };

  // Fight over state
  if (fightOver) {
    const isVictory = fightResult === 'victory';
    const alreadyConfirmed = victoryConfirmations.includes(myPlayer?.id);
    const playerList = Object.values(gamePlayers);

    return (
      <Box
        sx={{
          ...sheetSx,
          px: 2,
          py: 2,
          background: isVictory
            ? 'linear-gradient(0deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)'
            : 'linear-gradient(0deg, rgba(220, 38, 38, 0.2) 0%, rgba(220, 38, 38, 0.05) 100%)',
          borderColor: isVictory ? 'rgba(16, 185, 129, 0.4)' : 'rgba(220, 38, 38, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          minHeight: 80,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            sx={{
              color: isVictory ? 'success.main' : 'secondary.main',
              fontWeight: 800,
              fontSize: '1.1rem',
              textShadow: `0 0 10px ${isVictory ? 'rgba(16, 185, 129, 0.5)' : 'rgba(220, 38, 38, 0.5)'}`,
            }}
          >
            {isVictory ? 'VICTORY!' : 'DEFEAT'}
          </Typography>
          {isVictory ? (
            <Button
              variant="contained"
              size="small"
              color="success"
              disabled={alreadyConfirmed}
              onClick={onConfirmVictory}
              sx={{ fontWeight: 700, minHeight: 36 }}
            >
              {alreadyConfirmed ? 'Waiting...' : 'Continue'}
            </Button>
          ) : (
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
        {isVictory && playerList.length > 1 && (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            {playerList.map(p => {
              const confirmed = victoryConfirmations.includes(p.id);
              return (
                <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {confirmed ? (
                    <LuCheck size={14} color="#10b981" />
                  ) : (
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'primary.main',
                        }}
                      />
                    </motion.div>
                  )}
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      color: confirmed ? 'success.main' : 'text.secondary',
                    }}
                  >
                    {p.name}
                  </Typography>
                </Box>
              );
            })}
          </Box>
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
          ...sheetSx,
          px: 2,
          py: 2.5,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.5) 0%, rgba(26, 26, 46, 0.95) 100%)',
          borderColor: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 80,
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
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      >
        <Box
          sx={{
            ...sheetSx,
            px: 1.5,
            pt: 1,
            pb: 'env(safe-area-inset-bottom, 12px)',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(26, 26, 46, 0.95) 100%)',
            borderColor: 'rgba(245, 158, 11, 0.35)',
          }}
        >
          {/* Header row: "Your Turn" + AP pips */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1,
              px: 0.5,
            }}
          >
            <Typography
              sx={{
                color: 'primary.main',
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 1.5,
                textShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
              }}
            >
              Your Turn
            </Typography>

            {/* AP pips */}
            <Box sx={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
              <Typography
                sx={{
                  fontSize: '0.55rem',
                  color: 'text.secondary',
                  mr: 0.5,
                  fontWeight: 600,
                }}
              >
                AP
              </Typography>
              {Array.from({ length: playerChar.attributes.maxAP }, (_, i) => (
                <Box
                  key={i}
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: i < playerChar.state.ap ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.25)',
                    backgroundColor: i < playerChar.state.ap ? 'rgba(37, 99, 235, 0.9)' : 'transparent',
                    boxShadow: i < playerChar.state.ap ? '0 0 3px rgba(59, 130, 246, 0.4)' : 'none',
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Active passives row */}
          {playerChar.passives?.length > 0 && (
            <Box
              sx={{
                display: 'flex',
                gap: 0.5,
                mb: 0.75,
                px: 0.5,
                overflowX: 'auto',
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
              }}
            >
              {playerChar.passives.map((passive) => (
                <Box
                  key={passive.skillId}
                  onClick={(e) => handlePassiveOpen(e, passive)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexShrink: 0,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    border: '1px solid',
                    borderColor: `${TRIGGER_COLORS[passive.trigger] || '#a855f7'}40`,
                    backgroundColor: `${TRIGGER_COLORS[passive.trigger] || '#a855f7'}10`,
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    '&:active': {
                      backgroundColor: `${TRIGGER_COLORS[passive.trigger] || '#a855f7'}25`,
                    },
                  }}
                >
                  <GiAura size={10} color={TRIGGER_COLORS[passive.trigger] || '#a855f7'} />
                  <Typography
                    sx={{
                      fontSize: '0.5rem',
                      fontWeight: 600,
                      color: TRIGGER_COLORS[passive.trigger] || '#a855f7',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {passive.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Action cards grid (wraps, vertical scroll if many) */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              pb: 0.5,
              px: 0.5,
              maxHeight: 168,
              overflowY: 'auto',
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none',
            }}
          >
            {actions.map((action) => {
              const check = canExecuteAction(playerChar, action);
              const effectiveCost = getEffectiveCost(playerChar, action);
              const disabled = !check.canExecute || posting;
              const IconComponent = ACTION_ICONS[action.id] || GiScrollUnfurled;

              return (
                <Box
                  key={action.id}
                  onClick={() => !disabled && onAction(action.id)}
                  sx={{
                    flex: '1 1 72px',
                    maxWidth: 100,
                    minWidth: 72,
                    height: 76,
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: disabled
                      ? 'rgba(255,255,255,0.06)'
                      : 'rgba(245, 158, 11, 0.35)',
                    background: disabled
                      ? 'rgba(255,255,255,0.03)'
                      : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 0.25,
                    position: 'relative',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.4 : 1,
                    transition: 'all 0.15s ease',
                    userSelect: 'none',
                    WebkitTapHighlightColor: 'transparent',
                    '&:active': disabled ? {} : {
                      transform: 'scale(0.95)',
                      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(245, 158, 11, 0.12) 100%)',
                    },
                  }}
                >
                  {/* Info button (top-right) */}
                  <Box
                    onClick={(e) => handleInfoOpen(e, action)}
                    sx={{
                      position: 'absolute',
                      top: 3,
                      right: 3,
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      color: 'text.secondary',
                      '&:active': {
                        backgroundColor: 'rgba(255,255,255,0.1)',
                      },
                    }}
                  >
                    <LuInfo size={13} />
                  </Box>

                  {/* Icon */}
                  <IconComponent
                    size={22}
                    color={disabled ? 'rgba(168, 160, 149, 0.4)' : '#f59e0b'}
                    style={{ filter: disabled ? 'none' : 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.3))' }}
                  />

                  {/* Action name */}
                  <Typography
                    sx={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: disabled ? 'rgba(168, 160, 149, 0.4)' : 'text.primary',
                      lineHeight: 1.1,
                      textAlign: 'center',
                      px: 0.25,
                    }}
                  >
                    {action.name}
                  </Typography>

                  {/* AP cost */}
                  <Typography
                    sx={{
                      fontSize: '0.55rem',
                      color: disabled ? 'rgba(168, 160, 149, 0.3)' : 'info.main',
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    {effectiveCost} AP
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Info Popover */}
        <Popover
          open={Boolean(infoAnchor)}
          anchorEl={infoAnchor}
          onClose={handleInfoClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          slotProps={{
            paper: {
              sx: {
                maxWidth: 220,
                p: 1.5,
                backgroundColor: 'background.paper',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: 2,
              },
            },
          }}
        >
          {infoAction && (
            <Box>
              {/* Action name */}
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: 'primary.main',
                  mb: 0.5,
                }}
              >
                {infoAction.name}
              </Typography>

              {/* Cost + target type */}
              <Typography
                sx={{
                  fontSize: '0.65rem',
                  color: 'info.main',
                  fontWeight: 600,
                  mb: 0.75,
                }}
              >
                {getEffectiveCost(playerChar, infoAction)} AP &middot;{' '}
                {TARGET_LABELS[infoAction.targetType] || infoAction.targetType}
              </Typography>

              {/* Description */}
              {infoAction.description && (
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: 'text.primary',
                    mb: 0.75,
                    lineHeight: 1.4,
                  }}
                >
                  {infoAction.description}
                </Typography>
              )}

              {/* Effect summary */}
              {(() => {
                const summary = getActionEffectSummary(infoAction, playerChar);
                if (!summary) return null;
                return (
                  <Typography
                    sx={{
                      fontSize: '0.6rem',
                      color: 'text.secondary',
                      fontStyle: 'italic',
                    }}
                  >
                    {summary}
                  </Typography>
                );
              })()}
            </Box>
          )}
        </Popover>
        {/* Passive info Popover */}
        <Popover
          open={Boolean(passiveAnchor)}
          anchorEl={passiveAnchor}
          onClose={handlePassiveClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          slotProps={{
            paper: {
              sx: {
                maxWidth: 220,
                p: 1.5,
                backgroundColor: 'background.paper',
                border: `1px solid ${passiveInfo ? (TRIGGER_COLORS[passiveInfo.trigger] || '#a855f7') + '40' : 'rgba(168,130,252,0.25)'}`,
                borderRadius: 2,
              },
            },
          }}
        >
          {passiveInfo && (
            <Box>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: TRIGGER_COLORS[passiveInfo.trigger] || '#a855f7',
                  mb: 0.5,
                }}
              >
                {passiveInfo.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: 'text.secondary',
                  mb: 0.5,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                {TRIGGER_LABELS[passiveInfo.trigger] || passiveInfo.trigger}
              </Typography>
              {(() => {
                const desc = getPassiveDescription(passiveInfo);
                if (!desc) return null;
                return (
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      color: 'text.primary',
                      lineHeight: 1.4,
                    }}
                  >
                    {desc}
                  </Typography>
                );
              })()}
            </Box>
          )}
        </Popover>
      </motion.div>
    </AnimatePresence>
  );
}
