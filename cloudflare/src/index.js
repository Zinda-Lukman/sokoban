import { createClient } from '@supabase/supabase-js';

const JSON_HEADERS = {
  'content-type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization'
};

function getEnv(env, key, fallback = '') {
  const value = env?.[key];
  return typeof value === 'string' ? value : fallback;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function isLocalDevRequest(request) {
  const host = request.headers.get('host') || '';
  const xForwardedHost = request.headers.get('x-forwarded-host') || '';
  const candidates = [host, xForwardedHost.split(',')[0].trim()];

  return candidates.some((candidate) => {
    if (!candidate) return false;
    const normalized = candidate.replace(/\[[^\]]+\]/, '').replace(/:\d+$/, '');
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
  });
}

function createAuthMiddleware(env) {
  return function authenticate(request) {
    const required = getEnv(env, 'CLIENT_API_KEY');
    if (!required || isLocalDevRequest(request)) return true;

    const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
    return apiKey === required;
  };
}

async function notifyAdminPurchase(env, status, details = {}) {
  const botToken = getEnv(env, 'BOT_TOKEN');
  const chatId = getEnv(env, 'ADMIN_CHAT_ID');
  if (!chatId || !botToken) return;

  const normalizedStatus = String(status || 'unknown').toLowerCase();
  const payload = details.payload || details.productId || 'unknown';
  const userId = details.userId ?? 'unknown';
  const product = details.title || details.product || 'unknown';
  const quantity = details.quantity ?? 1;
  const stars = details.stars ?? details.amount ?? 0;
  const errorMessage = details.errorMessage || details.error || details.message || '';

  const lines = [
    '💳 Purchase update',
    `Status: ${normalizedStatus}`,
    `User: ${userId}`,
    `Product: ${product}`,
    `Quantity: ${quantity}`,
    `Stars: ${stars}`,
    `Payload: ${payload}`
  ];

  if (errorMessage) lines.push(`Error: ${String(errorMessage)}`);

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        disable_web_page_preview: true
      })
    });
  } catch (error) {
    console.error('Failed to notify admin about purchase status', error);
  }
}

function getSupabaseClient(env) {
  const url = getEnv(env, 'SUPABASE_URL');
  const key = getEnv(env, 'SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  try {
    return createClient(url, key);
  } catch (error) {
    console.error('Supabase client creation failed', error);
    return null;
  }
}

