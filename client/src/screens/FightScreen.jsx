import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { CharacterCard } from '../components/CharacterCard.jsx';
import { TurnBar } from '../components/TurnBar.jsx';
import { ActionPopover } from '../components/ActionPopover.jsx';
import { GameLog } from '../components/GameLog.jsx';
import { SkillTreeDialog } from '../components/SkillTreeDialog.jsx';
import { createRandomFight, createRandomGameState } from '../game/random.js';
import {
  executeAction,
  advanceTurn,
  getCurrentTurnCharacter,
  getCharacter,
  cloneState,
} from '../game/engine.js';
import { CHARACTER_TYPES } from '../game/types.js';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffd700',
    },
    secondary: {
      main: '#9c27b0',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});

export function FightScreen() {
  const [fightState, setFightState] = useState(() => createRandomFight(3, 2));
  const [logs, setLogs] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [skillTreeOpen, setSkillTreeOpen] = useState(false);
  const [selectedCharacterForSkills, setSelectedCharacterForSkills] = useState(null);

  const handleOpenSkills = useCallback((character) => {
    setSelectedCharacterForSkills(character);
    setSkillTreeOpen(true);
  }, []);

  const handleCloseSkills = useCallback(() => {
    setSkillTreeOpen(false);
    setSelectedCharacterForSkills(null);
  }, []);

  const handleUnlockSkill = useCallback((skillId) => {
    if (!selectedCharacterForSkills) return;

    setFightState((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => {
        if (c.id === selectedCharacterForSkills.id && c.perkPoints > 0) {
          return {
            ...c,
            ownedSkillIds: [...(c.ownedSkillIds || []), skillId],
            perkPoints: c.perkPoints - 1,
          };
        }
        return c;
      }),
    }));

    // Update the selected character reference
    setSelectedCharacterForSkills((prev) => ({
      ...prev,
      ownedSkillIds: [...(prev.ownedSkillIds || []), skillId],
      perkPoints: prev.perkPoints - 1,
    }));
  }, [selectedCharacterForSkills]);

  // Initialize log with fight start
  useEffect(() => {
    setLogs([
      {
        timestamp: Date.now(),
        type: 'fight_start',
        stateBefore: fightState,
        stateAfter: fightState,
        description: 'Fight started!',
      },
    ]);
  }, []);

  const currentCharacter = getCurrentTurnCharacter(fightState);

  const handleAction = useCallback(
    (actionId) => {
      if (!currentCharacter) return;

      const stateBefore = cloneState(fightState);
      const { newState, result } = executeAction(
        fightState,
        currentCharacter.id,
        actionId
      );

      if (result.success) {
        setPendingAction({
          result,
          newState,
          stateBefore,
          actorName: currentCharacter.name,
        });
      }
    },
    [fightState, currentCharacter]
  );

  const handleContinue = useCallback(() => {
    if (!pendingAction) return;

    const { result, newState, stateBefore, actorName } = pendingAction;

    // Log the action
    setLogs((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        type: 'action',
        stateBefore,
        stateAfter: newState,
        actionResult: result,
        description: `${actorName} used ${result.actionName}`,
      },
    ]);

    // Advance to next turn
    const stateAfterTurn = advanceTurn(newState);
    const nextCharacter = getCurrentTurnCharacter(stateAfterTurn);

    // Log turn change
    setLogs((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        type: 'turn_start',
        stateBefore: newState,
        stateAfter: stateAfterTurn,
        description: `${nextCharacter?.name || 'Unknown'}'s turn`,
      },
    ]);

    setFightState(stateAfterTurn);
    setPendingAction(null);
  }, [pendingAction]);

  const handleNewFight = useCallback(() => {
    const newFight = createRandomFight(3, 2);
    setFightState(newFight);
    setLogs([
      {
        timestamp: Date.now(),
        type: 'fight_start',
        stateBefore: newFight,
        stateAfter: newFight,
        description: 'Fight started!',
      },
    ]);
    setPendingAction(null);
  }, []);

  const handleRandomState = useCallback(() => {
    const randomState = createRandomGameState(3, 2);
    setFightState(randomState);
    setLogs([
      {
        timestamp: Date.now(),
        type: 'fight_start',
        stateBefore: randomState,
        stateAfter: randomState,
        description: 'Loaded random mid-fight state',
      },
    ]);
    setPendingAction(null);
  }, []);

  const handleRestartFight = useCallback(() => {
    // Reset the same fight to beginning
    const resetFight = { ...fightState };
    resetFight.isOver = false;
    resetFight.result = 'ongoing';
    resetFight.currentTurnIndex = 0;
    resetFight.characters = resetFight.characters.map((c) => ({
      ...c,
      state: {
        health: c.attributes.maxHealth,
        ap: c.attributes.maxAP,
        shield: 0,
        isAlive: true,
      },
    }));
    setFightState(resetFight);
    setLogs([
      {
        timestamp: Date.now(),
        type: 'fight_start',
        stateBefore: resetFight,
        stateAfter: resetFight,
        description: 'Fight restarted!',
      },
    ]);
    setPendingAction(null);
  }, [fightState]);

  // Separate characters into enemies and players
  const enemies = fightState.characters.filter(
    (c) => c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION
  );
  const players = fightState.characters.filter(
    (c) => c.type === CHARACTER_TYPES.PLAYER
  );

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          backgroundColor: 'background.default',
          p: 2,
          display: 'flex',
        }}
      >
        {/* Turn Bar - Left Side */}
        <Box sx={{ mr: 2 }}>
          <TurnBar
            characters={fightState.characters}
            turnOrder={fightState.turnOrder}
            currentTurnIndex={fightState.currentTurnIndex}
          />
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
              Pub Fight
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleNewFight}
              >
                New Fight
              </Button>
              <Button variant="outlined" onClick={handleRandomState}>
                Random State
              </Button>
            </Box>
          </Box>

          {/* Fight Over Alert */}
          {fightState.isOver && (
            <Alert
              severity={fightState.result === 'victory' ? 'success' : 'error'}
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={handleRestartFight}>
                  Restart Fight
                </Button>
              }
            >
              {fightState.result === 'victory'
                ? 'Victory! All enemies defeated!'
                : 'Defeat! Your party has been wiped out!'}
            </Alert>
          )}

          {/* Current Turn Indicator */}
          {!fightState.isOver && currentCharacter && (
            <Paper sx={{ p: 2, mb: 2, backgroundColor: 'rgba(255, 215, 0, 0.1)' }}>
              <Typography variant="h6" sx={{ color: '#ffd700' }}>
                Current Turn: {currentCharacter.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                AP: {currentCharacter.state.ap} / {currentCharacter.attributes.maxAP}
              </Typography>
            </Paper>
          )}

          {/* Enemies - Top */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ color: '#ff4444', mb: 2 }}>
              Enemies
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {enemies.map((enemy) => (
                <CharacterCard
                  key={enemy.id}
                  character={enemy}
                  isCurrentTurn={currentCharacter?.id === enemy.id}
                  onAction={handleAction}
                  showActions={currentCharacter?.id === enemy.id && !fightState.isOver}
                />
              ))}
            </Box>
          </Box>

          {/* Divider */}
          <Box
            sx={{
              borderTop: '2px dashed #444',
              my: 2,
              position: 'relative',
              '&::after': {
                content: '"VS"',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'background.default',
                px: 2,
                color: '#666',
                fontWeight: 'bold',
              },
            }}
          />

          {/* Players - Bottom */}
          <Box>
            <Typography variant="h6" sx={{ color: '#4CAF50', mb: 2 }}>
              Your Party
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {players.map((player) => (
                <CharacterCard
                  key={player.id}
                  character={player}
                  isCurrentTurn={currentCharacter?.id === player.id}
                  onAction={handleAction}
                  showActions={currentCharacter?.id === player.id && !fightState.isOver}
                  onOpenSkills={() => handleOpenSkills(player)}
                  ownedSkillCount={player.ownedSkillIds?.length || 0}
                  perkPoints={player.perkPoints || 0}
                />
              ))}
            </Box>
          </Box>
        </Box>

        {/* Action Popover */}
        <ActionPopover
          open={!!pendingAction}
          actionResult={pendingAction?.result}
          actorName={pendingAction?.actorName || ''}
          onContinue={handleContinue}
        />

        {/* Game Log */}
        <GameLog logs={logs} open={showLog} onToggle={() => setShowLog(!showLog)} />

        {/* Skill Tree Dialog */}
        {selectedCharacterForSkills && (
          <SkillTreeDialog
            open={skillTreeOpen}
            onClose={handleCloseSkills}
            characterClass={selectedCharacterForSkills.class}
            characterLevel={selectedCharacterForSkills.level || 1}
            ownedSkillIds={selectedCharacterForSkills.ownedSkillIds || []}
            perkPoints={selectedCharacterForSkills.perkPoints || 0}
            onUnlockSkill={handleUnlockSkill}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
