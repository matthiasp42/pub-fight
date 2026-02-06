import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ALL_SKILLS, getSkillsByClass, getSkillById } from './skills/index.js';
import { CharacterClass, GamePhase, GameState, PlayerCharacter, CharacterAttributes } from './types/game.js';
import { CLASS_BASE_ATTRIBUTES } from './classes/index.js';
import { DUNGEON_DEFINITIONS } from './dungeons/index.js';
import { BOSS_DEFINITIONS } from './bosses/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.GAME_PASSWORD || 'pubfight';

interface SessionRequest extends Request {
  sessionId?: string;
}

// In-memory game state
let gameState: GameState = {
  version: 1,
  phase: 'lobby',
  clearedDungeons: [],
  activeDungeonId: null,
  fightState: null,
  fightVersion: 0,
  players: {},
};

// Mutable dungeon definitions (can be updated via admin)
let dungeons = DUNGEON_DEFINITIONS.map(d => ({ ...d }));

// Session tracking
const sessions = new Set<string>();

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve static React build
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

// Get current game state + dungeon definitions
app.get('/api/state', requireSession, (req: Request, res: Response) => {
  res.json({ ...gameState, dungeons });
});

// Get all skills
app.get('/api/skills', (req: Request, res: Response) => {
  res.json(ALL_SKILLS);
});

// Get skills for a specific class
app.get('/api/skills/:class', (req: Request, res: Response) => {
  const characterClass = req.params.class as CharacterClass;
  const validClasses: CharacterClass[] = ['tank', 'wizard', 'alchemist', 'warrior'];

  if (!validClasses.includes(characterClass)) {
    return res.status(400).json({ error: 'Invalid class. Must be: tank, wizard, alchemist, or warrior' });
  }

  const skills = getSkillsByClass(characterClass);
  res.json(skills);
});

// Get boss definitions
app.get('/api/bosses', (req: Request, res: Response) => {
  res.json(BOSS_DEFINITIONS);
});

