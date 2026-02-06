import { useState, useCallback, useEffect, useRef } from 'react';
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
import { CharacterCard } from '../components/CharacterCard.jsx';
import { TurnBar } from '../components/TurnBar.jsx';
import { ActionPopover } from '../components/ActionPopover.jsx';
import { GameLog } from '../components/GameLog.jsx';
import { SkillTreeDialog } from '../components/SkillTreeDialog.jsx';
import { AdminModal } from '../components/AdminModal.jsx';
import { buildFightFromServer } from '../game/fightSetup.js';
import {
  executeAction,
  advanceTurn,
  getCurrentTurnCharacter,
  cloneState,
} from '../game/engine.js';
import { CHARACTER_TYPES } from '../game/types.js';
import { chooseBossAction } from '../game/bossAI.js';
import { api } from '../api/client.js';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#ffd700' },
    secondary: { main: '#9c27b0' },
    background: { default: '#121212', paper: '#1e1e1e' },
  },
});

export function FightScreen({ gameState, myPlayer, fetchState }) {
  const [localFight, setLocalFight] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [skillTreeOpen, setSkillTreeOpen] = useState(false);
  const [selectedCharacterForSkills, setSelectedCharacterForSkills] = useState(null);
  const [posting, setPosting] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const lastFightVersionRef = useRef(-1);
  const initRef = useRef(false);

  const activeDungeonId = gameState?.activeDungeonId;
  const serverFight = gameState?.fightState;
  const serverFightVersion = gameState?.fightVersion ?? 0;
  const dungeons = gameState?.dungeons || [];

  // Initialize fight state if server doesn't have one yet
  useEffect(() => {
    if (!activeDungeonId || initRef.current) return;

    if (!serverFight && gameState?.players) {
      // First client to load builds the fight
      initRef.current = true;
      try {
        const fight = buildFightFromServer(gameState.players, activeDungeonId, dungeons);
        setLocalFight(fight);

        // Post to server
        api.postFightState(fight, 0).then(res => {
          if (res.success) {
            lastFightVersionRef.current = res.fightVersion;
          }
          fetchState();
        });

        setLogs([{
          timestamp: Date.now(),
          type: 'fight_start',
          stateBefore: fight,
          stateAfter: fight,
          description: 'Fight started!',
        }]);
      } catch (err) {
        console.error('Failed to build fight:', err);
      }
    }
  }, [activeDungeonId, serverFight, gameState?.players, dungeons, fetchState]);

  // Sync from server fight state
  useEffect(() => {
    if (!serverFight) return;
    if (serverFightVersion <= lastFightVersionRef.current) return;

    // Server has a newer version - update local state
    lastFightVersionRef.current = serverFightVersion;
    setLocalFight(serverFight);

    if (!logs.length) {
      setLogs([{
        timestamp: Date.now(),
        type: 'fight_start',
        stateBefore: serverFight,
        stateAfter: serverFight,
        description: 'Fight loaded from server',
      }]);
    }
  }, [serverFight, serverFightVersion, logs.length]);

  // Poll for state updates
  useEffect(() => {
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const fightState = localFight;
  const currentCharacter = fightState ? getCurrentTurnCharacter(fightState) : null;

  // Is it my character's turn?
  const isMyTurn = currentCharacter?.type === CHARACTER_TYPES.PLAYER &&
    currentCharacter?.id === myPlayer?.id;

  // Is it any player's turn (for boss auto-processing)?
  const isPlayerTurn = currentCharacter?.type === CHARACTER_TYPES.PLAYER;

  // Auto-process boss/minion turns
  useEffect(() => {
    if (!fightState || fightState.isOver || posting) return;
    if (!currentCharacter || isPlayerTurn) return;

    // It's a boss/minion turn - auto-process if it's my player's next turn coming up
    // Or if the current character is a boss and we're the first player
    const playerIds = Object.keys(gameState?.players || {});
    const myIndex = playerIds.indexOf(myPlayer?.id);
    if (myIndex !== 0) return; // Only first player auto-processes boss turns

    const timer = setTimeout(() => {
      autoBossTurn();
    }, 800);

    return () => clearTimeout(timer);
  }, [fightState?.currentTurnIndex, posting]);

  const autoBossTurn = useCallback(async () => {
    if (!fightState || !currentCharacter || posting) return;
    if (currentCharacter.type === CHARACTER_TYPES.PLAYER) return;

    setPosting(true);

    let state = cloneState(fightState);
    let actor = getCurrentTurnCharacter(state);

    // Process all consecutive boss/minion turns
    while (actor && actor.type !== CHARACTER_TYPES.PLAYER && !state.isOver) {
      const action = chooseBossAction(actor);
      if (!action) {
        state = advanceTurn(state);
        actor = getCurrentTurnCharacter(state);
        continue;
      }

      const stateBefore = cloneState(state);
      const { newState, result } = executeAction(state, actor.id, action.id);

      if (result.success) {
        setLogs(prev => [...prev, {
          timestamp: Date.now(),
          type: 'action',
          stateBefore,
          stateAfter: newState,
          actionResult: result,
          description: `${actor.name} used ${result.actionName}`,
        }]);

        state = advanceTurn(newState);
        actor = getCurrentTurnCharacter(state);
      } else {
        state = advanceTurn(state);
        actor = getCurrentTurnCharacter(state);
      }
    }

    setLocalFight(state);

    // Post to server
    try {
      const res = await api.postFightState(state, lastFightVersionRef.current);
      if (res.success) {
        lastFightVersionRef.current = res.fightVersion;
      }
    } catch (err) {
      console.error('Failed to post fight state:', err);
    }
    setPosting(false);
    fetchState();
  }, [fightState, currentCharacter, posting, fetchState]);

  const handleAction = useCallback((actionId) => {
    if (!currentCharacter || !isMyTurn) return;

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
        attacker: currentCharacter,
        allCharacters: fightState.characters.filter(c => c.state.isAlive),
      });
    }
  }, [fightState, currentCharacter, isMyTurn]);

  const handleContinue = useCallback(async () => {
    if (!pendingAction) return;

    const { result, newState, stateBefore, actorName } = pendingAction;
    setPosting(true);

    // Log the action
    setLogs(prev => [...prev, {
      timestamp: Date.now(),
      type: 'action',
      stateBefore,
      stateAfter: newState,
      actionResult: result,
      description: `${actorName} used ${result.actionName}`,
    }]);

    // Advance turn
    let state = advanceTurn(newState);

    // Auto-process subsequent boss/minion turns
    let actor = getCurrentTurnCharacter(state);
    while (actor && actor.type !== CHARACTER_TYPES.PLAYER && !state.isOver) {
      const action = chooseBossAction(actor);
      if (!action) {
        state = advanceTurn(state);
        actor = getCurrentTurnCharacter(state);
        continue;
      }

      const bossStateBefore = cloneState(state);
      const { newState: bossNewState, result: bossResult } = executeAction(state, actor.id, action.id);

      if (bossResult.success) {
        setLogs(prev => [...prev, {
          timestamp: Date.now(),
          type: 'action',
          stateBefore: bossStateBefore,
          stateAfter: bossNewState,
          actionResult: bossResult,
          description: `${actor.name} used ${bossResult.actionName}`,
        }]);

        state = advanceTurn(bossNewState);
        actor = getCurrentTurnCharacter(state);
      } else {
        state = advanceTurn(state);
        actor = getCurrentTurnCharacter(state);
      }
    }

    setLocalFight(state);
    setPendingAction(null);

    // Post to server
    try {
      const res = await api.postFightState(state, lastFightVersionRef.current);
      if (res.success) {
        lastFightVersionRef.current = res.fightVersion;
      }
    } catch (err) {
      console.error('Failed to post fight state:', err);
    }

    // Check victory/defeat
    if (state.isOver) {
      if (state.result === 'victory' && activeDungeonId) {
        try {
          await api.dungeonCleared(activeDungeonId);
        } catch (err) {
          console.error('Failed to report dungeon cleared:', err);
        }
      }
    }

    setPosting(false);
    fetchState();
  }, [pendingAction, fetchState, activeDungeonId]);

  const handleRetryFight = useCallback(async () => {
    if (!activeDungeonId || !gameState?.players) return;
    setPosting(true);

    try {
      const fight = buildFightFromServer(gameState.players, activeDungeonId, dungeons);
      setLocalFight(fight);

      const res = await api.postFightState(fight, lastFightVersionRef.current);
      if (res.success) {
        lastFightVersionRef.current = res.fightVersion;
      }

      setLogs([{
        timestamp: Date.now(),
        type: 'fight_start',
        stateBefore: fight,
        stateAfter: fight,
        description: 'Fight restarted!',
      }]);
      setPendingAction(null);
    } catch (err) {
      console.error('Failed to restart fight:', err);
    }

    setPosting(false);
    fetchState();
  }, [activeDungeonId, gameState?.players, dungeons, fetchState]);

  const handleOpenSkills = useCallback((character) => {
    setSelectedCharacterForSkills(character);
    setSkillTreeOpen(true);
  }, []);

  const handleCloseSkills = useCallback(() => {
    setSkillTreeOpen(false);
    setSelectedCharacterForSkills(null);
  }, []);

  const handleCrippleBoss = useCallback(async () => {
    if (!fightState) return;
    const crippled = cloneState(fightState);
    for (const c of crippled.characters) {
      if (c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION) {
        c.state.hp = 1;
      }
    }
    setLocalFight(crippled);
    try {
      const res = await api.postFightState(crippled, lastFightVersionRef.current);
      if (res.success) lastFightVersionRef.current = res.fightVersion;
    } catch (err) {
      console.error('Failed to post crippled state:', err);
    }
    fetchState();
  }, [fightState, fetchState]);

  // Loading state
  if (!fightState) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">Preparing fight...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  const enemies = fightState.characters.filter(
    c => c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION
  );
  const players = fightState.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER
  );

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default', p: 2, display: 'flex' }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold' }}>
              Pub Fight
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {posting && (
                <Typography variant="body2" sx={{ color: '#ffd700' }}>
                  Syncing...
                </Typography>
              )}
              <Button size="small" onClick={() => setShowAdmin(true)} sx={{ color: '#888', minWidth: 'auto', fontSize: '0.75rem' }}>
                Admin
              </Button>
            </Box>
          </Box>

          {/* Fight Over Alert */}
          {fightState.isOver && (
            <Alert
              severity={fightState.result === 'victory' ? 'success' : 'error'}
              sx={{ mb: 2 }}
              action={
                fightState.result === 'defeat' ? (
                  <Button color="inherit" size="small" onClick={handleRetryFight}>
                    Retry Fight
                  </Button>
                ) : null
              }
            >
              {fightState.result === 'victory'
                ? 'Victory! Boss defeated! Leveling up...'
                : 'Defeat! Your party has been wiped out!'}
            </Alert>
          )}

          {/* Current Turn Indicator */}
          {!fightState.isOver && currentCharacter && (
            <Paper sx={{ p: 2, mb: 2, backgroundColor: isMyTurn ? 'rgba(255, 215, 0, 0.15)' : 'rgba(255, 255, 255, 0.05)' }}>
              <Typography variant="h6" sx={{ color: isMyTurn ? '#ffd700' : '#888' }}>
                {isMyTurn ? 'Your Turn!' : `Waiting: ${currentCharacter.name}'s turn`}
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
              {enemies.map(enemy => (
                <CharacterCard
                  key={enemy.id}
                  character={enemy}
                  isCurrentTurn={currentCharacter?.id === enemy.id}
                  onAction={handleAction}
                  showActions={currentCharacter?.id === enemy.id && isMyTurn && !fightState.isOver}
                />
              ))}
            </Box>
          </Box>

          {/* VS Divider */}
          <Box sx={{
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
          }} />

          {/* Players - Bottom */}
          <Box>
            <Typography variant="h6" sx={{ color: '#4CAF50', mb: 2 }}>
              Your Party
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {players.map(player => {
                const isThisPlayersTurn = currentCharacter?.id === player.id;
                const canAct = isThisPlayersTurn && player.id === myPlayer?.id && !fightState.isOver;

                return (
                  <CharacterCard
                    key={player.id}
                    character={player}
                    isCurrentTurn={isThisPlayersTurn}
                    onAction={handleAction}
                    showActions={canAct}
                    onOpenSkills={() => handleOpenSkills(player)}
                    ownedSkillCount={player.ownedSkillIds?.length || 0}
                    perkPoints={player.perkPoints || 0}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Action Popover */}
        <ActionPopover
          open={!!pendingAction}
          actionResult={pendingAction?.result}
          attacker={pendingAction?.attacker || null}
          allCharacters={pendingAction?.allCharacters || []}
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
            onUnlockSkill={() => {}}
          />
        )}

        {showAdmin && (
          <AdminModal
            gameState={gameState}
            dungeons={dungeons}
            onClose={() => setShowAdmin(false)}
            fetchState={fetchState}
            onCrippleBoss={handleCrippleBoss}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}
