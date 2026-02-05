import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useSkills } from '../hooks/useSkills';
import { SkillNodeCard } from './SkillNodeCard';

const CLASS_ICONS = {
  tank: '\u{1F6E1}',
  wizard: '\u{1F9D9}',
  alchemist: '\u{1F9EA}',
  warrior: '\u{2694}',
};

const CLASS_COLORS = {
  tank: '#4CAF50',
  wizard: '#9c27b0',
  alchemist: '#ff9800',
  warrior: '#f44336',
};

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   characterClass: import('../game/types').CharacterClass,
 *   characterLevel: number,
 *   ownedSkillIds: string[],
 *   perkPoints: number,
 *   onUnlockSkill?: (skillId: string) => void
 * }} props
 */
export function SkillTreeDialog({
  open,
  onClose,
  characterClass,
  characterLevel,
  ownedSkillIds,
  perkPoints,
  onUnlockSkill,
}) {
  const { skills, loading, error, getSkillsByLevel, getSkillStatus } = useSkills();
  const [selectedSkill, setSelectedSkill] = useState(null);

  const skillsByLevel = useMemo(() => {
    if (!characterClass) return { 1: [], 3: [], 5: [], 7: [] };
    return getSkillsByLevel(characterClass);
  }, [characterClass, getSkillsByLevel]);

  const handleSkillClick = (skill) => {
    const status = getSkillStatus(skill, characterLevel, ownedSkillIds);
    if (status === 'available' && perkPoints > 0) {
      setSelectedSkill(skill);
    }
  };

  const handleConfirmUnlock = () => {
    if (selectedSkill && onUnlockSkill) {
      onUnlockSkill(selectedSkill.id);
    }
    setSelectedSkill(null);
  };

  const renderSkillColumn = (level, levelSkills) => {
    const isLevelUnlocked = characterLevel >= level;

    return (
      <Box
        key={level}
        sx={{
          flex: 1,
          minWidth: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 1,
          borderRight: level < 7 ? '1px solid rgba(255,255,255,0.1)' : 'none',
          opacity: isLevelUnlocked ? 1 : 0.5,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            mb: 1,
            color: isLevelUnlocked ? CLASS_COLORS[characterClass] : 'text.disabled',
            fontWeight: 'bold',
          }}
        >
          Level {level}
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            alignItems: 'center',
          }}
        >
          {levelSkills.map((skill) => (
            <SkillNodeCard
              key={skill.id}
              skill={skill}
              status={getSkillStatus(skill, characterLevel, ownedSkillIds)}
              onClick={() => handleSkillClick(skill)}
              compact
            />
          ))}
        </Box>
      </Box>
    );
  };

  if (!characterClass) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <Typography variant="h6" component="span">
          {CLASS_ICONS[characterClass]} {characterClass.toUpperCase()} SKILL TREE
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={`${ownedSkillIds.length} skills owned`}
          size="small"
          sx={{ backgroundColor: CLASS_COLORS[characterClass], color: 'white' }}
        />
        <Chip
          label={`${perkPoints} point${perkPoints !== 1 ? 's' : ''} available`}
          size="small"
          color={perkPoints > 0 ? 'primary' : 'default'}
        />
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ p: 2 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load skills: {error.message}
          </Alert>
        )}

        {!loading && !error && (
          <>
            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: '#4CAF50' }} />
                <Typography variant="caption">Owned</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: '#2196F3' }} />
                <Typography variant="caption">Available</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 1, backgroundColor: '#666' }} />
                <Typography variant="caption">Locked</Typography>
              </Box>
            </Box>

            {/* Skill Tree Grid */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 1,
                overflow: 'hidden',
                backgroundColor: 'rgba(0,0,0,0.2)',
              }}
            >
              {[1, 3, 5, 7].map((level) => renderSkillColumn(level, skillsByLevel[level]))}
            </Box>

            {/* Selected skill confirmation */}
            {selectedSkill && (
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  border: '2px solid #2196F3',
                  borderRadius: 1,
                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Unlock {selectedSkill.name}?
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {selectedSkill.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="contained" color="primary" onClick={handleConfirmUnlock}>
                    Unlock (1 Point)
                  </Button>
                  <Button variant="outlined" onClick={() => setSelectedSkill(null)}>
                    Cancel
                  </Button>
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
