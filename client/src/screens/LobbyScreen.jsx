import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { GiShield, GiSwordWound, GiWizardStaff, GiCauldron } from 'react-icons/gi';
import { LuPlus, LuChevronLeft } from 'react-icons/lu';
import { api } from '../api/client';

const CLASS_OPTIONS = [
  { id: 'tank', name: 'Tank', Icon: GiShield, desc: 'High HP, shields, protects allies' },
  { id: 'warrior', name: 'Warrior', Icon: GiSwordWound, desc: 'High damage, multi-hit attacks' },
  { id: 'wizard', name: 'Wizard', Icon: GiWizardStaff, desc: 'Powerful AoE magic, high dexterity' },
  { id: 'alchemist', name: 'Alchemist', Icon: GiCauldron, desc: 'Healing, buffs, support' },
];

const CLASS_ICON_MAP = {
  tank: GiShield,
  warrior: GiSwordWound,
  wizard: GiWizardStaff,
  alchemist: GiCauldron,
};

const PORTRAITS = {
  ehsan: '/portraits/ehsan.png',
  dennis: '/portraits/dennis.png',
  budde: '/portraits/budde.png',
  matthias: '/portraits/matthias.png',
};

export function LobbyScreen({ gameState, myPlayerId, onSelectPlayer, onReleasePlayer, onLeaveGame, fetchState }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedClass, setSelectedClass] = useState('warrior');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sessionId = localStorage.getItem('sessionId');
  const players = gameState?.players ? Object.values(gameState.players) : [];
  const phase = gameState?.phase || 'lobby';
  const takenClasses = new Set(players.map((p) => p.class));

  // Auto-select first available class when taken classes change
  useEffect(() => {
    if (takenClasses.has(selectedClass)) {
      const available = CLASS_OPTIONS.find((c) => !takenClasses.has(c.id));
      if (available) setSelectedClass(available.id);
    }
  }, [players.length]);


  const handleTakeControl = async (playerId) => {
    if (myPlayerId || loading) return;
    setLoading(true);
    try {
      const result = await api.join(playerId);
      if (result.success) {
        onSelectPlayer(playerId);
        fetchState();
      } else {
        setError(result.error || 'Failed to take control');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);

    try {
      const result = await api.join(null, newName.trim(), selectedClass);
      if (result.success) {
        onSelectPlayer(result.player.id);
        setShowCreate(false);
        setNewName('');
        fetchState();
      } else {
        setError(result.error || 'Failed to create player');
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!myPlayerId) return;
    try {
      await api.release(myPlayerId);
      onReleasePlayer();
      fetchState();
    } catch (err) {
      setError('Failed to release');
    }
  };

  const handleStartGame = async () => {
    try {
      const result = await api.startGame();
      if (result.success) {
        fetchState();
      } else {
        setError(result.error || 'Failed to start game');
      }
    } catch (err) {
      setError('Connection failed');
    }
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh',
        px: 2.5,
        pt: 2.5,
        pb: myPlayerId && phase === 'lobby' ? '120px' : 2.5,
      }}
    >
      <Button
        variant="text"
        startIcon={<LuChevronLeft />}
        onClick={() => showCreate ? setShowCreate(false) : onLeaveGame()}
        sx={{
          color: 'text.secondary',
          fontSize: '0.85rem',
          alignSelf: 'flex-start',
          mb: 1,
          minHeight: 36,
        }}
      >
        Back
      </Button>

      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0.5 }}>
        Pub Fight
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {phase === 'lobby' ? 'Pick your fighter' : 'Game in progress - select your character'}
      </Typography>

      {gameState?.gameCode && (
        <Typography
          variant="body2"
          sx={{
            mb: 2,
            fontFamily: 'monospace',
            fontWeight: 'bold',
            letterSpacing: '0.15em',
            color: 'primary.main',
            bgcolor: 'rgba(245,158,11,0.1)',
            px: 1.5,
            py: 0.5,
            borderRadius: 1,
          }}
        >
          Game Code: {gameState.gameCode}
        </Typography>
      )}

      {error && (
        <Typography color="secondary.main" sx={{ mb: 1.5 }}>
          {error}
        </Typography>
      )}

      {/* Player list */}
      <Box sx={{ width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
        {players.length === 0 && (
          <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
            No players yet. Create one!
          </Typography>
        )}
        {players.map((player) => {
          const isControlled = !!player.controlledBy;
          const isMine = player.controlledBy === sessionId;
          const ClassIcon = CLASS_ICON_MAP[player.class];
          const portrait = PORTRAITS[player.name.toLowerCase()];

          const canSelect = !myPlayerId && !isMine && !loading;

          return (
            <Box
              key={player.id}
              component={motion.div}
              whileTap={canSelect ? { scale: 0.97 } : undefined}
              onClick={() => canSelect && handleTakeControl(player.id)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                px: 2,
                py: 1.5,
                borderRadius: 1,
                bgcolor: isMine ? 'primary.main' : 'rgba(255,255,255,0.08)',
                color: isMine ? 'background.default' : 'text.primary',
                opacity: isControlled && !isMine ? 0.5 : 1,
                cursor: canSelect ? 'pointer' : 'default',
                transition: 'background 0.2s',
              }}
            >
              {/* Avatar */}
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...(portrait
                    ? {
                        backgroundImage: `url(${portrait})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {
                        bgcolor: isMine ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)',
                      }),
                  border: 2,
                  borderColor: isMine ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.15)',
                }}
              >
                {!portrait && ClassIcon && <ClassIcon size={22} />}
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {player.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ opacity: 0.7, textTransform: 'capitalize' }}
                >
                  {player.class} Lv.{player.level}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ opacity: 0.7, flexShrink: 0 }}>
                {isMine ? '(You)' : isControlled ? '(Taken)' : '(Available)'}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* New player button */}
      {phase === 'lobby' && !showCreate && (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<LuPlus />}
          onClick={() => setShowCreate(true)}
          sx={{ mb: 3 }}
        >
          New Player
        </Button>
      )}

      {/* Create player form */}
      <AnimatePresence>
        {showCreate && (
          <Box
            component={motion.form}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              width: '100%',
              maxWidth: 400,
              mb: 3,
              overflow: 'hidden',
            }}
          >
            <TextField
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              fullWidth
              slotProps={{
                htmlInput: { maxLength: 20 },
                input: { sx: { textAlign: 'center', fontSize: '1.1rem' } },
              }}
            />

            {/* Class grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              {CLASS_OPTIONS.map((cls) => {
                const selected = selectedClass === cls.id;
                const taken = takenClasses.has(cls.id);
                return (
                  <Box
                    key={cls.id}
                    onClick={() => !taken && setSelectedClass(cls.id)}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      p: 1,
                      borderRadius: 1,
                      border: 2,
                      borderColor: selected && !taken ? 'primary.main' : 'transparent',
                      bgcolor: selected && !taken
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(255,255,255,0.05)',
                      cursor: taken ? 'not-allowed' : 'pointer',
                      opacity: taken ? 0.4 : 1,
                      gap: 0.25,
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                  >
                    <cls.Icon size={24} color={selected && !taken ? '#f59e0b' : '#f5f0e8'} />
                    <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                      {cls.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ opacity: 0.6, textAlign: 'center', lineHeight: 1.2 }}
                    >
                      {taken ? 'Taken' : cls.desc}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{ fontWeight: 'bold' }}
            >
              {loading ? 'Creating...' : 'Create'}
            </Button>
          </Box>
        )}
      </AnimatePresence>

      {/* Bottom bar: release + start */}
      {myPlayerId && phase === 'lobby' && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            right: 20,
            display: 'flex',
            gap: 1.5,
            maxWidth: 400,
            mx: 'auto',
          }}
        >
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleRelease}
            sx={{ flex: 1 }}
          >
            Release
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleStartGame}
            disabled={players.length < 1}
            sx={{ flex: 2, fontWeight: 'bold', fontSize: '1.1rem' }}
          >
            Start Game ({players.length} player{players.length !== 1 ? 's' : ''})
          </Button>
        </Box>
      )}

    </Box>
  );
}
