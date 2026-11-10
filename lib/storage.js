/* Lightweight storage adapter for Sokoban.
   - Falls back to localStorage when no remote provider configured
   - Optional Supabase integration: create a `users` table with
     columns: user_id (text, primary key), data (jsonb)
   - Server proxy mode: set serverUrl and proxy calls through the server
   - export functions: configure, loadUser, saveUser, adjustUndos
*/
import { isDemoMode } from './purchase.js';

const config = {
  provider: 'server', // null, 'supabase' (client), or 'server' (proxy to server)
  supabaseUrl: '',
  supabaseKey: '',
  serverUrl: (() => {
    const rootWindow = typeof globalThis !== 'undefined' ? (globalThis.window || globalThis) : null;
    const baseUrl = (rootWindow && rootWindow.APP_CONFIG && (rootWindow.APP_CONFIG.apiBaseUrl || rootWindow.APP_CONFIG.serverUrl)) || '';
    return baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}/api/storage` : '/api/storage';
  })()
};

function getRootWindow() {
  if (typeof globalThis !== 'undefined' && globalThis.window) return globalThis.window;
  if (typeof window !== 'undefined') return window;
  return null;
}

function getRequestHeaders(extra = {}) {
  const headers = {
    Accept: 'application/json',
    ...extra
  };

  const rootWindow = getRootWindow();
  const clientApiKey = rootWindow
    ? (rootWindow.CLIENT_API_KEY || rootWindow.APP_CONFIG?.clientApiKey || rootWindow.__APP_CONFIG__?.clientApiKey)
    : '';

  if (clientApiKey) {
    headers['X-API-Key'] = clientApiKey;
  }

  return headers;
}

export function resolveStorageBaseUrl() {
  const rootWindow = getRootWindow();
  const configuredFromApp = (rootWindow && rootWindow.APP_CONFIG && (rootWindow.APP_CONFIG.apiBaseUrl || rootWindow.APP_CONFIG.serverUrl)) || '';
  const configured = (configuredFromApp ? `${String(configuredFromApp).replace(/\/+$/, '')}/api/storage` : (config.serverUrl || '').trim());

  if (rootWindow && (rootWindow.location?.port === '5500' || rootWindow.location?.port === '5501')) {
    return ['http://127.0.0.1:8787/api/storage', true];
  }

  if (configured && configured !== '/api/storage') {
    return [configured.replace(/\/+$/, ''), false];
  }

  return [(configured || '/api/storage').replace(/\/+$/, ''), false];
}

export function resolveStorageBackendPreference() {
  const rootWindow = getRootWindow();
  const hasTelegramServerless = Boolean(
    rootWindow &&
    rootWindow.Telegram &&
    rootWindow.Telegram.WebApp &&
    rootWindow.Telegram.WebApp.Serverless &&
    typeof rootWindow.Telegram.WebApp.Serverless.call === 'function'
  );

  return hasTelegramServerless
    ? { primary: 'telegram-serverless', fallback: 'cloudflare' }
    : { primary: 'cloudflare', fallback: 'telegram-serverless' };
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

function unwrapStoragePayload(value) {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'data')) {
    return value.data;
  }
  return value;
}

export async function callStorageEndpoint(name, payload = {}) {
  const rootWindow = getRootWindow();
  const serverless = rootWindow && rootWindow.Telegram && rootWindow.Telegram.WebApp && rootWindow.Telegram.WebApp.Serverless;

  if (serverless && typeof serverless.call === 'function') {
    try {
      const result = await new Promise((resolve, reject) => {
        serverless.call(name, payload || {}, (error, response) => {
          if (error) return reject(error);
          resolve(response);
        });
      });

      const normalized = unwrapStoragePayload(result);
      return {
        ...(normalized && typeof normalized === 'object' ? normalized : { result: normalized }),
        source: 'telegram-serverless',
        name,
      };
    } catch (error) {
      console.warn(`Storage.${name} via Telegram serverless failed; falling back to Cloudflare.`, error);
    }
  }

  try {
    const [baseUrl, areLocal] = resolveStorageBaseUrl();
    if (areLocal || !baseUrl || baseUrl === '/api/storage') {
      return { source: 'local', name, ...(payload.userId ? { userId: payload.userId } : {}) };
    }

    let url = baseUrl;
    let method = 'GET';
    let body;

    if (name === 'loadUser') {
      url = `${baseUrl}/user/${encodeURIComponent(localKey(payload.userId))}`;
    } else if (name === 'saveUser') {
      url = `${baseUrl}/user/${encodeURIComponent(localKey(payload.userId))}`;
      method = 'POST';
      body = JSON.stringify({ data: payload.data });
    } else if (name === 'getLeaderboard') {
      url = `${baseUrl}/leaderboard?limit=${encodeURIComponent(Number(payload.limit ?? 10) || 10)}`;
    } else if (name === 'saveLeaderboardEntry') {
      url = `${baseUrl}/leaderboard`;
      method = 'POST';
      body = JSON.stringify(payload.entry || payload);
    }

    const res = await fetch(url, {
      method,
      headers: getRequestHeaders({ 'Content-Type': 'application/json' }),
      body
    });

    if (!res.ok) {
      throw new Error(`Storage fallback failed (${res.status})`);
    }

    const json = await res.json();
    const normalized = unwrapStoragePayload(json);
    return {
      ...(normalized && typeof normalized === 'object' ? normalized : { result: normalized }),
      source: 'cloudflare',
      name,
    };
  } catch (error) {
    console.warn(`Storage.${name} via Cloudflare fallback failed.`, error);
    return { source: 'error', name, error: String(error) };
  }
}

export async function loadUser(userId) {
  if (useLocalStorageOnly(userId)) {
    return readLocalUser(userId);
  }

  const result = await callStorageEndpoint('loadUser', { userId });
  const payload = unwrapStoragePayload(result);
  return payload ?? readLocalUser(userId);
}

export async function saveUser(userId, data) {
  if (useLocalStorageOnly(userId)) {
    localStorage.setItem(localKey(userId), JSON.stringify(data));
    return;
  }

  localStorage.setItem(localKey(userId), JSON.stringify(data));

  const result = await callStorageEndpoint('saveUser', { userId, data });
  return unwrapStoragePayload(result);
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
  if (useLocalStorageOnly('leaderboard')) {
    const local = localStorage.getItem('sokoban_leaderboard');
    if (!local) return [];
    try {
      return JSON.parse(local).slice(0, limit);
    } catch {
      return [];
    }
  }

  const result = await callStorageEndpoint('getLeaderboard', { limit });
  const rows = unwrapStoragePayload(result);
  if (Array.isArray(rows)) return rows.slice(0, limit);
  if (Array.isArray(result?.rows)) return result.rows.slice(0, limit);

  const local = localStorage.getItem('sokoban_leaderboard');
  if (!local) return [];
  try {
    return JSON.parse(local).slice(0, limit);
  } catch {
    return [];
  }
}

export async function saveLeaderboardEntry(entry) {
  if (useLocalStorageOnly(entry?.userId || 'leaderboard')) {
    const local = localStorage.getItem('sokoban_leaderboard');
    const rows = local ? JSON.parse(local) : [];
    const idx = rows.findIndex((item) => item.userId === entry.userId);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...entry };
    } else {
      rows.push(entry);
    }
    rows.sort((a, b) => b.completedLevels - a.completedLevels);
    localStorage.setItem('sokoban_leaderboard', JSON.stringify(rows.slice(0, 50)));
    return;
  }

  const result = await callStorageEndpoint('saveLeaderboardEntry', { entry });
  return unwrapStoragePayload(result);
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
