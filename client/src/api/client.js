const API_BASE = '/api';

const getSessionId = () => localStorage.getItem('sessionId');
const getGameId = () => localStorage.getItem('gameId');

export class GameNotFoundError extends Error {
  constructor() {
    super('Game not found');
    this.name = 'GameNotFoundError';
  }
}

function sessionHeaders() {
  return { 'X-Session-Id': getSessionId() };
}

function gameHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Session-Id': getSessionId(),
    'X-Game-Id': getGameId(),
  };
}

async function handleGameResponse(res) {
  if (res.status === 404) {
    const body = await res.json();
    if (body.code === 'GAME_NOT_FOUND') throw new GameNotFoundError();
    return body;
  }
  if (res.status === 400) {
    const body = await res.json();
    if (body.code === 'GAME_NOT_FOUND') throw new GameNotFoundError();
    return body;
  }
  return res.json();
}

export const api = {
  async auth(password) {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return res.json();
  },

  async createGame() {
    const res = await fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sessionHeaders() }
    });
    return res.json();
  },

  async checkGame(code) {
    const res = await fetch(`${API_BASE}/games/${code}`, {
      headers: sessionHeaders()
    });
    return res.json();
  },

  async getState() {
    const res = await fetch(`${API_BASE}/state`, {
      headers: { ...sessionHeaders(), 'X-Game-Id': getGameId() }
    });
    if (!res.ok) {
      if (res.status === 404 || res.status === 400) {
        const body = await res.json();
        if (body.code === 'GAME_NOT_FOUND') throw new GameNotFoundError();
      }
      throw new Error('Failed to fetch state');
    }
    return res.json();
  },

  async join(playerId = null, name = null, characterClass = null) {
    const res = await fetch(`${API_BASE}/join`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ playerId, name, characterClass })
    });
    return handleGameResponse(res);
  },

  async release(playerId) {
    const res = await fetch(`${API_BASE}/release`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ playerId })
    });
    return handleGameResponse(res);
  },

  async restore(state) {
    const res = await fetch(`${API_BASE}/restore`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify(state)
    });
    return res.json();
  },

  async getSkills(characterClass = null) {
    const url = characterClass
      ? `${API_BASE}/skills/${characterClass}`
      : `${API_BASE}/skills`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch skills');
    return res.json();
  },

  async startGame() {
    const res = await fetch(`${API_BASE}/start-game`, {
      method: 'POST',
      headers: gameHeaders()
    });
    return handleGameResponse(res);
  },

  async enterDungeon(dungeonId) {
    const res = await fetch(`${API_BASE}/enter-dungeon`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ dungeonId })
    });
    return handleGameResponse(res);
  },

  async postFightState(fightState, expectedVersion) {
    const res = await fetch(`${API_BASE}/fight-state`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ fightState, expectedVersion })
    });
    return handleGameResponse(res);
  },

  async dungeonCleared(dungeonId) {
    const res = await fetch(`${API_BASE}/dungeon-cleared`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ dungeonId })
    });
    return handleGameResponse(res);
  },

  async distributeAttributes(playerId, deltas) {
    const res = await fetch(`${API_BASE}/distribute-attributes`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ playerId, deltas })
    });
    return handleGameResponse(res);
  },

  async unlockSkill(playerId, skillId) {
    const res = await fetch(`${API_BASE}/unlock-skill`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ playerId, skillId })
    });
    return handleGameResponse(res);
  },

  async undoLevelup(playerId) {
    const res = await fetch(`${API_BASE}/undo-levelup`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ playerId })
    });
    return handleGameResponse(res);
  },

  async finishLevelup() {
    const res = await fetch(`${API_BASE}/finish-levelup`, {
      method: 'POST',
      headers: gameHeaders()
    });
    return handleGameResponse(res);
  },

  // Admin endpoints
  async adminSetCleared(clearedDungeonIds) {
    const res = await fetch(`${API_BASE}/admin/set-cleared`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ clearedDungeonIds })
    });
    return handleGameResponse(res);
  },

  async adminResetGame() {
    const res = await fetch(`${API_BASE}/admin/reset-game`, {
      method: 'POST',
      headers: gameHeaders()
    });
    return handleGameResponse(res);
  },

  async adminSetDungeonCoords(dungeonUpdates) {
    const res = await fetch(`${API_BASE}/admin/set-dungeon-coords`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ dungeonUpdates })
    });
    return handleGameResponse(res);
  },

  async adminSetPhase(phase) {
    const res = await fetch(`${API_BASE}/admin/set-phase`, {
      method: 'POST',
      headers: gameHeaders(),
      body: JSON.stringify({ phase })
    });
    return handleGameResponse(res);
  },

  async adminWeakenBoss() {
    const res = await fetch(`${API_BASE}/admin/weaken-boss`, {
      method: 'POST',
      headers: gameHeaders()
    });
    return handleGameResponse(res);
  },
};
