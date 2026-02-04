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

  async join(playerId = null, name = null) {
    const res = await fetch(`${API_BASE}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ playerId, name })
    });
    return res.json();
  },

  async action(playerId, delta) {
    const res = await fetch(`${API_BASE}/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-Id': getSessionId()
      },
      body: JSON.stringify({ playerId, delta })
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
  }
};
