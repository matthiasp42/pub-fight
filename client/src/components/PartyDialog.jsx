import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { LuX } from 'react-icons/lu';
import {
  GiShield,
  GiVikingHelmet,
  GiWizardFace,
  GiCauldron,
  GiAxeSword,
  GiHearts,
  GiPowerLightning,
  GiSwordWound,
  GiShieldBounces,
  GiBullseye,
  GiRunningNinja,
} from 'react-icons/gi';
import { useSkills } from '../hooks/useSkills';
import { SkillNodeCard } from './SkillNodeCard';

const CLASS_ICONS = {
  tank: <GiVikingHelmet />,
  wizard: <GiWizardFace />,
  alchemist: <GiCauldron />,
  warrior: <GiAxeSword />,
};

const CLASS_COLORS = {
  tank: '#4CAF50',
  wizard: '#9c27b0',
  alchemist: '#ff9800',
  warrior: '#f44336',
};

const ATTR_LABELS = {
  maxHealth: { name: 'Max Health', icon: <GiHearts /> },
  maxAP: { name: 'Max AP', icon: <GiPowerLightning /> },
  power: { name: 'Power', icon: <GiSwordWound /> },
  shieldCapacity: { name: 'Shield Cap', icon: <GiShield /> },
  shieldStrength: { name: 'Shield Str', icon: <GiShieldBounces /> },
  dexterity: { name: 'Dexterity', icon: <GiBullseye /> },
  evasiveness: { name: 'Evasion', icon: <GiRunningNinja /> },
};

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   players: import('../../../server/src/types/game').PlayerCharacter[],
 *   myPlayerId: string,
 * }} props
 */
export function PartyDialog({ open, onClose, players, myPlayerId }) {
  const [selectedId, setSelectedId] = useState(null);
  const { skills, loading, error, getSkillsByLevel, getSkillStatus } = useSkills();

  // Default to first player if none selected
  const selected = players.find(p => p.id === selectedId) || players[0] || null;

  const skillsByLevel = useMemo(() => {
    if (!selected?.class) return { 1: [], 3: [], 5: [], 7: [] };
    return getSkillsByLevel(selected.class);
  }, [selected?.class, getSkillsByLevel]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Typography variant="h6" component="span">
          Party
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={onClose} size="small" sx={{ minWidth: 36, minHeight: 36 }}>
          <LuX size={20} />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Master list */}
        <Box
          sx={{
            width: { xs: '100%', md: 200 },
            minWidth: { md: 200 },
            borderRight: { md: '1px solid rgba(255,255,255,0.1)' },
            borderBottom: { xs: '1px solid rgba(255,255,255,0.1)', md: 'none' },
            display: 'flex',
            flexDirection: { xs: 'row', md: 'column' },
            overflowX: { xs: 'auto', md: 'visible' },
            overflowY: { xs: 'visible', md: 'auto' },
          }}
        >
          {players.map(p => {
            const isSelected = selected?.id === p.id;
            const color = CLASS_COLORS[p.class] || '#888';
            return (
              <Box
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  cursor: 'pointer',
                  minWidth: { xs: 120, md: 'auto' },
                  flexShrink: 0,
                  borderLeft: { md: isSelected ? `3px solid ${color}` : '3px solid transparent' },
                  borderBottom: { xs: isSelected ? `3px solid ${color}` : '3px solid transparent', md: 'none' },
                  backgroundColor: isSelected ? 'rgba(255,255,255,0.05)' : 'transparent',
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' },
                }}
              >
                <Box sx={{ fontSize: '1.3rem', lineHeight: 1, display: 'flex', color: CLASS_COLORS[p.class] }}>
                  {CLASS_ICONS[p.class]}
                </Box>
                <Box sx={{ overflow: 'hidden' }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.name}
                    {p.id === myPlayerId && (
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                        (You)
                      </Typography>
                    )}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Lv {p.level} {p.class}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* Detail panel */}
        <Box sx={{ flex: 1, p: 2, overflowY: 'auto' }}>
          {selected ? (
            <>
              {/* Attributes */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                {Object.entries(ATTR_LABELS).map(([attr, { name, icon }]) => (
                  <Chip
                    key={attr}
                    icon={<Box sx={{ display: 'flex', fontSize: '0.85rem', ml: 0.5 }}>{icon}</Box>}
                    label={selected.attributes?.[attr] ?? 0}
                    size="small"
                    title={name}
                    sx={{ backgroundColor: 'rgba(255,255,255,0.06)', fontWeight: 'bold' }}
                  />
                ))}
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Skill Tree */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2" sx={{ color: 'primary.main' }}>
                  Skills
                </Typography>
                <Chip
                  label={`${(selected.ownedSkillIds || []).length} owned`}
                  size="small"
                  sx={{ height: 20, fontSize: '0.65rem', backgroundColor: CLASS_COLORS[selected.class], color: 'white' }}
                />
              </Box>

              {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress size={28} />
                </Box>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  Failed to load skills
                </Alert>
              )}

              {!loading && !error && (
                <Box
                  sx={{
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 1,
                    backgroundColor: 'rgba(0,0,0,0.2)',
                  }}
                >
                  {[1, 3, 5, 7].map(level => {
                    const levelSkills = skillsByLevel[level] || [];
                    if (levelSkills.length === 0) return null;
                    const isLevelUnlocked = selected.level >= level;
                    return (
                      <Box
                        key={level}
                        sx={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          py: 1.5,
                          borderBottom: level < 7 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                          opacity: isLevelUnlocked ? 1 : 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            mb: 1,
                            color: isLevelUnlocked ? CLASS_COLORS[selected.class] : 'text.disabled',
                            fontWeight: 'bold',
                          }}
                        >
                          Level {level}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
                          {levelSkills.map(skill => (
                            <SkillNodeCard
                              key={skill.id}
                              skill={skill}
                              status={getSkillStatus(skill, selected.level, selected.ownedSkillIds || [])}
                              compact
                            />
                          ))}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No players in the party</Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
