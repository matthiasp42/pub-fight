const API_BASE = '/api';

const getSessionId = () => localStorage.getItem('sessionId');

export const api = {
  async auth(password) {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    return res.json();
  },

  async getState() {
    const res = await fetch(`${API_BASE}/state`, {
      headers: { 'X-Session-Id': getSessionId() }
    });
    if (!res.ok) throw new Error('Failed to fetch state');
    return res.json();
  },

  async join(playerId = null, name = null, characterClass = null) {
    const res = await fetch(`${API_BASE}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ playerId, name, characterClass })
    });
    return res.json();
  },

  async release(playerId) {
    const res = await fetch(`${API_BASE}/release`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ playerId })
    });
    return res.json();
  },

  async restore(state) {
    const res = await fetch(`${API_BASE}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
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
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      }
    });
    return res.json();
  },

  async enterDungeon(dungeonId) {
    const res = await fetch(`${API_BASE}/enter-dungeon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ dungeonId })
    });
    return res.json();
  },

  async postFightState(fightState, expectedVersion) {
    const res = await fetch(`${API_BASE}/fight-state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ fightState, expectedVersion })
    });
    return res.json();
  },

  async dungeonCleared(dungeonId) {
    const res = await fetch(`${API_BASE}/dungeon-cleared`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ dungeonId })
    });
    return res.json();
  },

  async distributeAttributes(playerId, deltas) {
    const res = await fetch(`${API_BASE}/distribute-attributes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ playerId, deltas })
    });
    return res.json();
  },

  async unlockSkill(playerId, skillId) {
    const res = await fetch(`${API_BASE}/unlock-skill`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ playerId, skillId })
    });
    return res.json();
  },

  async finishLevelup() {
    const res = await fetch(`${API_BASE}/finish-levelup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      }
    });
    return res.json();
  },

  // Admin endpoints
  async adminSetCleared(clearedDungeonIds) {
    const res = await fetch(`${API_BASE}/admin/set-cleared`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ clearedDungeonIds })
    });
    return res.json();
  },

  async adminResetGame() {
    const res = await fetch(`${API_BASE}/admin/reset-game`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      }
    });
    return res.json();
  },

  async adminSetDungeonCoords(dungeonUpdates) {
    const res = await fetch(`${API_BASE}/admin/set-dungeon-coords`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ dungeonUpdates })
    });
    return res.json();
  },

  async adminSetPhase(phase) {
    const res = await fetch(`${API_BASE}/admin/set-phase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ phase })
    });
    return res.json();
  },
};