async function handleStorageRequest(request, env, url) {
  const auth = createAuthMiddleware(env);
  if (!auth(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (pathParts[0] !== 'api' || pathParts[1] !== 'storage') {
    return jsonResponse({ error: 'Not found' }, 404);
  }

  const supabase = getSupabaseClient(env);
  if (!supabase) {
    return jsonResponse({ error: 'Server not configured for DB' }, 500);
  }

  const method = request.method.toUpperCase();
  const userId = pathParts[2] === 'user' ? decodeURIComponent(pathParts[3] || '') : null;
  const leaderboard = pathParts[2] === 'leaderboard';

  if (method === 'GET' && userId) {
    const { data, error } = await supabase.from('users').select('data').eq('user_id', userId).limit(1).maybeSingle();
    if (error) {
      console.error('storage GET user failed', error);
      return jsonResponse({ error: 'storage error' }, 500);
    }
    return jsonResponse({ data: data ? data.data : null });
  }

  if (method === 'POST' && userId) {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const payload = body && body.data;
    const up = { user_id: userId, data: payload };
    const { error } = await supabase.from('users').upsert(up, { onConflict: 'user_id' });
    if (error) {
      console.error('storage POST user failed', error);
      return jsonResponse({ error: 'storage error' }, 500);
    }
    return jsonResponse({ ok: true });
  }

  if (method === 'GET' && leaderboard) {
    const limit = Number(new URL(request.url).searchParams.get('limit') || '10') || 10;
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('completedLevels', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('storage GET leaderboard failed', error);
      return jsonResponse({ error: 'storage error' }, 500);
    }
    return jsonResponse({ rows: data || [] });
  }

  if (method === 'POST' && leaderboard) {
    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const { error } = await supabase.from('leaderboard').upsert(body, { onConflict: 'userId' });
    if (error) {
      console.error('storage POST leaderboard failed', error);
      return jsonResponse({ error: 'storage error' }, 500);
    }
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ error: 'Not found' }, 404);
}

async function handleTelegramWebhook(request, env) {
  const body = await request.json().catch(() => ({}));
  const updates = body || {};

  if (updates.pre_checkout_query) {
    const ok = true;
    const answer = {
      ok,
      result: { ok: true }
    };

    const apiUrl = `https://api.telegram.org/bot${getEnv(env, 'BOT_TOKEN')}/answerPreCheckoutQuery`;
    await fetch(apiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pre_checkout_query_id: updates.pre_checkout_query.id,
        ok: true
      })
    });

    return jsonResponse(answer);
  }

  if (updates.message && updates.message.successful_payment) {
    const payment = updates.message.successful_payment;
    const payload = payment.invoice_payload;
    const telegramId = updates.message.from?.id;
    const amount = payment.total_amount || 0;

    const supabase = getSupabaseClient(env);
    if (supabase) {
      await supabase.from('transactions').insert([{
        telegram_id: telegramId,
        payload,
        stars: amount
      }]);
    }

    await notifyAdminPurchase(env, 'succeeded', {
      userId: telegramId,
      payload,
      title: 'Telegram Stars purchase',
      quantity: 1,
      stars: amount
    });

    return jsonResponse({ ok: true, status: 'success' });
  }

  return jsonResponse({ ok: true, status: 'ignored' });
}

async function handleInvoiceCreate(request, env) {
  const auth = createAuthMiddleware(env);
  if (!auth(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { title, quantity = 1, stars = 0, payload, productId, currency = 'XTR', prices } = body;
  const botToken = getEnv(env, 'BOT_TOKEN');
  if (!botToken) {
    return jsonResponse({ error: 'Server misconfigured: BOT_TOKEN missing' }, 500);
  }

  try {
    const telegramUrl = `https://api.telegram.org/bot${botToken}/createInvoiceLink`;
    const invoiceBody = {
      title: title || 'Purchase',
      description: `Purchase ${quantity} ${title || 'item'} for SOKOBAN Telegram Game`,
      payload: payload || `${productId}_${Date.now()}`,
      provider_token: '',
      currency: currency || 'XTR',
      prices: prices || [{ label: title || 'item', amount: stars || 0 }]
    };

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(invoiceBody)
    });

    const data = await response.json();
    if (!response.ok || !data?.result) {
      throw new Error(data?.description || 'Telegram API error');
    }

    return jsonResponse({ invoiceUrl: data.result });
  } catch (error) {
    await notifyAdminPurchase(env, 'failed', {
      userId: body.userId,
      productId: body.productId,
      title: body.title,
      quantity: body.quantity,
      stars: body.stars,
      payload: body.payload,
      errorMessage: error?.message || String(error)
    });
    return jsonResponse({ error: 'Failed to create invoice link' }, 500);
  }
}

async function handlePurchaseStatus(request, env) {
  const auth = createAuthMiddleware(env);
  if (!auth(request)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  await notifyAdminPurchase(env, body.status || 'unknown', body);
  return jsonResponse({ ok: true });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: JSON_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return jsonResponse({ ok: true, status: 'healthy', env: getEnv(env, 'APP_ENV', 'development') });
    }

    if (url.pathname === '/telegram-webhook') {
      return handleTelegramWebhook(request, env);
    }

    if (url.pathname === '/api/invoice') {
      return handleInvoiceCreate(request, env);
    }

    if (url.pathname === '/api/purchase/status') {
      return handlePurchaseStatus(request, env);
    }

    if (url.pathname.startsWith('/api/storage/')) {
      return handleStorageRequest(request, env, url);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};
