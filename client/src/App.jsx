import { useState, useEffect, useCallback } from 'react';
import { ThemeProvider, CssBaseline, IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import { LuSettings, LuLogOut, LuShield, LuUsers } from 'react-icons/lu';
import theme from './theme';
import { LoginScreen } from './screens/LoginScreen';
import { GameSelectScreen } from './screens/GameSelectScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { MapScreen } from './screens/MapScreen';
import { FightScreen } from './screens/FightScreen';
import { LevelUpScreen } from './screens/LevelUpScreen';
import { VictoryScreen } from './screens/VictoryScreen';
import { useGameState } from './hooks/useGameState';
import { api } from './api/client';
import { AdminModal } from './components/AdminModal';
import { PartyDialog } from './components/PartyDialog';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [gameId, setGameId] = useState(() => localStorage.getItem('gameId'));
  const [myPlayerId, setMyPlayerId] = useState(() => localStorage.getItem('myPlayerId'));
  const [settingsAnchor, setSettingsAnchor] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showParty, setShowParty] = useState(false);
  const { gameState, syncStatus, startPolling, stopPolling, fetchState, resetState } = useGameState();

  useEffect(() => {
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      setLoggedIn(true);
      if (gameId) {
        startPolling();
      }
    }
  }, [startPolling, gameId]);

  // React to game_not_found from polling
  useEffect(() => {
    if (syncStatus === 'game_not_found') {
      handleLeaveGame();
    }
  }, [syncStatus]);

  const handleLogin = useCallback(() => {
    setLoggedIn(true);
    if (localStorage.getItem('gameId')) {
      startPolling();
    }
  }, [startPolling]);

  const handleSelectGame = useCallback((code) => {
    localStorage.setItem('gameId', code);
    setGameId(code);
    startPolling();
  }, [startPolling]);

  const handleLeaveGame = useCallback(() => {
    // Try to release the player first
    const playerId = localStorage.getItem('myPlayerId');
    if (playerId) {
      api.release(playerId).catch(() => {});
    }
    localStorage.removeItem('gameId');
    localStorage.removeItem('myPlayerId');
    localStorage.removeItem('pubfight_gameState');
    setGameId(null);
    setMyPlayerId(null);
    stopPolling();
    resetState();
  }, [stopPolling, resetState]);

  const handleSelectPlayer = useCallback((playerId) => {
    setMyPlayerId(playerId);
    localStorage.setItem('myPlayerId', playerId);
  }, []);

  const handleReleasePlayer = useCallback(() => {
    setMyPlayerId(null);
    localStorage.removeItem('myPlayerId');
  }, []);

  const handleLogout = useCallback(() => {
    const playerId = localStorage.getItem('myPlayerId');
    if (playerId) {
      api.release(playerId).catch(() => {});
    }
    localStorage.removeItem('sessionId');
    localStorage.removeItem('gameId');
    localStorage.removeItem('myPlayerId');
    localStorage.removeItem('pubfight_gameState');
    setLoggedIn(false);
    setGameId(null);
    setMyPlayerId(null);
    stopPolling();
    resetState();
  }, [stopPolling, resetState]);

  function renderContent() {
    if (!loggedIn) {
      return <LoginScreen onLogin={handleLogin} />;
    }

    if (!gameId) {
      return <GameSelectScreen onSelectGame={handleSelectGame} />;
    }

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

    if (!myPlayerIsValid || gameState.phase === 'lobby') {
      return (
        <LobbyScreen
          gameState={gameState}
          myPlayerId={myPlayerIsValid ? myPlayerId : null}
          onSelectPlayer={handleSelectPlayer}
          onReleasePlayer={handleReleasePlayer}
          onLeaveGame={handleLeaveGame}
          fetchState={fetchState}
        />
      );
    }

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
            showAdmin={showAdmin}
            onCloseAdmin={() => setShowAdmin(false)}
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
            onLeaveGame={handleLeaveGame}
            fetchState={fetchState}
          />
        );
    }
  }

  const handleMenuLogout = useCallback(() => {
    setSettingsAnchor(null);
    handleLogout();
  }, [handleLogout]);

  const handleMenuAdmin = useCallback(() => {
    setSettingsAnchor(null);
    setShowAdmin(true);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {renderContent()}
      {showAdmin && gameState?.phase !== 'fight' && (
        <AdminModal
          gameState={gameState}
          dungeons={gameState?.dungeons || []}
          onClose={() => setShowAdmin(false)}
          fetchState={fetchState}
        />
      )}
      {loggedIn && (
        <>
          <div style={{ position: 'fixed', top: 8, right: 8, zIndex: 1300, display: 'flex', gap: 4, alignItems: 'center' }}>
            {gameId && gameState && Object.keys(gameState.players || {}).length > 0 && (
              <IconButton
                onClick={() => setShowParty(true)}
                sx={{
                  color: 'rgba(168, 160, 149, 0.4)',
                  '&:hover': { color: 'text.secondary' },
                }}
                size="small"
              >
                <LuUsers size={18} />
              </IconButton>
            )}
            <IconButton
              onClick={(e) => setSettingsAnchor(e.currentTarget)}
              sx={{
                color: 'rgba(168, 160, 149, 0.4)',
                '&:hover': { color: 'text.secondary' },
              }}
              size="small"
            >
              <LuSettings size={18} />
            </IconButton>
          </div>
          <Menu
            anchorEl={settingsAnchor}
            open={Boolean(settingsAnchor)}
            onClose={() => setSettingsAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            {gameId && (
              <MenuItem disabled sx={{ opacity: '0.7 !important' }}>
                <ListItemText>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.1em' }}>
                    Game: {gameId}
                  </Typography>
                </ListItemText>
              </MenuItem>
            )}
            {gameId && <Divider />}
            {gameId && gameState && (
              <MenuItem onClick={handleMenuAdmin}>
                <ListItemIcon sx={{ color: 'text.secondary' }}>
                  <LuShield size={16} />
                </ListItemIcon>
                <ListItemText>Admin</ListItemText>
              </MenuItem>
            )}
            {gameId && <Divider />}
            <MenuItem onClick={handleMenuLogout}>
              <ListItemIcon sx={{ color: 'secondary.main' }}>
                <LuLogOut size={16} />
              </ListItemIcon>
              <ListItemText>Logout</ListItemText>
            </MenuItem>
          </Menu>
        </>
      )}
      <PartyDialog
        open={showParty}
        onClose={() => setShowParty(false)}
        players={gameState?.players ? Object.values(gameState.players) : []}
        myPlayerId={myPlayerId}
      />
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
