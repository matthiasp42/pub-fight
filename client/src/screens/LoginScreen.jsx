import { useState } from 'react';
import { Box, Typography, TextField, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { GiBeerStein } from 'react-icons/gi';
import { api } from '../api/client';

export function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api.auth(password);
      if (result.success) {
        localStorage.setItem('sessionId', result.sessionId);
        onLogin();
      } else {
        setError(result.error || 'Invalid password');
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
          mb: 3,
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        Pub Fight
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          width: '100%',
          maxWidth: 300,
        }}
      >
        <TextField
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          autoFocus
          disabled={loading}
          fullWidth
          slotProps={{
            input: {
              sx: { textAlign: 'center', fontSize: '1.2rem' },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          size="large"
          disabled={loading}
          sx={{ fontSize: '1.2rem', fontWeight: 'bold', py: 1.25 }}
        >
          {loading ? 'Joining...' : 'Enter'}
        </Button>
        {error && (
          <Typography color="secondary.main" sx={{ textAlign: 'center', mt: 0.5 }}>
            {error}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
