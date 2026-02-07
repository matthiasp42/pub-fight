import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ALL_SKILLS, getSkillsByClass, getSkillById } from './skills/index.js';
import { CLASS_BASE_ATTRIBUTES } from './classes/index.js';
import { DUNGEON_DEFINITIONS } from './dungeons/index.js';
import { BOSS_DEFINITIONS } from './bosses/index.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;
const PASSWORD = process.env.GAME_PASSWORD || 'pubfight';
// Multi-game storage
const games = new Map();
// Session tracking (global, not per-game)
const sessions = new Set();
// Game code generation: 4-char uppercase alphanumeric, excluding I/O/0/1
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateGameCode() {
    let code;
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
    } while (games.has(code));
    return code;
}
function createGameInstance(code) {
    return {
        gameCode: code,
        gameState: {
            version: 1,
            phase: 'lobby',
            clearedDungeons: [],
            activeDungeonId: null,
            fightState: null,
            fightVersion: 0,
            players: {},
        },
        dungeons: DUNGEON_DEFINITIONS.map(d => ({ ...d })),
        createdAt: Date.now(),
        lastActivity: Date.now(),
    };
}
function touchGame(game) {
    game.lastActivity = Date.now();
}
app.use(cors());
app.use(express.json({ limit: '5mb' }));
// Serve static React build
app.use(express.static(join(__dirname, '..', 'public')));
// Auth endpoint
app.post('/api/auth', (req, res) => {
    const { password } = req.body;
    if (password === PASSWORD) {
        const sessionId = uuidv4();
        sessions.add(sessionId);
        res.json({ success: true, sessionId });
    }
    else {
        res.status(401).json({ success: false, error: 'Invalid password' });
    }
});
// Middleware to check session
const requireSession = (req, res, next) => {
    const sessionId = req.headers['x-session-id'] || req.body.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    req.sessionId = sessionId;
    next();
};
// Middleware to resolve game from X-Game-Id header
const requireGame = (req, res, next) => {
    const gameId = req.headers['x-game-id'];
    if (!gameId) {
        return res.status(400).json({ error: 'Missing X-Game-Id header', code: 'GAME_NOT_FOUND' });
    }
    const game = games.get(gameId.toUpperCase());
    if (!game) {
        return res.status(404).json({ error: 'Game not found', code: 'GAME_NOT_FOUND' });
    }
    req.game = game;
    touchGame(game);
    next();
};
// ---- Game management endpoints ----
// Create a new game
app.post('/api/games', requireSession, (req, res) => {
    const code = generateGameCode();
    const game = createGameInstance(code);
    games.set(code, game);
    res.json({ gameCode: code });
});
// Check if a game exists (for join validation)
app.get('/api/games/:code', requireSession, (req, res) => {
    const code = req.params.code.toUpperCase();
    const game = games.get(code);
    if (!game) {
        return res.json({ exists: false });
    }
    res.json({
        exists: true,
        phase: game.gameState.phase,
        playerCount: Object.keys(game.gameState.players).length,
    });
});
// ---- Game-specific endpoints (all require X-Game-Id) ----
// Get current game state + dungeon definitions
app.get('/api/state', requireSession, requireGame, (req, res) => {
    const { gameState, dungeons, gameCode } = req.game;
    res.json({ ...gameState, dungeons, gameCode });
});
// Get all skills (no game needed)
app.get('/api/skills', (req, res) => {
    res.json(ALL_SKILLS);
});
// Get skills for a specific class (no game needed)
app.get('/api/skills/:class', (req, res) => {
    const characterClass = req.params.class;
    const validClasses = ['tank', 'wizard', 'alchemist', 'warrior'];
    if (!validClasses.includes(characterClass)) {
        return res.status(400).json({ error: 'Invalid class. Must be: tank, wizard, alchemist, or warrior' });
    }
    const skills = getSkillsByClass(characterClass);
    res.json(skills);
});
// Get boss definitions (no game needed)
app.get('/api/bosses', (req, res) => {
    res.json(BOSS_DEFINITIONS);
});
// Join game - create new player or take over existing
app.post('/api/join', requireSession, requireGame, (req, res) => {
    const { playerId, name, characterClass } = req.body;
    const sessionId = req.sessionId;
    const { gameState } = req.game;
    if (playerId) {
        const player = gameState.players[playerId];
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        player.controlledBy = sessionId;
        gameState.version++;
        res.json({ success: true, player });
    }
    else if (name) {
        const validClasses = ['tank', 'wizard', 'alchemist', 'warrior'];
        const playerClass = validClasses.includes(characterClass) ? characterClass : 'warrior';
        const baseAttrs = CLASS_BASE_ATTRIBUTES[playerClass];
        const newId = uuidv4().slice(0, 8);
        const player = {
            id: newId,
            name: name.trim().slice(0, 20),
            class: playerClass,
            level: 1,
            attributePoints: 0,
            perkPoints: 1,
            ownedSkillIds: [],
            attributes: { ...baseAttrs },
            baseAttributes: { ...baseAttrs },
            controlledBy: sessionId,
        };
        gameState.players[newId] = player;
        gameState.version++;
        res.json({ success: true, player });
    }
    else {
        res.status(400).json({ error: 'Provide playerId or name' });
    }
});
// Release control of a player
app.post('/api/release', requireSession, requireGame, (req, res) => {
    const { playerId } = req.body;
    const sessionId = req.sessionId;
    const { gameState } = req.game;
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
app.post('/api/start-game', requireSession, requireGame, (req, res) => {
    const { gameState } = req.game;
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
app.post('/api/enter-dungeon', requireSession, requireGame, (req, res) => {
    const { dungeonId } = req.body;
    const { gameState, dungeons } = req.game;
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
app.post('/api/fight-state', requireSession, requireGame, (req, res) => {
    const { fightState, expectedVersion } = req.body;
    const { gameState } = req.game;
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
app.post('/api/dungeon-cleared', requireSession, requireGame, (req, res) => {
    const { dungeonId } = req.body;
    const { gameState } = req.game;
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
    // Snapshot before awarding points (so undo restores pre-distribution state)
    const snapshots = {};
    for (const [id, player] of Object.entries(gameState.players)) {
        snapshots[id] = {
            attributes: { ...player.attributes },
            ownedSkillIds: [...player.ownedSkillIds],
            attributePoints: player.attributePoints,
            perkPoints: player.perkPoints,
        };
    }
    for (const player of Object.values(gameState.players)) {
        player.level = gameState.clearedDungeons.length + 1;
        player.attributePoints += 2;
        player.perkPoints += 1;
    }
    // Save snapshots with the freshly awarded points
    for (const [id, snap] of Object.entries(snapshots)) {
        snap.attributePoints = gameState.players[id].attributePoints;
        snap.perkPoints = gameState.players[id].perkPoints;
    }
    gameState.levelupSnapshots = snapshots;
    gameState.phase = 'levelup';
    gameState.activeDungeonId = null;
    gameState.fightState = null;
    gameState.fightVersion = 0;
    gameState.version++;
    res.json({ success: true });
});
// Distribute attribute points
app.post('/api/distribute-attributes', requireSession, requireGame, (req, res) => {
    const { playerId, deltas } = req.body;
    const { gameState } = req.game;
    if (gameState.phase !== 'levelup') {
        return res.status(400).json({ error: 'Not in levelup phase' });
    }
    const player = gameState.players[playerId];
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    const validAttrs = [
        'maxHealth', 'maxAP', 'power', 'shieldCapacity', 'shieldStrength', 'dexterity', 'evasiveness'
    ];
    let totalSpent = 0;
    for (const [attr, delta] of Object.entries(deltas)) {
        if (!validAttrs.includes(attr)) {
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
    for (const [attr, delta] of Object.entries(deltas)) {
        player.attributes[attr] += delta;
    }
    player.attributePoints -= totalSpent;
    gameState.version++;
    res.json({ success: true, player });
});
// Unlock skill
app.post('/api/unlock-skill', requireSession, requireGame, (req, res) => {
    const { playerId, skillId } = req.body;
    const { gameState } = req.game;
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
// Undo levelup choices: restore player to snapshot state
app.post('/api/undo-levelup', requireSession, requireGame, (req, res) => {
    const { playerId } = req.body;
    const { gameState } = req.game;
    if (gameState.phase !== 'levelup') {
        return res.status(400).json({ error: 'Not in levelup phase' });
    }
    const player = gameState.players[playerId];
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    const snapshot = gameState.levelupSnapshots?.[playerId];
    if (!snapshot) {
        return res.status(400).json({ error: 'No snapshot available' });
    }
    player.attributes = { ...snapshot.attributes };
    player.ownedSkillIds = [...snapshot.ownedSkillIds];
    player.attributePoints = snapshot.attributePoints;
    player.perkPoints = snapshot.perkPoints;
    gameState.version++;
    res.json({ success: true, player });
});
// Finish level up: levelup -> map or victory
app.post('/api/finish-levelup', requireSession, requireGame, (req, res) => {
    const { gameState } = req.game;
    if (gameState.phase !== 'levelup') {
        return res.status(400).json({ error: 'Not in levelup phase' });
    }
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
    }
    else {
        gameState.phase = 'map';
    }
    gameState.version++;
    res.json({ success: true, phase: gameState.phase });
});
// Restore state from client (after server restart)
// Special: does its own game lookup, creates game if missing
app.post('/api/restore', requireSession, (req, res) => {
    const gameId = (req.headers['x-game-id'] || '').toUpperCase();
    if (!gameId) {
        return res.status(400).json({ error: 'Missing X-Game-Id header' });
    }
    const { version, phase, clearedDungeons, activeDungeonId, fightState, fightVersion, players } = req.body;
    let game = games.get(gameId);
    if (!game) {
        // Game doesn't exist on server (server restarted) — recreate it
        game = createGameInstance(gameId);
        games.set(gameId, game);
    }
    if (version > game.gameState.version) {
        game.gameState = { version, phase, clearedDungeons, activeDungeonId, fightState, fightVersion, players };
        touchGame(game);
        sessions.add(req.sessionId);
        res.json({ success: true, restored: true });
    }
    else {
        touchGame(game);
        res.json({ success: true, restored: false });
    }
});
// ---- Admin Endpoints ----
// Set cleared dungeons (nuclear escape hatch)
app.post('/api/admin/set-cleared', requireSession, requireGame, (req, res) => {
    const { clearedDungeonIds } = req.body;
    const { gameState, dungeons } = req.game;
    if (!Array.isArray(clearedDungeonIds)) {
        return res.status(400).json({ error: 'clearedDungeonIds must be an array' });
    }
    const validIds = dungeons.map(d => d.id);
    for (const id of clearedDungeonIds) {
        if (!validIds.includes(id)) {
            return res.status(400).json({ error: `Invalid dungeon ID: ${id}` });
        }
    }
    gameState.clearedDungeons = clearedDungeonIds;
    for (const player of Object.values(gameState.players)) {
        player.level = gameState.clearedDungeons.length + 1;
        const totalAttrEarned = (player.level - 1) * 2;
        const totalPerksEarned = player.level;
        const attrSpent = Object.keys(player.attributes).reduce((sum, key) => {
            const k = key;
            return sum + Math.max(0, player.attributes[k] - player.baseAttributes[k]);
        }, 0);
        const perksSpent = player.ownedSkillIds.length;
        player.attributePoints = Math.max(0, totalAttrEarned - attrSpent);
        player.perkPoints = Math.max(0, totalPerksEarned - perksSpent);
    }
    const anyUnspent = Object.values(gameState.players).some(p => p.attributePoints > 0 || p.perkPoints > 0);
    if (anyUnspent) {
        gameState.phase = 'levelup';
        // Save snapshots for undo
        const snapshots = {};
        for (const [id, player] of Object.entries(gameState.players)) {
            snapshots[id] = {
                attributes: { ...player.attributes },
                ownedSkillIds: [...player.ownedSkillIds],
                attributePoints: player.attributePoints,
                perkPoints: player.perkPoints,
            };
        }
        gameState.levelupSnapshots = snapshots;
    }
    else if (gameState.clearedDungeons.length >= 7) {
        gameState.phase = 'victory';
    }
    else {
        gameState.phase = 'map';
    }
    gameState.activeDungeonId = null;
    gameState.fightState = null;
    gameState.fightVersion = 0;
    gameState.version++;
    res.json({ success: true, gameState });
});
// Weaken boss: set all boss/minion HP to 1 (E2E test cheat)
app.post('/api/admin/weaken-boss', requireSession, requireGame, (req, res) => {
    const { gameState } = req.game;
    if (gameState.phase !== 'fight' || !gameState.fightState) {
        return res.status(400).json({ error: 'Not in fight phase or no fight state' });
    }
    const chars = gameState.fightState.characters;
    if (!Array.isArray(chars)) {
        return res.status(400).json({ error: 'Invalid fight state' });
    }
    for (const c of chars) {
        if ((c.type === 'boss' || c.type === 'minion') && c.state?.isAlive) {
            c.state.health = 1;
        }
    }
    gameState.fightVersion++;
    gameState.version++;
    res.json({ success: true });
});
// Reset game
app.post('/api/admin/reset-game', requireSession, requireGame, (req, res) => {
    const game = req.game;
    game.gameState = {
        version: game.gameState.version + 1,
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
app.post('/api/admin/set-dungeon-coords', requireSession, requireGame, (req, res) => {
    const { dungeonUpdates } = req.body;
    const { gameState, dungeons } = req.game;
    if (!Array.isArray(dungeonUpdates)) {
        return res.status(400).json({ error: 'dungeonUpdates must be an array' });
    }
    for (const update of dungeonUpdates) {
        const dungeon = dungeons.find(d => d.id === update.id);
        if (dungeon) {
            if (update.lat !== undefined)
                dungeon.lat = update.lat;
            if (update.lng !== undefined)
                dungeon.lng = update.lng;
            if (update.radiusMeters !== undefined)
                dungeon.radiusMeters = update.radiusMeters;
            if (update.name !== undefined)
                dungeon.name = update.name;
        }
    }
    gameState.version++;
    res.json({ success: true, dungeons });
});
// Force phase override
app.post('/api/admin/set-phase', requireSession, requireGame, (req, res) => {
    const { phase } = req.body;
    const { gameState } = req.game;
    const validPhases = ['lobby', 'map', 'fight', 'levelup', 'victory'];
    if (!validPhases.includes(phase)) {
        return res.status(400).json({ error: 'Invalid phase' });
    }
    gameState.phase = phase;
    gameState.version++;
    res.json({ success: true });
});
// ---- Cleanup timer ----
// Delete games inactive for >24h, check every 30min
const CLEANUP_INTERVAL = 30 * 60 * 1000;
const MAX_INACTIVITY = 24 * 60 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [code, game] of games) {
        if (now - game.lastActivity > MAX_INACTIVITY) {
            games.delete(code);
            console.log(`Cleaned up inactive game ${code}`);
        }
    }
}, CLEANUP_INTERVAL);
// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
    res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`Pub Fight server running on port ${PORT}`);
});
