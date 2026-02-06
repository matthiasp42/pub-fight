import { useState, useMemo, useRef, useLayoutEffect, useCallback } from 'react';
import {
  Dialog,
  Popover,
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
} from '@mui/material';
import { LuX } from 'react-icons/lu';
import { useSkills } from '../hooks/useSkills';
import { SkillNodeCard } from './SkillNodeCard';

const CLASS_ICONS = {
  tank: '\u{1F6E1}',
  wizard: '\u{1F9D9}',
  alchemist: '\u{1F9EA}',
  warrior: '\u{2694}',
};

const TYPE_COLORS = {
  ability: '#f59e0b',
  passive: '#a855f6',
};

/**
 * Assign each skill a column (0, 1, or 2) so that dependency chains
 * stay vertically aligned across level rows.
 */
function assignColumns(byLevel) {
  const allSkills = [1, 3, 5, 7].flatMap(l => byLevel[l] || []);
  if (allSkills.length === 0) return {};

  const skillMap = {};
  allSkills.forEach(s => { skillMap[s.id] = s; });

  const colOf = {};

  (byLevel[1] || []).forEach((s, i) => {
    colOf[s.id] = Math.min(i, 2);
  });

  [3, 5, 7].forEach(level => {
    const skills = byLevel[level] || [];
    const used = new Set();

    const withParent = skills.filter(s => s.requires && colOf[s.requires] !== undefined);
    withParent.sort((a, b) => {
      const cA = colOf[a.requires], cB = colOf[b.requires];
      if (cA !== cB) return cA - cB;
      const lvA = skillMap[a.requires]?.levelRequired || 0;
      const lvB = skillMap[b.requires]?.levelRequired || 0;
      return lvB - lvA;
    });

    withParent.forEach(s => {
      const parentCol = colOf[s.requires];
      if (!used.has(parentCol)) {
        colOf[s.id] = parentCol;
        used.add(parentCol);
      }
    });

    const unassigned = skills.filter(s => colOf[s.id] === undefined);
    unassigned.forEach(s => {
      for (let c = 0; c < 3; c++) {
        if (!used.has(c)) {
          colOf[s.id] = c;
          used.add(c);
          break;
        }
      }
    });
  });

  return colOf;
}

function getEffectSummary(skill) {
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
    return parts.join(' / ');
  }
  if (skill.type === 'passive' && skill.passive) {
    const labels = {
      always: 'Always active',
      onHit: 'On hit',
      onTakeDamage: 'When hit',
      onLowHP: 'Low HP',
      onTurnStart: 'Turn start',
      onKill: 'On kill',
      onFightStart: 'Fight start',
      onFatalDamage: 'Fatal blow',
    };
    return labels[skill.passive.trigger] || skill.passive.trigger;
  }
  return '';
}

