import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { GiCrossedSwords } from 'react-icons/gi';
import { BattleCharacter } from '../components/BattleCharacter.jsx';
import { BattleTurnStrip } from '../components/BattleTurnStrip.jsx';
import { BattleActionBar } from '../components/BattleActionBar.jsx';
import { BattleFeedback } from '../components/BattleFeedback.jsx';
import { BattleWheel } from '../components/BattleWheel.jsx';
import { ActionPopover } from '../components/ActionPopover.jsx';
import { GameLog } from '../components/GameLog.jsx';
import { PlayerDetailOverlay } from '../components/PlayerDetailOverlay.jsx';
import { EnemyInfoDialog } from '../components/EnemyInfoDialog.jsx';
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
import { useSkills } from '../hooks/useSkills.js';
import { api } from '../api/client.js';

// Set to true to use the old ActionPopover dialog instead of inline wheel
const DEBUG_ACTION_POPOVER = false;

// Timing constants for action animations (ms)
const IMPACT_DELAY = 1200;  // When damage applies + shake + combat text
const CLEAR_DELAY = 3600;   // When animation clears and next starts
// Remote animations play faster — HP bars snap anyway, just need the visual cue
const REMOTE_IMPACT_DELAY = 600;
const REMOTE_CLEAR_DELAY = 1800;

/**
 * Collect all consecutive boss/minion turns into an animation queue.
 * Returns { actions: [...], finalState } where each action has all the
 * data needed for animation and state updates.
 */
function collectBossTurns(startState) {
  const actions = [];
  let state = cloneState(startState);
  let actor = getCurrentTurnCharacter(state);

  while (actor && actor.type !== CHARACTER_TYPES.PLAYER && !state.isOver) {
    const action = chooseBossAction(actor, state);
    if (!action) {
      state = advanceTurn(state);
      actor = getCurrentTurnCharacter(state);
      continue;
    }

    const stateBefore = cloneState(state);
    const { newState, result } = executeAction(state, actor.id, action.id);

    if (result.success) {
      newState.actionLog = [...(newState.actionLog || []), {
        timestamp: Date.now(),
        type: 'action',
        actorId: actor.id,
        actorName: actor.name,
        actorType: actor.type,
        actionName: result.actionName,
        description: `${actor.name} used ${result.actionName}`,
        actionResult: result,
      }];
      const stateAfterTurn = advanceTurn(newState);
      actions.push({
        actorId: actor.id,
        actorName: actor.name,
        actorType: actor.type,
        actionName: result.actionName,
        result,
        stateAfterAction: newState,
        stateAfterTurn,
      });
      state = stateAfterTurn;
      actor = getCurrentTurnCharacter(state);
    } else {
      state = advanceTurn(state);
      actor = getCurrentTurnCharacter(state);
    }
  }

  return { actions, finalState: state };
}