// Join game - create new player or take over existing
app.post('/api/join', requireSession, (req: SessionRequest, res: Response) => {
  const { playerId, name, characterClass } = req.body;
  const sessionId = req.sessionId!;

  if (playerId) {
    // Take control of existing player - always allow (no 409, enables device swap)
    const player = gameState.players[playerId];
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    player.controlledBy = sessionId;
    gameState.version++;
    res.json({ success: true, player });
  } else if (name) {
    // Create new player
    const validClasses: CharacterClass[] = ['tank', 'wizard', 'alchemist', 'warrior'];
    const playerClass = validClasses.includes(characterClass) ? characterClass : 'warrior';
    const baseAttrs = CLASS_BASE_ATTRIBUTES[playerClass as CharacterClass];

    const newId = uuidv4().slice(0, 8);
    const player: PlayerCharacter = {
      id: newId,
      name: name.trim().slice(0, 20),
      class: playerClass,
      level: 1,
      attributePoints: 0,
      perkPoints: 1, // Start with 1 perk point at level 1
      ownedSkillIds: [],
      attributes: { ...baseAttrs },
      baseAttributes: { ...baseAttrs },
      controlledBy: sessionId,
    };
    gameState.players[newId] = player;
    gameState.version++;
    res.json({ success: true, player });
  } else {
    res.status(400).json({ error: 'Provide playerId or name' });
  }
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

// Start game: lobby -> map
app.post('/api/start-game', requireSession, (req: SessionRequest, res: Response) => {
  if (gameState.phase !== 'lobby') {
    return res.status(400).json({ error: 'Game not in lobby phase' });
  }

  const players = Object.values(gameState.players);
  if (players.length === 0) {
    return res.status(400).json({ error: 'No players in game' });
  }

  gameState.phase = 'map';
  gameState.version++;
  res.json({ success: true });
});

// Enter dungeon: map -> fight
app.post('/api/enter-dungeon', requireSession, (req: SessionRequest, res: Response) => {
  const { dungeonId } = req.body;

  if (gameState.phase !== 'map') {
    return res.status(400).json({ error: 'Not in map phase' });
  }

  const dungeon = dungeons.find(d => d.id === dungeonId);
  if (!dungeon) {
    return res.status(404).json({ error: 'Dungeon not found' });
  }

  if (gameState.clearedDungeons.includes(dungeonId)) {
    return res.status(400).json({ error: 'Dungeon already cleared' });
  }

  gameState.phase = 'fight';
  gameState.activeDungeonId = dungeonId;
  gameState.fightState = null;
  gameState.fightVersion = 0;
  gameState.version++;
  res.json({ success: true });
});

// Update fight state (version-gated)
app.post('/api/fight-state', requireSession, (req: SessionRequest, res: Response) => {
  const { fightState, expectedVersion } = req.body;

  if (gameState.phase !== 'fight') {
    return res.status(400).json({ error: 'Not in fight phase' });
  }

  if (expectedVersion !== undefined && expectedVersion !== gameState.fightVersion) {
    return res.status(409).json({ error: 'Version mismatch', currentVersion: gameState.fightVersion });
  }

  gameState.fightState = fightState;
  gameState.fightVersion++;
  gameState.version++;
  res.json({ success: true, fightVersion: gameState.fightVersion });
});

// Dungeon cleared: fight -> levelup
app.post('/api/dungeon-cleared', requireSession, (req: SessionRequest, res: Response) => {
  const { dungeonId } = req.body;

  if (gameState.phase !== 'fight') {
    return res.status(400).json({ error: 'Not in fight phase' });
  }

  if (gameState.activeDungeonId !== dungeonId) {
    return res.status(400).json({ error: 'Wrong dungeon' });
  }

  if (gameState.clearedDungeons.includes(dungeonId)) {
    return res.status(400).json({ error: 'Already cleared' });
  }

  gameState.clearedDungeons.push(dungeonId);

  // Level up all players
  for (const player of Object.values(gameState.players)) {
    player.level = gameState.clearedDungeons.length + 1;
    player.attributePoints += 2;
    player.perkPoints += 1;
  }

  gameState.phase = 'levelup';
  gameState.activeDungeonId = null;
  gameState.fightState = null;
  gameState.fightVersion = 0;
  gameState.version++;
  res.json({ success: true });
});

// Distribute attribute points
app.post('/api/distribute-attributes', requireSession, (req: SessionRequest, res: Response) => {
  const { playerId, deltas } = req.body;

  if (gameState.phase !== 'levelup') {
    return res.status(400).json({ error: 'Not in levelup phase' });
  }

  const player = gameState.players[playerId];
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  // Validate deltas sum to player's available points
  const validAttrs: (keyof CharacterAttributes)[] = [
    'maxHealth', 'maxAP', 'power', 'shieldCapacity', 'shieldStrength', 'dexterity', 'evasiveness'
  ];

  let totalSpent = 0;
  for (const [attr, delta] of Object.entries(deltas)) {
    if (!validAttrs.includes(attr as keyof CharacterAttributes)) {
      return res.status(400).json({ error: `Invalid attribute: ${attr}` });
    }
    if (typeof delta !== 'number' || delta < 0) {
      return res.status(400).json({ error: `Invalid delta for ${attr}` });
    }
    totalSpent += delta;
  }

  if (totalSpent > player.attributePoints) {
    return res.status(400).json({ error: 'Not enough attribute points' });
  }

  // Apply deltas
  for (const [attr, delta] of Object.entries(deltas)) {
    (player.attributes as any)[attr] += delta;
  }
  player.attributePoints -= totalSpent;

  gameState.version++;
  res.json({ success: true, player });
});

// Unlock skill
app.post('/api/unlock-skill', requireSession, (req: SessionRequest, res: Response) => {
  const { playerId, skillId } = req.body;

  if (gameState.phase !== 'levelup' && gameState.phase !== 'lobby') {
    return res.status(400).json({ error: 'Cannot unlock skills in current phase' });
  }

  const player = gameState.players[playerId];
  if (!player) {
    return res.status(404).json({ error: 'Player not found' });
  }

  if (player.perkPoints < 1) {
    return res.status(400).json({ error: 'No perk points available' });
  }

  const skill = getSkillById(skillId);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found' });
  }

  if (skill.class !== player.class) {
    return res.status(400).json({ error: 'Wrong class for this skill' });
  }

  if (skill.levelRequired > player.level) {
    return res.status(400).json({ error: 'Level too low' });
  }

  if (player.ownedSkillIds.includes(skillId)) {
    return res.status(400).json({ error: 'Skill already owned' });
  }

  if (skill.requires && !player.ownedSkillIds.includes(skill.requires)) {
    return res.status(400).json({ error: 'Missing prerequisite skill' });
  }

  player.ownedSkillIds.push(skillId);
  player.perkPoints -= 1;

  gameState.version++;
  res.json({ success: true, player });
});

// Finish level up: levelup -> map or victory
app.post('/api/finish-levelup', requireSession, (req: SessionRequest, res: Response) => {
  if (gameState.phase !== 'levelup') {
    return res.status(400).json({ error: 'Not in levelup phase' });
  }

  // Check all players have spent all points
  for (const player of Object.values(gameState.players)) {
    if (player.attributePoints > 0 || player.perkPoints > 0) {
      return res.status(400).json({
        error: 'Not all players have spent their points',
        unfinished: Object.values(gameState.players)
          .filter(p => p.attributePoints > 0 || p.perkPoints > 0)
          .map(p => ({ id: p.id, name: p.name, attributePoints: p.attributePoints, perkPoints: p.perkPoints })),
      });
    }
  }

  if (gameState.clearedDungeons.length >= 7) {
    gameState.phase = 'victory';
  } else {
    gameState.phase = 'map';
  }

  gameState.version++;
  res.json({ success: true, phase: gameState.phase });
});

// Restore state from client (after server restart)
app.post('/api/restore', requireSession, (req: SessionRequest, res: Response) => {
  const { version, phase, clearedDungeons, activeDungeonId, fightState, fightVersion, players } = req.body;

  if (version > gameState.version) {
    gameState = { version, phase, clearedDungeons, activeDungeonId, fightState, fightVersion, players };
    sessions.add(req.sessionId!);
    res.json({ success: true, restored: true });
  } else {
    res.json({ success: true, restored: false });
  }
});

// ---- Admin Endpoints ----

// Set cleared dungeons (nuclear escape hatch)
app.post('/api/admin/set-cleared', requireSession, (req: SessionRequest, res: Response) => {
  const { clearedDungeonIds } = req.body;

  if (!Array.isArray(clearedDungeonIds)) {
    return res.status(400).json({ error: 'clearedDungeonIds must be an array' });
  }

  // Validate dungeon IDs
  const validIds = dungeons.map(d => d.id);
  for (const id of clearedDungeonIds) {
    if (!validIds.includes(id)) {
      return res.status(400).json({ error: `Invalid dungeon ID: ${id}` });
    }
  }

  gameState.clearedDungeons = clearedDungeonIds;

  // Recalculate all player levels and points
  for (const player of Object.values(gameState.players)) {
    player.level = gameState.clearedDungeons.length + 1;

    const totalAttrEarned = (player.level - 1) * 2;
    const totalPerksEarned = player.level; // 1 at start + 1 per level-up

    // Calculate already spent
    const attrSpent = Object.keys(player.attributes).reduce((sum, key) => {
      const k = key as keyof CharacterAttributes;
      return sum + Math.max(0, player.attributes[k] - player.baseAttributes[k]);
    }, 0);
    const perksSpent = player.ownedSkillIds.length;

    player.attributePoints = Math.max(0, totalAttrEarned - attrSpent);
    player.perkPoints = Math.max(0, totalPerksEarned - perksSpent);
  }

  // Determine phase
  const anyUnspent = Object.values(gameState.players).some(
    p => p.attributePoints > 0 || p.perkPoints > 0
  );

  if (anyUnspent) {
    gameState.phase = 'levelup';
  } else if (gameState.clearedDungeons.length >= 7) {
    gameState.phase = 'victory';
  } else {
    gameState.phase = 'map';
  }

  gameState.activeDungeonId = null;
  gameState.fightState = null;
  gameState.fightVersion = 0;
  gameState.version++;
  res.json({ success: true, gameState });
});

// Reset game
app.post('/api/admin/reset-game', requireSession, (req: SessionRequest, res: Response) => {
  gameState = {
    version: gameState.version + 1,
    phase: 'lobby',
    clearedDungeons: [],
    activeDungeonId: null,
    fightState: null,
    fightVersion: 0,
    players: {},
  };
  res.json({ success: true });
});

// Set dungeon coordinates
app.post('/api/admin/set-dungeon-coords', requireSession, (req: SessionRequest, res: Response) => {
  const { dungeonUpdates } = req.body;

  if (!Array.isArray(dungeonUpdates)) {
    return res.status(400).json({ error: 'dungeonUpdates must be an array' });
  }

  for (const update of dungeonUpdates) {
    const dungeon = dungeons.find(d => d.id === update.id);
    if (dungeon) {
      if (update.lat !== undefined) dungeon.lat = update.lat;
      if (update.lng !== undefined) dungeon.lng = update.lng;
      if (update.radiusMeters !== undefined) dungeon.radiusMeters = update.radiusMeters;
      if (update.name !== undefined) dungeon.name = update.name;
    }
  }

  gameState.version++;
  res.json({ success: true, dungeons });
});

// Force phase override
app.post('/api/admin/set-phase', requireSession, (req: SessionRequest, res: Response) => {
  const { phase } = req.body;
  const validPhases: GamePhase[] = ['lobby', 'map', 'fight', 'levelup', 'victory'];

  if (!validPhases.includes(phase)) {
    return res.status(400).json({ error: 'Invalid phase' });
  }

  gameState.phase = phase;
  gameState.version++;
  res.json({ success: true });
});

// Fallback to index.html for client-side routing
app.get('*', (req: Request, res: Response) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Pub Fight server running on port ${PORT}`);
});