export function SkillTreeDialog({
  open,
  onClose,
  characterClass,
  characterLevel,
  ownedSkillIds,
  perkPoints,
  onUnlockSkill,
  readOnly = false,
}) {
  const { skills, loading, error, getSkillsByLevel, getSkillStatus } = useSkills();
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [popoverSkill, setPopoverSkill] = useState(null);
  const [connectorPaths, setConnectorPaths] = useState([]);
  const skillRefs = useRef({});
  const containerRef = useRef(null);

  const skillsByLevel = useMemo(() => {
    if (!characterClass) return { 1: [], 3: [], 5: [], 7: [] };
    return getSkillsByLevel(characterClass);
  }, [characterClass, getSkillsByLevel]);

  const columnOf = useMemo(() => assignColumns(skillsByLevel), [skillsByLevel]);

  const allSkillsFlat = useMemo(
    () => Object.values(skillsByLevel).flat(),
    [skillsByLevel],
  );

  const calculateConnectors = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const paths = [];

    allSkillsFlat.forEach(skill => {
      if (skill.requires && skillRefs.current[skill.id] && skillRefs.current[skill.requires]) {
        const childEl = skillRefs.current[skill.id];
        const parentEl = skillRefs.current[skill.requires];
        const childRect = childEl.getBoundingClientRect();
        const parentRect = parentEl.getBoundingClientRect();

        const x1 = parentRect.left + parentRect.width / 2 - containerRect.left;
        const y1 = parentRect.bottom - containerRect.top;
        const x2 = childRect.left + childRect.width / 2 - containerRect.left;
        const y2 = childRect.top - containerRect.top;
        const midY = (y1 + y2) / 2;

        paths.push({
          id: `${skill.requires}-${skill.id}`,
          path: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
        });
      }
    });

    setConnectorPaths(paths);
  }, [allSkillsFlat]);

  useLayoutEffect(() => {
    if (open && !loading) {
      const timer = setTimeout(calculateConnectors, 120);
      return () => clearTimeout(timer);
    }
  }, [open, loading, skillsByLevel, calculateConnectors]);

  const setSkillRef = useCallback((skillId, element) => {
    if (element) skillRefs.current[skillId] = element;
  }, []);

  const handleSkillClick = (skill, event) => {
    setPopoverAnchor(event.currentTarget);
    setPopoverSkill(skill);
  };

  const handleClosePopover = () => {
    setPopoverAnchor(null);
    setPopoverSkill(null);
  };

  const handleUnlock = () => {
    if (popoverSkill && onUnlockSkill) onUnlockSkill(popoverSkill.id);
    handleClosePopover();
  };

  // Determine popover status info
  const popoverStatus = popoverSkill
    ? getSkillStatus(popoverSkill, characterLevel, ownedSkillIds)
    : null;

  const getLockedReason = (skill) => {
    if (!skill) return '';
    if (characterLevel < skill.levelRequired) {
      return `Requires level ${skill.levelRequired}`;
    }
    if (skill.requires && !ownedSkillIds.includes(skill.requires)) {
      const parent = allSkillsFlat.find(s => s.id === skill.requires);
      return `Requires ${parent?.name || skill.requires}`;
    }
    return 'Not yet available';
  };

  if (!characterClass) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
          borderRadius: '16px',
          m: 1,
          maxHeight: 'calc(100vh - 16px)',
        },
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        px: 2,
        py: 1.5,
        gap: 1,
      }}>
        <Typography sx={{ fontSize: '1.1rem' }}>
          {CLASS_ICONS[characterClass]}
        </Typography>
        <Typography sx={{
          fontSize: '0.85rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 1,
          flex: 1,
        }}>
          {characterClass}
        </Typography>
        {!readOnly && perkPoints > 0 && (
          <Box sx={{
            px: 1,
            py: 0.25,
            borderRadius: '6px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'primary.main' }}>
              {perkPoints} pt{perkPoints !== 1 ? 's' : ''}
            </Typography>
          </Box>
        )}
        <IconButton onClick={onClose} size="small" sx={{ ml: 0.5 }}>
          <LuX size={16} />
        </IconButton>
      </Box>

      {/* Skill tree */}
      <Box sx={{ px: 2, pb: 2, overflowY: 'auto' }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {error && (
          <Typography color="error" sx={{ fontSize: '0.8rem', py: 2 }}>
            Failed to load skills
          </Typography>
        )}

        {!loading && !error && (
          <Box ref={containerRef} sx={{ position: 'relative' }}>
            {/* SVG connectors */}
            <svg style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 0,
            }}>
              {connectorPaths.map((c) => (
                <path
                  key={c.id}
                  d={c.path}
                  fill="none"
                  stroke="rgba(168, 160, 149, 0.2)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              ))}
            </svg>

            {/* Level rows — 3-column grid */}
            {[1, 3, 5, 7].map((level) => {
              const levelSkills = skillsByLevel[level] || [];
              const unlocked = characterLevel >= level;

              const slots = [null, null, null];
              levelSkills.forEach(skill => {
                const col = columnOf[skill.id];
                if (col !== undefined && col < 3) slots[col] = skill;
              });

              return (
                <Box key={level} sx={{
                  position: 'relative',
                  zIndex: 1,
                  py: 1.5,
                  opacity: unlocked ? 1 : 0.4,
                  borderBottom: level < 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <Typography sx={{
                    fontSize: '0.55rem',
                    fontWeight: 600,
                    color: 'text.secondary',
                    textTransform: 'uppercase',
                    letterSpacing: 1.5,
                    mb: 1,
                    textAlign: 'center',
                  }}>
                    Lv {level}
                  </Typography>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1,
                  }}>
                    {slots.map((skill, col) => (
                      <Box
                        key={col}
                        sx={{ display: 'flex', justifyContent: 'center' }}
                      >
                        {skill ? (
                          <Box ref={(el) => setSkillRef(skill.id, el)}>
                            <SkillNodeCard
                              skill={skill}
                              status={getSkillStatus(skill, characterLevel, ownedSkillIds)}
                              onClick={(e) => handleSkillClick(skill, e)}
                            />
                          </Box>
                        ) : null}
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Skill detail popover */}
      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: 'background.paper',
              border: '1px solid rgba(168, 160, 149, 0.15)',
              borderRadius: '12px',
              p: 1.5,
              maxWidth: 260,
              mt: 0.5,
            },
          },
        }}
      >
        {popoverSkill && (
          <Box>
            {/* Title + type */}
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }}>
              {popoverSkill.name}
              <Box component="span" sx={{
                ml: 0.75,
                color: TYPE_COLORS[popoverSkill.type],
                fontWeight: 500,
                fontSize: '0.7rem',
              }}>
                {popoverSkill.type === 'ability' ? 'Active' : 'Passive'}
              </Box>
            </Typography>

            {/* Description */}
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.5 }}>
              {popoverSkill.description}
            </Typography>

            {/* Effect summary */}
            <Typography sx={{
              fontSize: '0.68rem',
              color: TYPE_COLORS[popoverSkill.type],
              mb: 1,
              opacity: 0.8,
            }}>
              {getEffectSummary(popoverSkill)}
            </Typography>

            {/* Action area based on status */}
            {!readOnly && popoverStatus === 'owned' && (
              <Typography sx={{ fontSize: '0.7rem', color: 'success.main', fontWeight: 600 }}>
                Unlocked
              </Typography>
            )}

            {!readOnly && popoverStatus === 'available' && perkPoints > 0 && (
              <Button
                size="small"
                variant="contained"
                onClick={handleUnlock}
                fullWidth
                sx={{ fontSize: '0.72rem', py: 0.5 }}
              >
                Unlock (1 pt)
              </Button>
            )}

            {!readOnly && popoverStatus === 'available' && perkPoints === 0 && (
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                No perk points available
              </Typography>
            )}

            {!readOnly && popoverStatus === 'locked' && (
              <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                {getLockedReason(popoverSkill)}
              </Typography>
            )}
          </Box>
        )}
      </Popover>
    </Dialog>
  );
}
