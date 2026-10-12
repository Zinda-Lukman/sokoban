require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const path = require('path');
const { Telegraf } = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

// initialize server-side Supabase client when SERVICE_ROLE_KEY is provided
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
}

// Optional Postgres pool (for direct DB access). If you set `DATABASE_URL`
// in your environment, a `db.query(...)` helper will be available.
let db = null;
if (process.env.DATABASE_URL) {
  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = { query: (...args) => pool.query(...args), pool };
    console.log('Postgres pool initialized');
  } catch (err) {
    console.warn('Failed to initialize Postgres pool', err);
    db = null;
  }
}

// serve project root (adjust if you use a build dir)
app.use(express.static(path.join(__dirname, '..')));

const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

async function notifyAdminPurchase(status, details = {}) {
  const chatId = process.env.ADMIN_CHAT_ID;
  if (!chatId || !bot || !bot.telegram) return;
   console.log("Sending Message")
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
    `Payload: ${payload}`,
  ];

  if (errorMessage) {
    lines.push('Error: ' + String(errorMessage));
  }

  try {
    await bot.telegram.sendMessage(chatId, lines.join('\n'));
  } catch (err) {
    console.error('Failed to notify admin about purchase status', err);
  }
}

// Storage proxy endpoints for client to call securely via server
// GET /api/storage/user/:userId  -> returns { data }
// POST /api/storage/user/:userId -> body { data } (upsert)
// GET /api/storage/leaderboard?limit=N -> { rows }
// POST /api/storage/leaderboard -> body is entry object

app.get('/api/storage/user/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    console.log(supabase)
    if (!supabase) return res.status(500).json({ error: 'Server not configured for DB' });
    const { data, error } = await supabase.from('users').select('data').eq('user_id', userId).limit(1).maybeSingle();
    if (error) throw error;
    console.log(`Got data for user ${userId, data}`)
    return res.json({ data: data ? data.data : null });
  } catch (e) {
    console.error('storage GET user failed', e);
    return res.status(500).json({ error: 'storage error' });
  }
});

app.post('/api/storage/user/:userId', authenticate, async (req, res) => {
  const { userId } = req.params;
  const payload = req.body && req.body.data;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  try {
    if (!supabase) return res.status(500).json({ error: 'Server not configured for DB' });
    const up = { user_id: userId, data: payload };
    const { error } = await supabase.from('users').upsert(up, { onConflict: 'user_id' });
    if (error) throw error;
    console.log(`Posted data for user ${String(req.body.data)}`)
    return res.json({ ok: true });
  } catch (e) {
    console.error('storage POST user failed', e);
    return res.status(500).json({ error: 'storage error' });
  }
});

app.get('/api/storage/leaderboard', authenticate, async (req, res) => {
  const limit = parseInt(req.query.limit || '10', 10) || 10;
  try {
    if (!supabase) return res.status(500).json({ error: 'Server not configured for DB' });
    const { data, error } = await supabase.from('leaderboard').select('*').order('completedLevels', { ascending: false }).limit(limit);
    if (error) throw error;
    return res.json({ rows: data || [] });
  } catch (e) {
    console.error('storage GET leaderboard failed', e);
    return res.status(500).json({ error: 'storage error' });
  }
});