export function FightScreen({ gameState, myPlayer, fetchState, showAdmin, onCloseAdmin }) {
  const { skills: serverSkills, loading: skillsLoading } = useSkills();
  const [localFight, setLocalFight] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [selectedPlayerForDetail, setSelectedPlayerForDetail] = useState(null);
  const [posting, setPosting] = useState(false);
  const lastFightVersionRef = useRef(-1);
  const initRef = useRef(false);

  // Animation queue state
  const [animQueue, setAnimQueue] = useState([]);
  const animPlayingRef = useRef(false);
  const animTimersRef = useRef([]);
  const [activeAnim, setActiveAnim] = useState(null);
  const [showImpact, setShowImpact] = useState(false);
  const [hitTargets, setHitTargets] = useState(new Set());
  const finalAnimStateRef = useRef(null);
  const postToServerRef = useRef(null);
  const bossTurnScheduledRef = useRef(false);

  // Remote animation tracking — lets us replay other players' actions
  const seenLogLenRef = useRef(0);
  const isRemoteAnimRef = useRef(false);

  // Inline wheel state (new flow)
  const [pendingWheelAction, setPendingWheelAction] = useState(null);
  const [isPlayerAnim, setIsPlayerAnim] = useState(false);

  // Manual target selection state (for Precision etc.)
  const [pendingManualAction, setPendingManualAction] = useState(null);

  // Enemy info dialog state
  const [enemyInfoCharacter, setEnemyInfoCharacter] = useState(null);

  const activeDungeonId = gameState?.activeDungeonId;
  const serverFight = gameState?.fightState;
  const serverFightVersion = gameState?.fightVersion ?? 0;
  const dungeons = gameState?.dungeons || [];

  // Post final state to server (victory progression now handled by confirm-victory)
  const postToServer = useCallback(async (state) => {
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
  }, [fetchState]);

  // Keep ref in sync so timers always call the latest version
  postToServerRef.current = postToServer;

  // Clean up animation timers on unmount
  useEffect(() => {
    return () => {
      animTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // --- Animation Queue Processor ---
  // Uses a ref for the "playing" lock so setting it doesn't trigger re-renders
  // that would clean up our timers.
  useEffect(() => {
    if (animPlayingRef.current || animQueue.length === 0) return;

    animPlayingRef.current = true;
    const current = animQueue[0];
    const isLastInQueue = animQueue.length === 1;

    // Phase 1: Show banner + beam starts
    setIsPlayerAnim(!!current.isPlayerAction);
    setActiveAnim({
      actorId: current.actorId,
      actorName: current.actorName,
      actorType: current.actorType,
      actionName: current.actionName,
      targetResults: current.result.targetResults,
      selfEffects: current.result.selfResults,
    });
    setShowImpact(false);
    setHitTargets(new Set());

    // Phase 2: Impact - apply damage, show shake + combat text
    // For remote animations, freeze HP bars — combat text still shows per-action values
    const isRemote = isRemoteAnimRef.current;
    const impactDelay = isRemote ? REMOTE_IMPACT_DELAY : IMPACT_DELAY;
    const clearDelay = isRemote ? REMOTE_CLEAR_DELAY : CLEAR_DELAY;
    const t1 = setTimeout(() => {
      if (!isRemote) {
        setLocalFight(current.stateAfterAction);
      }
      setShowImpact(true);
      const hitIds = (current.result.targetResults || [])
        .filter(tr => tr.hit !== false)
        .map(tr => tr.targetId);
      setHitTargets(new Set(hitIds));
    }, impactDelay);

    // Phase 3: Clear animation, advance turn, move to next
    const t2 = setTimeout(() => {
      setActiveAnim(null);
      setShowImpact(false);
      setHitTargets(new Set());
      if (!isRemote) {
        setLocalFight(current.stateAfterTurn);
      }

      animPlayingRef.current = false;
      setAnimQueue(prev => prev.slice(1));

      // If this was the last animation, post or snap final state
      if (isLastInQueue && finalAnimStateRef.current) {
        const finalState = finalAnimStateRef.current;
        finalAnimStateRef.current = null;
        if (isRemote) {
          isRemoteAnimRef.current = false;
          setLocalFight(finalState);
        } else {
          postToServerRef.current(finalState);
        }
      }
    }, clearDelay);

    animTimersRef.current = [t1, t2];
  }, [animQueue]);

  // Start an animation sequence for boss turns
  const startBossAnimations = useCallback((startState) => {
    isRemoteAnimRef.current = false;
    const { actions, finalState } = collectBossTurns(startState);
    seenLogLenRef.current = finalState.actionLog?.length || 0;

    if (actions.length === 0) {
      setLocalFight(finalState);
      postToServer(finalState);
      return;
    }

    setIsPlayerAnim(false);
    setAnimQueue(actions);
    // Post immediately so other players see the update during our animations
    postToServer(finalState);
  }, [postToServer]);

  // --- Initialize fight state ---
  useEffect(() => {
    if (!activeDungeonId || initRef.current || skillsLoading || !serverSkills.length) return;

    if (!serverFight && gameState?.players) {
      initRef.current = true;
      try {
        const fight = buildFightFromServer(gameState.players, activeDungeonId, dungeons, serverSkills);
        fight.actionLog = [{ timestamp: Date.now(), type: 'fight_start', description: 'Fight started!' }];
        seenLogLenRef.current = fight.actionLog.length;
        setLocalFight(fight);

        api.postFightState(fight, 0).then(res => {
          if (res.success) {
            lastFightVersionRef.current = res.fightVersion;
          }
          fetchState();
        });
      } catch (err) {
        console.error('Failed to build fight:', err);
      }
    }
  }, [activeDungeonId, serverFight, gameState?.players, dungeons, fetchState, serverSkills, skillsLoading]);

  // Sync from server fight state — detect new actions and animate them
  useEffect(() => {
    if (!serverFight) return;
    if (serverFightVersion <= lastFightVersionRef.current) return;
    // Don't interrupt ongoing animations or wheel spin — next poll will catch up
    if (animQueue.length > 0 || posting || pendingWheelAction) return;

    // First sync (page load / join mid-fight) — just accept state, don't replay history
    if (lastFightVersionRef.current === -1) {
      lastFightVersionRef.current = serverFightVersion;
      seenLogLenRef.current = serverFight.actionLog?.length || 0;
      setLocalFight(serverFight);
      return;
    }

    lastFightVersionRef.current = serverFightVersion;

    // Check for new action log entries to replay as animations
    const serverLogLen = serverFight.actionLog?.length || 0;
    const newEntries = (serverFight.actionLog || []).slice(seenLogLenRef.current);
    const animatable = newEntries.filter(e => e.type === 'action' && e.actionResult);

    seenLogLenRef.current = serverLogLen;

    // Animate remote actions (cap at 6 to avoid long replays on reconnect)
    if (animatable.length > 0 && animatable.length <= 6) {
      const remoteAnims = animatable.map(entry => ({
        actorId: entry.actorId,
        actorName: entry.actorName,
        actorType: entry.actorType,
        actionName: entry.actionName,
        result: entry.actionResult,
        stateAfterAction: serverFight,
        stateAfterTurn: serverFight,
        isPlayerAction: entry.actorType === CHARACTER_TYPES.PLAYER,
      }));
      isRemoteAnimRef.current = true;
      finalAnimStateRef.current = serverFight;
      setAnimQueue(remoteAnims);
    } else {
      setLocalFight(serverFight);
    }
  }, [serverFight, serverFightVersion, animQueue.length, posting, pendingWheelAction]);


  const fightState = localFight;
  const currentCharacter = fightState ? getCurrentTurnCharacter(fightState) : null;

  const isMyTurn = currentCharacter?.type === CHARACTER_TYPES.PLAYER &&
    currentCharacter?.id === myPlayer?.id;

  const isPlayerTurn = currentCharacter?.type === CHARACTER_TYPES.PLAYER;

  // Find my own character in the fight state (for showing skills when it's not my turn)
  const myCharacter = fightState?.characters?.find(
    (c) => c.type === CHARACTER_TYPES.PLAYER && c.id === myPlayer?.id
  ) || null;

  // Auto-process boss/minion turns (now animated)
  // IMPORTANT: No state changes before the timer fires — otherwise React
  // cleanup would cancel the timer (the same bug class as the animPlaying fix).
  useEffect(() => {
    if (!fightState || fightState.isOver || posting || animPlayingRef.current || animQueue.length > 0) return;
    if (!currentCharacter || isPlayerTurn) return;
    if (bossTurnScheduledRef.current) return;

    const playerIds = Object.keys(gameState?.players || {});
    const myIndex = playerIds.indexOf(myPlayer?.id);
    if (myIndex !== 0) return;

    bossTurnScheduledRef.current = true;
    const timer = setTimeout(() => {
      bossTurnScheduledRef.current = false;
      setPosting(true);
      startBossAnimations(fightState);
    }, 600);

    return () => {
      clearTimeout(timer);
      bossTurnScheduledRef.current = false;
    };
  }, [fightState?.currentTurnIndex, posting, animQueue.length]);

  // Feed a player action through the animation queue (same system as boss turns)
  const animatePlayerAction = useCallback((result, stateBefore, newState, actor) => {
    // Safety: ensure local actions are never treated as remote
    isRemoteAnimRef.current = false;
    const stateAfterTurn = advanceTurn(newState);

    const animAction = {
      actorId: actor.id,
      actorName: actor.name,
      actorType: actor.type,
      actionName: result.actionName,
      result,
      stateAfterAction: newState,
      stateAfterTurn,
      isPlayerAction: true,
    };

    // Check if boss turns follow
    const nextActor = getCurrentTurnCharacter(stateAfterTurn);
    const hasBossTurns = nextActor &&
      nextActor.type !== CHARACTER_TYPES.PLAYER &&
      !stateAfterTurn.isOver;

    if (hasBossTurns) {
      // Queue player anim, then collect + queue boss anims
      const { actions: bossActions, finalState } = collectBossTurns(stateAfterTurn);
      const allActions = [animAction, ...bossActions];
      seenLogLenRef.current = finalState.actionLog?.length || 0;
      setIsPlayerAnim(true);
      setPosting(true);
      setAnimQueue(allActions);
      // Post immediately so other players see the update during our animations
      postToServerRef.current(finalState);
    } else {
      // Just the player action, then post
      seenLogLenRef.current = stateAfterTurn.actionLog?.length || 0;
      setIsPlayerAnim(true);
      setPosting(true);
      setAnimQueue([animAction]);
      postToServerRef.current(stateAfterTurn);
    }
  }, []);

  // --- Execute action (shared by normal + manual targeting flows) ---
  const executeAndAnimate = useCallback((actionId, manualTargetId) => {
    if (!currentCharacter || !isMyTurn) return;

    const stateBefore = cloneState(fightState);
    const { newState, result } = executeAction(
      fightState,
      currentCharacter.id,
      actionId,
      manualTargetId
    );

    if (!result.success) return;

    // Add to the fight state's action log so it syncs to all clients
    newState.actionLog = [...(newState.actionLog || []), {
      timestamp: Date.now(),
      type: 'action',
      actorId: currentCharacter.id,
      actorName: currentCharacter.name,
      actorType: currentCharacter.type,
      actionName: result.actionName,
      description: `${currentCharacter.name} used ${result.actionName}`,
      actionResult: result,
    }];

    // Old debug flow
    if (DEBUG_ACTION_POPOVER) {
      setPendingAction({
        result,
        newState,
        stateBefore,
        actorName: currentCharacter.name,
        attacker: currentCharacter,
        allCharacters: fightState.characters.filter(c => c.state.isAlive),
      });
      return;
    }

    // New inline flow
    const hasWheel = result.wheelResults?.length > 0;

    if (hasWheel) {
      setPendingWheelAction({
        result,
        newState,
        stateBefore,
        actor: currentCharacter,
        allCharacters: fightState.characters.filter(c => c.state.isAlive),
      });
    } else {
      animatePlayerAction(result, stateBefore, newState, currentCharacter);
    }
  }, [fightState, currentCharacter, isMyTurn, animatePlayerAction]);

  // --- Player Actions ---
  const handleAction = useCallback((actionId) => {
    if (!currentCharacter || !isMyTurn) return;

    const action = currentCharacter.actions.find(a => a.id === actionId);
    if (!action) return;

    // Manual targeting: select a target first
    if (action.targetType === 'manual') {
      // Determine if this targets allies (heals/buffs) or enemies (damage/debuffs)
      const hasRevive = action.effects.some(e => e.type === 'revive');
      const isFriendly = action.effects.some(e =>
        e.type === 'heal' || e.type === 'modifyAP' || e.type === 'revive'
      );

      let validTargets;
      if (isFriendly) {
        // Revive targets dead allies; heals/buffs target alive allies
        validTargets = fightState.characters.filter(c =>
          c.type === CHARACTER_TYPES.PLAYER &&
          (hasRevive ? !c.state.isAlive : c.state.isAlive)
        );
      } else {
        validTargets = fightState.characters.filter(c =>
          (c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION) && c.state.isAlive
        );
      }

      if (validTargets.length === 0) return;

      // Auto-select if only one valid target
      if (validTargets.length === 1) {
        executeAndAnimate(actionId, validTargets[0].id);
        return;
      }

      // Multiple targets: enter selection mode
      setPendingManualAction({ actionId, actionName: action.name, isFriendly, hasRevive });
      return;
    }

    executeAndAnimate(actionId);
  }, [fightState, currentCharacter, isMyTurn, executeAndAnimate]);

  // Handle enemy click during manual target selection
  const handleTargetSelect = useCallback((enemyId) => {
    if (!pendingManualAction) return;
    const { actionId } = pendingManualAction;
    setPendingManualAction(null);
    executeAndAnimate(actionId, enemyId);
  }, [pendingManualAction, executeAndAnimate]);

  const cancelTargetSelection = useCallback(() => {
    setPendingManualAction(null);
  }, []);

  // Called when BattleWheel finishes spinning — transition to BattleFeedback
  const handleWheelComplete = useCallback(() => {
    if (!pendingWheelAction) return;
    const { result, stateBefore, newState, actor } = pendingWheelAction;
    setPendingWheelAction(null);
    animatePlayerAction(result, stateBefore, newState, actor);
  }, [pendingWheelAction, animatePlayerAction]);

  const handleContinue = useCallback(async () => {
    if (!pendingAction) return;

    const { result, newState } = pendingAction;

    const stateAfterPlayerTurn = advanceTurn(newState);
    setPendingAction(null);

    // Check if boss turns follow
    const nextActor = getCurrentTurnCharacter(stateAfterPlayerTurn);
    const hasBossTurns = nextActor &&
      nextActor.type !== CHARACTER_TYPES.PLAYER &&
      !stateAfterPlayerTurn.isOver;

    if (hasBossTurns) {
      setLocalFight(stateAfterPlayerTurn);
      setPosting(true);
      // Short delay before boss animations start
      setTimeout(() => {
        startBossAnimations(stateAfterPlayerTurn);
      }, 300);
    } else {
      setLocalFight(stateAfterPlayerTurn);
      setPosting(true);
      postToServer(stateAfterPlayerTurn);
    }
  }, [pendingAction, startBossAnimations, postToServer]);

  const handleRetryFight = useCallback(async () => {
    if (!activeDungeonId || !gameState?.players) return;
    setPosting(true);

    try {
      const fight = buildFightFromServer(gameState.players, activeDungeonId, dungeons, serverSkills);
      fight.actionLog = [{ timestamp: Date.now(), type: 'fight_start', description: 'Fight restarted!' }];
      seenLogLenRef.current = fight.actionLog.length;
      setLocalFight(fight);

      const res = await api.postFightState(fight, lastFightVersionRef.current);
      if (res.success) {
        lastFightVersionRef.current = res.fightVersion;
      }
      setPendingAction(null);
      setPendingWheelAction(null);
      setPendingManualAction(null);
      setAnimQueue([]);
      setActiveAnim(null);
      setHitTargets(new Set());
      setIsPlayerAnim(false);
      animPlayingRef.current = false;
      bossTurnScheduledRef.current = false;
      isRemoteAnimRef.current = false;
      animTimersRef.current.forEach(clearTimeout);
    } catch (err) {
      console.error('Failed to restart fight:', err);
    }

    setPosting(false);
    fetchState();
  }, [activeDungeonId, gameState?.players, dungeons, fetchState]);

  const handleConfirmVictory = useCallback(async () => {
    if (!myPlayer?.id) return;
    try {
      await api.confirmVictory(myPlayer.id);
    } catch (err) {
      console.error('Failed to confirm victory:', err);
    }
    fetchState();
  }, [myPlayer?.id, fetchState]);

  const handleOpenPlayerDetail = useCallback((character) => {
    setSelectedPlayerForDetail(character);
  }, []);

  const handleCrippleBoss = useCallback(async () => {
    if (!fightState) return;
    const crippled = cloneState(fightState);
    for (const c of crippled.characters) {
      if (c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION) {
        c.state.health = 1;
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
      <Box
        sx={{
          height: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 100%)',
        }}
      >
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
            Preparing fight...
          </Typography>
        </motion.div>
      </Box>
    );
  }

  const enemies = fightState.characters.filter(
    c => c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION
  );
  const players = fightState.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER
  );

  // During animations, disable player actions
  const isAnimating = animQueue.length > 0 || activeAnim !== null || pendingWheelAction !== null;

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 30%, #1a1a2e 0%, #0d0d1a 70%, #050510 100%)',
        position: 'relative',
      }}
    >
      {/* Atmospheric vignette */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)',
          zIndex: 0,
        }}
      />

      {/* Main layout */}
      <Box sx={{ flex: 1, position: 'relative', zIndex: 1, overflow: 'hidden' }}>
        {/* Turn Order Strip - floating, centered */}
        <BattleTurnStrip
          characters={fightState.characters}
          turnOrder={fightState.turnOrder}
          currentTurnIndex={fightState.currentTurnIndex}
        />

        {/* Battlefield */}
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Sync indicator */}
          {posting && (
            <Box sx={{ position: 'absolute', top: 4, right: 40, zIndex: 10 }}>
              <Typography sx={{ color: 'primary.main', fontSize: '0.6rem', opacity: 0.7 }}>
                syncing...
              </Typography>
            </Box>
          )}

          {/* Level indicator */}
          <Box sx={{ textAlign: 'center', pt: 1, pb: 0.5 }}>
            <Typography
              sx={{
                fontSize: '0.6rem',
                color: 'rgba(168, 160, 149, 0.5)',
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              {fightState.level ? `Level ${fightState.level}` : 'Battle'}
            </Typography>
          </Box>

          {/* Enemy Zone */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-end',
              pb: 1.5,
              px: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: { xs: 2, sm: 3 },
                alignItems: 'flex-end',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {(() => {
                const boss = enemies.find(e => e.type === CHARACTER_TYPES.BOSS);
                const minions = enemies.filter(e => e.type === CHARACTER_TYPES.MINION);
                const half = Math.ceil(minions.length / 2);
                const ordered = [...minions.slice(0, half), ...(boss ? [boss] : []), ...minions.slice(half)];
                return ordered.map(enemy => (
                  <BattleCharacter
                    key={enemy.id}
                    character={enemy}
                    isCurrentTurn={currentCharacter?.id === enemy.id}
                    isEnemy
                    size={enemy.type === CHARACTER_TYPES.BOSS ? 'boss' : 'normal'}
                    isBeingHit={hitTargets.has(enemy.id)}
                    isTargetable={!!pendingManualAction && enemy.state.isAlive}
                    onClick={pendingManualAction && enemy.state.isAlive ? () => handleTargetSelect(enemy.id) : () => setEnemyInfoCharacter(enemy)}
                  />
                ));
              })()}
            </Box>
          </Box>

          {/* Battle Line */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              py: 0.5,
              px: 2,
            }}
          >
            <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.2), transparent)' }} />
            <Box sx={{ px: 1.5 }}>
              <GiCrossedSwords size={16} color="rgba(245, 158, 11, 0.3)" />
            </Box>
            <Box sx={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(245, 158, 11, 0.2), transparent)' }} />
          </Box>

          {/* Player Zone */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              pt: 1.5,
              px: 1,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: { xs: 2, sm: 3 },
                alignItems: 'flex-start',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {players.map(player => {
                const isValidTarget = pendingManualAction?.isFriendly && (
                  pendingManualAction.hasRevive ? !player.state.isAlive : player.state.isAlive
                );
                return (
                  <BattleCharacter
                    key={player.id}
                    character={player}
                    isCurrentTurn={currentCharacter?.id === player.id}
                    isEnemy={false}
                    onClick={isValidTarget ? () => handleTargetSelect(player.id) : () => handleOpenPlayerDetail(player)}
                    isBeingHit={hitTargets.has(player.id)}
                    isTargetable={isValidTarget}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Action Bar or Target Selection Prompt */}
      {pendingManualAction ? (
        <Box
          sx={{
            borderTop: '2px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '16px 16px 0 0',
            px: 2,
            py: 2,
            pb: 'env(safe-area-inset-bottom, 12px)',
            background: 'linear-gradient(0deg, rgba(0,0,0,0.6) 0%, rgba(26, 26, 46, 0.95) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Typography
            sx={{
              color: 'primary.main',
              fontWeight: 700,
              fontSize: '0.9rem',
              textShadow: '0 0 8px rgba(245, 158, 11, 0.4)',
            }}
          >
            Tap {pendingManualAction.isFriendly ? 'an ally' : 'an enemy'} to {pendingManualAction.actionName}
          </Typography>
          <Box
            onClick={cancelTargetSelection}
            sx={{
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'text.secondary',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
              '&:active': { background: 'rgba(255,255,255,0.1)' },
            }}
          >
            Cancel
          </Box>
        </Box>
      ) : (
        <BattleActionBar
          isMyTurn={isMyTurn && !isAnimating}
          currentCharacter={currentCharacter}
          myCharacter={myCharacter}
          myPlayer={myPlayer}
          fightOver={fightState.isOver}
          fightResult={fightState.result}
          onAction={handleAction}
          onRetry={handleRetryFight}
          onConfirmVictory={handleConfirmVictory}
          victoryConfirmations={gameState?.victoryConfirmations || []}
          gamePlayers={gameState?.players || {}}
          posting={posting || isAnimating}
        />
      )}

      {/* Battle Feedback Overlay (beams, banner, combat text) */}
      <BattleFeedback
        animation={activeAnim}
        showImpact={showImpact}
        isPlayerAction={isPlayerAnim}
      />

      {/* Inline Battle Wheel (new flow) */}
      {pendingWheelAction && (
        <BattleWheel
          wheelResults={pendingWheelAction.result.wheelResults}
          attacker={pendingWheelAction.actor}
          allCharacters={pendingWheelAction.allCharacters}
          onComplete={handleWheelComplete}
        />
      )}

      {/* Action Popover (old debug flow) */}
      {DEBUG_ACTION_POPOVER && (
        <ActionPopover
          open={!!pendingAction}
          actionResult={pendingAction?.result}
          attacker={pendingAction?.attacker || null}
          allCharacters={pendingAction?.allCharacters || []}
          onContinue={handleContinue}
        />
      )}

      {/* Game Log */}
      <GameLog logs={fightState?.actionLog || []} open={showLog} onToggle={() => setShowLog(!showLog)} />

      {/* Player Detail Overlay */}
      {selectedPlayerForDetail && (
        <PlayerDetailOverlay
          player={selectedPlayerForDetail}
          onClose={() => setSelectedPlayerForDetail(null)}
        />
      )}

      {/* Enemy Info Dialog */}
      <EnemyInfoDialog
        open={!!enemyInfoCharacter}
        onClose={() => setEnemyInfoCharacter(null)}
        character={enemyInfoCharacter}
      />

      {showAdmin && (
        <AdminModal
          gameState={gameState}
          dungeons={dungeons}
          onClose={onCloseAdmin}
          fetchState={fetchState}
          onCrippleBoss={handleCrippleBoss}
          onRestartFight={handleRetryFight}
          onOpenLog={() => setShowLog(true)}
        />
      )}
    </Box>
  );
}
