import { useState } from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { GiBeerStein } from 'react-icons/gi';
import { LuPlus, LuDoorOpen } from 'react-icons/lu';
import { api } from '../api/client';

export function GameSelectScreen({ onSelectGame }) {
  const [mode, setMode] = useState(null); // null | 'join'
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameInfo, setGameInfo] = useState(null);

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.createGame();
      onSelectGame(result.gameCode);
    } catch (err) {
      setError('Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 4);
    setCode(val);
    setError('');
    setGameInfo(null);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (code.length !== 4) return;
    setLoading(true);
    setError('');
    try {
      const result = await api.checkGame(code);
      if (!result.exists) {
        setError('Game not found');
        setGameInfo(null);
      } else {
        setGameInfo(result);
        onSelectGame(code);
      }
    } catch (err) {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        px: 2.5,
      }}
    >
      <GiBeerStein size={48} color="#f59e0b" style={{ marginBottom: 8 }} />
      <Typography
        variant="h3"
        sx={{
          fontWeight: 'bold',
          mb: 4,
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        Pub Fight
      </Typography>

      {mode === null && (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: 300 }}
        >
          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={loading}
            onClick={handleCreate}
            startIcon={<LuPlus size={20} />}
            sx={{ fontSize: '1.1rem', fontWeight: 'bold', py: 1.5 }}
          >
            {loading ? 'Creating...' : 'Create Game'}
          </Button>
          <Button
            variant="outlined"
            color="primary"
            size="large"
            onClick={() => setMode('join')}
            startIcon={<LuDoorOpen size={20} />}
            sx={{ fontSize: '1.1rem', fontWeight: 'bold', py: 1.5 }}
          >
            Join Game
          </Button>
        </Box>
      )}

      {mode === 'join' && (
        <Box
          component={motion.div}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', maxWidth: 300 }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Enter the 4-character game code
          </Typography>
          <Box component="form" onSubmit={handleJoin} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              value={code}
              onChange={handleCodeChange}
              placeholder="K7XP"
              autoFocus
              disabled={loading}
              fullWidth
              slotProps={{
                input: {
                  sx: {
                    textAlign: 'center',
                    fontSize: '2rem',
                    fontFamily: 'monospace',
                    letterSpacing: '0.3em',
                    fontWeight: 'bold',
                  },
                },
              }}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={loading || code.length !== 4}
              sx={{ fontSize: '1.1rem', fontWeight: 'bold', py: 1.25 }}
            >
              {loading ? 'Checking...' : 'Join'}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => { setMode(null); setCode(''); setError(''); setGameInfo(null); }}
              sx={{ color: 'text.secondary' }}
            >
              Back
            </Button>
          </Box>
          {error && (
            <Typography color="secondary.main" sx={{ textAlign: 'center' }}>
              {error}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