app.post('/api/storage/leaderboard', authenticate, async (req, res) => {
  const entry = req.body;
  try {
    if (!supabase) return res.status(500).json({ error: 'Server not configured for DB' });
    const { error } = await supabase.from('leaderboard').upsert(entry, { onConflict: 'userId' });
    if (error) throw error;
    return res.json({ ok: true });
  } catch (e) {
    console.error('storage POST leaderboard failed', e);
    return res.status(500).json({ error: 'storage error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

//const BOT_TOKEN = process.env.BOT_TOKEN; // keep secret
//const PAYMENT_PROVIDER_TOKEN = "n"; // provider token (e.g. from payments)
console.log("RELOADED")
// Allow local development traffic without a shared key. In production, the
// client must still send the configured API key for protected endpoints.
function isLocalDevRequest(req) {
  const host = String(req.hostname || '').toLowerCase();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').toLowerCase();
  const candidates = [host, forwardedHost.split(',')[0].trim()];

  return candidates.some(candidate => {
    if (!candidate) return false;
    const normalized = candidate.replace(/\[[^\]]+\]/, '').replace(/:\d+$/, '');
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
  });
}

function authenticate(req, res, next) {
  const required = process.env.CLIENT_API_KEY;
  if (!required || isLocalDevRequest(req)) return next();

  const apiKey = req.headers['x-api-key'] || req.headers['x-api-key'.toLowerCase()];
  if (apiKey === required) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

app.post('/api/invoice', authenticate, async (req, res) => {
  try {
    //if (!BOT_TOKEN) return res.status(500).json({ error: 'Server misconfigured: BOT_TOKEN missing' });
    //if (!PAYMENT_PROVIDER_TOKEN) return res.status(500).json({ error: 'Server misconfigured: PAYMENT_PROVIDER_TOKEN missing' });

    const { userId, productId, title, quantity, stars, payload, currency, prices } = req.body || {};

    // Build Telegram createInvoiceLink request
    //const url = `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`;
    const body = {
      title: title || 'Purchase',
      description: `Purchase ${quantity} ${title} for SOKOBAN Telegram Game`,
      payload: payload || `${productId}_${Date.now()}`,
      provider_token: '',
      currency: currency || 'XTR',
      prices: prices || [{ label: title || 'item', amount: stars || 0 }],
      // optional fields: max_tip_amount, suggested_tip_amounts, start_parameter, provider_data
    };

    /** 
    const telegramRes = await axios.post(url, body, { headers: { 'Content-Type': 'application/json' } });
    const data = telegramRes.data;
    if (!data || !data.ok) {
      console.error('Telegram error', data);
      return res.status(502).json({ error: 'Telegram API error', details: data });
    }

    // Telegram returns link in result.invoice_link
    const invoiceUrl = data.result;
    if (!invoiceUrl) {
      return res.status(502).json({ error: 'Missing invoice link from Telegram', details: data });
    }
      */

    const invoiceUrl = await bot.telegram.createInvoiceLink(body);

    return res.json({ invoiceUrl });
  } catch (err) {
    const errorPayload = req.body || {};
    const errorText = err && (err.response?.data || err.message || String(err));
    console.error('Invoice creation failed', errorText);
    await notifyAdminPurchase('failed', {
      userId: errorPayload.userId,
      productId: errorPayload.productId,
      title: errorPayload.title,
      quantity: errorPayload.quantity,
      stars: errorPayload.stars,
      payload: errorPayload.payload,
      errorMessage: errorText,
    });
    return res.status(500).json({ error: 'Failed to create invoice link' });
  }
});

app.post('/api/purchase/status', authenticate, async (req, res) => {
  try {
    const payload = req.body || {};
    const status = payload.status || 'unknown';
    await notifyAdminPurchase(status, payload);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Failed to forward purchase status to admin', err);
    return res.status(500).json({ error: 'Unable to record purchase status' });
  }
});

bot.on('pre_checkout_query', async (ctx) => {
    try {
      await ctx.answerPreCheckoutQuery(true);
      console.log("Answered Query")
    } catch (error) {
      await ctx.answerPreCheckoutQuery(false, 'Validation failed');
      await notifyAdminPurchase('failed', {
        userId: ctx.from && ctx.from.id,
        payload: ctx.update?.pre_checkout_query?.invoice_payload,
        errorMessage: 'Pre-checkout validation failed: ' + (error && error.message ? error.message : String(error)),
      });
    }
  });

bot.on('message', async (ctx) => {
    if (!ctx.message.successful_payment) return;
    const payment = ctx.message.successful_payment;
    const payload = payment.invoice_payload;
    try {
      if (supabase) {
        await supabase.from('transactions').insert([{ telegram_id: ctx.from.id, payload: payload, stars: payment.total_amount }]);
      } else if (db && db.query) {
        await db.query(
          'INSERT INTO transactions (telegram_id, payload, stars) VALUES ($1, $2, $3)',
          [ctx.from.id, payload, payment.total_amount]
        );
      } else {
        console.warn('No DB configured — transaction not persisted', { from: ctx.from.id, payload, amount: payment.total_amount });
      }
      await notifyAdminPurchase('succeeded', {
        userId: ctx.from.id,
        payload,
        title: 'Telegram Stars purchase',
        quantity: 1,
        stars: payment.total_amount,
      });
      await ctx.reply('Payment successful!');
    } catch (err) {
      const errorText = err && (err.message || String(err));
      console.error('Failed to persist transaction', err);
      await notifyAdminPurchase('failed', {
        userId: ctx.from.id,
        payload,
        title: 'Telegram Stars purchase',
        quantity: 1,
        stars: payment.total_amount,
        errorMessage: 'Payment was received but persistence failed: ' + errorText,
      });
      try { await ctx.reply('Payment received but server failed to persist transaction.'); } catch (e) {}
    }
  });



app.listen(port, () => console.log(`Purchase server listening on port ${port}`));

// Start the Telegram bot: long-polling for local/dev, webhook if PUBLIC_URL set
(async function startBot() {
  if (!process.env.BOT_TOKEN) {
    console.warn('BOT_TOKEN not set; Telegram bot will not be launched');
    return;
  }

  const webhookPath = '/telegram-webhook';
  const publicUrl = process.env.PUBLIC_URL && process.env.PUBLIC_URL.replace(/\/$/, '');

  if (publicUrl) {
    // Webhook mode: mount the webhook handler and register webhook with Telegram
    app.use(webhookPath, bot.webhookCallback(webhookPath));
    try {
      await bot.telegram.setWebhook(publicUrl + webhookPath);
      console.log('Telegraf webhook configured at', publicUrl + webhookPath);
    } catch (err) {
      console.warn('Failed to set Telegram webhook, falling back to long-polling', err);
      try {
        await bot.launch();
        console.log('Telegraf bot launched (long-polling fallback)');
      } catch (e) {
        console.error('Failed to launch Telegraf bot', e);
      }
    }
  } else {
    // Local/dev: use long-polling
    try {
      await bot.launch();
      console.log('Telegraf bot launched (long-polling)');
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (err) {
      console.error('Failed to launch Telegraf bot', err);
    }
  }
})();
