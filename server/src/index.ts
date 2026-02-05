import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ALL_SKILLS, getSkillsByClass } from './skills/index.js';
import { CharacterClass } from './types/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.GAME_PASSWORD || 'pubfight';

interface Player {
  id: string;
  name: string;
  score: number;
  controlledBy: string | null;
}

interface GameState {
  version: number;
  players: Record<string, Player>;
}

interface SessionRequest extends Request {
  sessionId?: string;
}

// In-memory game state
let gameState: GameState = {
  version: 1,
  players: {},
};

// Session tracking
const sessions = new Set<string>();

app.use(cors());
app.use(express.json());

// Serve static React build (go up from dist to server, then to public)
app.use(express.static(join(__dirname, '..', 'public')));

// Auth endpoint
app.post('/api/auth', (req: Request, res: Response) => {
  const { password } = req.body;

  if (password === PASSWORD) {
    const sessionId = uuidv4();
    sessions.add(sessionId);
    res.json({ success: true, sessionId });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// Middleware to check session
const requireSession = (req: SessionRequest, res: Response, next: NextFunction) => {
  const sessionId = (req.headers['x-session-id'] as string) || req.body.sessionId;
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  req.sessionId = sessionId;
  next();
};

// Get current game state
app.get('/api/state', requireSession, (req: Request, res: Response) => {
  res.json(gameState);
});

// Get all skills (public - no auth required, these are just static definitions)
app.get('/api/skills', (req: Request, res: Response) => {
  res.json(ALL_SKILLS);
});

// Get skills for a specific class (public)
app.get('/api/skills/:class', (req: Request, res: Response) => {
  const characterClass = req.params.class as CharacterClass;
  const validClasses: CharacterClass[] = ['tank', 'wizard', 'alchemist', 'warrior'];

  if (!validClasses.includes(characterClass)) {
    return res.status(400).json({ error: 'Invalid class. Must be: tank, wizard, alchemist, or warrior' });
  }

  const skills = getSkillsByClass(characterClass);
  res.json(skills);
});

// Join game - take control of existing player or create new
app.post('/api/join', requireSession, (req: SessionRequest, res: Response) => {
  const { playerId, name } = req.body;
  const sessionId = req.sessionId!;

  if (playerId) {
    // Take control of existing player
    const player = gameState.players[playerId];
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    if (player.controlledBy && player.controlledBy !== sessionId) {
      return res.status(409).json({ error: 'Player already controlled' });
    }
    player.controlledBy = sessionId;
    gameState.version++;
    res.json({ success: true, player });
  } else if (name) {
    // Create new player
    const newId = uuidv4().slice(0, 8);
    const player: Player = {
      id: newId,
      name: name.trim().slice(0, 20),
      score: 0,
      controlledBy: sessionId,
    };
    gameState.players[newId] = player;
    gameState.version++;
    res.json({ success: true, player });
  } else {
    res.status(400).json({ error: 'Provide playerId or name' });
  }
});

// Perform action (change score)
app.post('/api/action', requireSession, (req: SessionRequest, res: Response) => {
  const { playerId, delta } = req.body;
  const sessionId = req.sessionId!;

  const player = gameState.players[playerId];
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }
  if (player.controlledBy !== sessionId) {
    return res.status(403).json({ error: 'Not your player' });
  }

  player.score += delta;
  gameState.version++;
  res.json({ success: true, player, version: gameState.version });
});

// Release control of a player
app.post('/api/release', requireSession, (req: SessionRequest, res: Response) => {
  const { playerId } = req.body;
  const sessionId = req.sessionId!;

  const player = gameState.players[playerId];
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }
  if (player.controlledBy !== sessionId) {
    return res.status(403).json({ error: 'Not your player' });
  }

  player.controlledBy = null;
  gameState.version++;
  res.json({ success: true });
});

// Restore state from client (after server restart)
app.post('/api/restore', requireSession, (req: SessionRequest, res: Response) => {
  const { version, players } = req.body;

  if (version > gameState.version) {
    gameState = { version, players };
    // Re-add current session
    sessions.add(req.sessionId!);
    res.json({ success: true, restored: true });
  } else {
    res.json({ success: true, restored: false });
  }
});

// Fallback to index.html for client-side routing
app.get('*', (req: Request, res: Response) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pub Fight server running on port ${PORT}`);
});
