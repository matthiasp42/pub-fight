import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { LuSettings, LuLogOut } from 'react-icons/lu';
import theme from './theme';
import { LoginScreen } from './screens/LoginScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { MapScreen } from './screens/MapScreen';
import { FightScreen } from './screens/FightScreen';
import { LevelUpScreen } from './screens/LevelUpScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import { useGameState } from './hooks/useGameState';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState(() => localStorage.getItem('myPlayerId'));
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const { gameState, syncStatus, startPolling, stopPolling, fetchState } = useGameState();

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      setLoggedIn(true);
      startPolling();
    }
  }, [startPolling]);

  const handleLogin = useCallback(() => {
    setLoggedIn(true);
    startPolling();
  }, [startPolling]);

  const handleSelectPlayer = useCallback((playerId) => {
    setMyPlayerId(playerId);
    localStorage.setItem('myPlayerId', playerId);
  }, []);

  const handleReleasePlayer = useCallback(() => {
    setMyPlayerId(null);
    localStorage.removeItem('myPlayerId');
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('myPlayerId');
    localStorage.removeItem('pubfight_gameState');
    setLoggedIn(false);
    setMyPlayerId(null);
    stopPolling();
  }, [stopPolling]);

  function renderContent() {
    // Not logged in
    if (!loggedIn) {
      return <LoginScreen onLogin={handleLogin} />;
    }

    // Loading state
    if (!gameState) {
      return (
        <div style={styles.container}>
          <p style={styles.loadingText}>Connecting to server...</p>
        </div>
      );
    }

    const sessionId = localStorage.getItem('sessionId');
    const myPlayer = myPlayerId ? gameState.players?.[myPlayerId] : null;
    const myPlayerIsValid = myPlayer && myPlayer.controlledBy === sessionId;

    // No controlled player or in lobby phase - show lobby
    if (!myPlayerIsValid || gameState.phase === 'lobby') {
      return (
        <LobbyScreen
          gameState={gameState}
          myPlayerId={myPlayerIsValid ? myPlayerId : null}
          onSelectPlayer={handleSelectPlayer}
          onReleasePlayer={handleReleasePlayer}
          onLogout={handleLogout}
          fetchState={fetchState}
        />
      );
    }

    // Phase-driven routing
    switch (gameState.phase) {
      case 'map':
        return (
          <MapScreen
            gameState={gameState}
            myPlayer={myPlayer}
            fetchState={fetchState}
          />
        );

      case 'fight':
        return (
          <FightScreen
            gameState={gameState}
            myPlayer={myPlayer}
            fetchState={fetchState}
          />
        );

      case 'levelup':
        return (
          <LevelUpScreen
            gameState={gameState}
            myPlayer={myPlayer}
            fetchState={fetchState}
          />
        );

      case 'victory':
        return (
          <VictoryScreen
            gameState={gameState}
            myPlayer={myPlayer}
            fetchState={fetchState}
          />
        );

      default:
        return (
          <LobbyScreen
            gameState={gameState}
            myPlayerId={myPlayerIsValid ? myPlayerId : null}
            onSelectPlayer={handleSelectPlayer}
            onReleasePlayer={handleReleasePlayer}
            onLogout={handleLogout}
            fetchState={fetchState}
          />
        );
    }
  }

  const handleResetSession = useCallback(() => {
    setSettingsAnchor(null);
    handleLogout();
  }, [handleLogout]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {renderContent()}
      {loggedIn && (
        <>
          <IconButton
            onClick={(e) => setSettingsAnchor(e.currentTarget)}
            sx={{
              position: 'fixed',
              top: 8,
              right: 8,
              zIndex: 1300,
              color: 'rgba(168, 160, 149, 0.4)',
              '&:hover': { color: 'text.secondary' },
            }}
            size="small"
          >
            <LuSettings size={18} />
          </IconButton>
          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={() => setSettingsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={handleResetSession}>
              <ListItemIcon sx={{ color: 'secondary.main' }}>
                <LuLogOut size={16} />
              </ListItemIcon>
              <ListItemText>Reset Session</ListItemText>
            </MenuItem>
          </Menu>
        </>
      )}
    </ThemeProvider>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '20px',
  },
  loadingText: {
    color: '#888',
    fontSize: '1.2rem',
  },
};

export default App;
