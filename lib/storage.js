/* Lightweight storage adapter for Sokoban.
   - Falls back to localStorage when no remote provider configured
   - Optional Supabase integration: create a `users` table with
     columns: user_id (text, primary key), data (jsonb)
   - Server proxy mode: set serverUrl and proxy calls through the server
   - export functions: configure, loadUser, saveUser, adjustUndos
*/
import {isDemoMode} from './purchase.js';

const config = {
  provider: 'server', // null, 'supabase' (client), or 'server' (proxy to server)
  supabaseUrl: '',
  supabaseKey: '',
  serverUrl: (() => {
    const baseUrl = (typeof window !== 'undefined' && window.APP_CONFIG && (window.APP_CONFIG.apiBaseUrl || window.APP_CONFIG.serverUrl)) || '';
    return baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}/api/storage` : '/api/storage';
  })()
};

function getRequestHeaders(extra = {}) {
  const headers = {
    Accept: 'application/json',
    ...extra
  };

  const clientApiKey = typeof window !== 'undefined'
    ? (window.CLIENT_API_KEY || window.APP_CONFIG?.clientApiKey || window.__APP_CONFIG__?.clientApiKey)
    : '';

  if (clientApiKey) {
    headers['X-API-Key'] = clientApiKey;
  }

  return headers;
}

export function resolveStorageBaseUrl() {
  const configuredFromApp = (typeof window !== 'undefined' && window.APP_CONFIG && (window.APP_CONFIG.apiBaseUrl || window.APP_CONFIG.serverUrl)) || '';
  const configured = (configuredFromApp ? `${String(configuredFromApp).replace(/\/+$/, '')}/api/storage` : (config.serverUrl || '').trim());

  if (typeof window !== 'undefined' && (window.location.port === '5500' || window.location.port === '5501')) {
    return ['http://127.0.0.1:8787/api/storage', true];
  }

  if (configured && configured !== '/api/storage') {
    return [configured.replace(/\/+$/, ''), false];
  }

  return [(configured || '/api/storage').replace(/\/+$/, ''), false];
}

export function configureStorage(cfg = {}) {
  Object.assign(config, cfg);
}

export async function setServerConfig({ url }) {
  config.provider = 'server';
  config.serverUrl = url || '/api/storage';
}

function localKey(userId) {
  return `sokoban_user_${userId}`;
}

function useLocalStorageOnly(userId) {
  return !userId || isDemoMode(userId) || !config.provider;
}

function readLocalUser(userId) {
  if (!userId) return null;

  try {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Storage.readLocalUser failed', e);
    return null;
  }
}

export async function loadUser(userId) {
  if (useLocalStorageOnly(userId)) {
    return readLocalUser(userId);
  }

  // server-backed proxy
  if (config.provider === 'server') {
    try {
      const [baseUrl, areLocal] = resolveStorageBaseUrl();

      if (areLocal) {
        return readLocalUser(userId);
      }

      const url = `${baseUrl}/user/${encodeURIComponent(localKey(userId))}`;
      const res = await fetch(url, { headers: getRequestHeaders() });
      if (!res.ok) return null;
      const json = await res.json();
      return json && Object.prototype.hasOwnProperty.call(json, 'data') ? (json.data ?? null) : null;
    } catch (e) {
      console.warn('Storage.loadUser server proxy failed; using local backup only if available', e);
      return readLocalUser(userId);
    }
  }

  // Supabase simple REST upsert/read (client-side) - requires a `users` table
  try {
    const url = `${config.supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(localKey(userId))}`;
    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        Accept: 'application/json'
      }
    });
    const rows = await res.json();
    if (rows && rows.length) return rows[0].data ?? null;
    return null;
  } catch (e) {
    console.warn('Storage.loadUser supabase failed; using local backup only if available', e);
    return readLocalUser(userId);
  }
}

export async function saveUser(userId, data) {
  if (useLocalStorageOnly(userId)) {
    localStorage.setItem(localKey(userId), JSON.stringify(data));
    return;
  }

  // Keep a device-local backup for offline recovery, but do not let stale local data
  // replace the remote source of truth for real Telegram users.
  localStorage.setItem(localKey(userId), JSON.stringify(data));

  if (config.provider === 'server') {
    try {
      const [baseUrl, areLocal] = resolveStorageBaseUrl();

      if (areLocal) {
        return;
      }

      const url = `${baseUrl}/user/${encodeURIComponent(localKey(userId))}`;
      await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ data })
      });
      return;
    } catch (e) {
      console.warn('Storage.saveUser server proxy failed; kept a local backup for retry', e);
      return;
    }
  }

  try {
    // Upsert via REST: requires RLS to allow anon key to insert/update or use service role key
    const url = `${config.supabaseUrl}/rest/v1/users`;
    const body = JSON.stringify({ user_id: localKey(userId), data });
    await fetch(url, {
      method: 'POST',
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body
    });
  } catch (e) {
    console.warn('Storage.saveUser supabase failed; kept a local backup for retry', e);
  }
}

export async function adjustUndos(userId, delta) {
  const user = (await loadUser(userId)) || {};
  user.undos = Math.max(0, (user.undos || 0) + delta);
  await saveUser(userId, user);
  return user.undos;
}

export async function addStars(userId, amount) {
  const user = (await loadUser(userId)) || {};
  user.stars = Math.max(0, (user.stars || 0) + amount);
  await saveUser(userId, user);
  return user.stars;
}

export async function setSupabaseConfig({ url, key }) {
  config.provider = 'supabase';
  config.supabaseUrl = url;
  config.supabaseKey = key;
}

export async function getLeaderboard(limit = 10) {
  if (config.provider === 'server') {
    try {
      const [baseUrl,  areLocal] = resolveStorageBaseUrl();

      if(areLocal){ return};
      const url = `${baseUrl}/leaderboard?limit=${encodeURIComponent(limit)}`;
      const res = await fetch(url, { headers: getRequestHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.rows || [];
    } catch (e) {
      console.warn('Storage.getLeaderboard server proxy failed, falling back to local', e);
    }
  }

  const local = localStorage.getItem('sokoban_leaderboard');
  if (!local) return [];
  try {
    return JSON.parse(local).slice(0, limit);
  } catch {
    return [];
  }
}

export async function saveLeaderboardEntry(entry) {
  if (config.provider === 'server') {
    try {
      const [baseUrl,  areLocal] = resolveStorageBaseUrl();

      if(areLocal){ return};
      const url = `${baseUrl}/leaderboard`;
      await fetch(url, {
        method: 'POST',
        headers: getRequestHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(entry)
      });
      return;
    } catch (e) {
      console.warn('Storage.saveLeaderboardEntry server proxy failed, falling back to local', e);
    }
  }

  const local = localStorage.getItem('sokoban_leaderboard');
  const rows = local ? JSON.parse(local) : [];
  const idx = rows.findIndex(item => item.userId === entry.userId);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], ...entry };
  } else {
    rows.push(entry);
  }
  rows.sort((a, b) => b.completedLevels - a.completedLevels);
  localStorage.setItem('sokoban_leaderboard', JSON.stringify(rows.slice(0, 50)));
}

export default {
  configureStorage,
  loadUser,
  saveUser,
  adjustUndos,
  addStars,
  getLeaderboard,
  saveLeaderboardEntry
};
