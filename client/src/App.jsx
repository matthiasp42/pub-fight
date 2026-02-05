import { useState, useEffect } from 'react';
import { LoginScreen } from './screens/LoginScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { GameScreen } from './screens/GameScreen';
import { FightScreen } from './screens/FightScreen';

function App() {
  const [screen, setScreen] = useState('login');
  const [myPlayerId, setMyPlayerId] = useState(null);

  useEffect(() => {
    // Check URL for fight mode
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'fight') {
      setScreen('fight');
      return;
    }

    // Check if already logged in
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      setScreen('lobby');
    }
  }, []);

  const handleLogin = () => {
    setScreen('lobby');
  };

  const handleEnterGame = (playerId) => {
    setMyPlayerId(playerId);
    setScreen('game');
  };

  const handleBackToLobby = () => {
    setScreen('lobby');
  };

  switch (screen) {
    case 'login':
      return <LoginScreen onLogin={handleLogin} />;
    case 'lobby':
      return <LobbyScreen onEnterGame={handleEnterGame} />;
    case 'game':
      return <GameScreen myPlayerId={myPlayerId} onBack={handleBackToLobby} />;
    case 'fight':
      return <FightScreen />;
    default:
      return <LoginScreen onLogin={handleLogin} />;
  }
}

export default App;
