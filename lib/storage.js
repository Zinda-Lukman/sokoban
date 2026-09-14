/* Lightweight storage adapter for Sokoban.
   - Falls back to localStorage when no remote provider configured
   - Optional Supabase integration: create a `users` table with
     columns: user_id (text, primary key), data (jsonb)
   - export functions: configure, loadUser, saveUser, adjustUndos
*/

const config = {
  provider: null, // 'supabase' or null
  supabaseUrl: '',
  supabaseKey: '',
};

export function configureStorage(cfg = {}) {
  Object.assign(config, cfg);
}

function localKey(userId) {
  return `sokoban_user_${userId}`;
}

export async function loadUser(userId) {
  if (!userId) return null;
  if (!config.provider) {
    const raw = localStorage.getItem(localKey(userId));
    return raw ? JSON.parse(raw) : null;
  }

  // Supabase simple REST upsert/read (requires a `users` table)
  try {
    const url = `${config.supabaseUrl}/rest/v1/users?user_id=eq.${encodeURIComponent(userId)}`;
    const res = await fetch(url, {
      headers: {
        apikey: config.supabaseKey,
        Authorization: `Bearer ${config.supabaseKey}`,
        Accept: 'application/json'
      }
    });
    const rows = await res.json();
    if (rows && rows.length) return rows[0].data || null;
    return null;
  } catch (e) {
    console.warn('Storage.loadUser supabase failed, falling back to local', e);
    const raw = localStorage.getItem(localKey(userId));
    return raw ? JSON.parse(raw) : null;
  }
}

export async function saveUser(userId, data) {
  if (!userId) return;
  if (!config.provider) {
    localStorage.setItem(localKey(userId), JSON.stringify(data));
    return;
  }

  try {
    // Upsert via REST: requires RLS to allow anon key to insert/update or use service role key
    const url = `${config.supabaseUrl}/rest/v1/users`;
    const body = JSON.stringify({ user_id: userId, data });
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
    console.warn('Storage.saveUser supabase failed, falling back to local', e);
    localStorage.setItem(localKey(userId), JSON.stringify(data));
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
  const local = localStorage.getItem('sokoban_leaderboard');
  if (!local) return [];
  try {
    return JSON.parse(local).slice(0, limit);
  } catch {
    return [];
  }
}

export async function saveLeaderboardEntry(entry) {
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
