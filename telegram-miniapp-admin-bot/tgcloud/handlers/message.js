import { api, db } from 'sdk';
import { payments } from '../schema.js';
import { MINI_APP_URL, APP_TITLE, isAdmin } from '../lib/config.js';
import { touchUser } from '../lib/users.js';
import { home, analyticsPage } from '../lib/dashboard.js';
import { notifyAdmins } from '../lib/admin.js';

async function sendStart(chatId, user) {
  if (user.isBanned) {
    await api.sendMessage({ chat_id: chatId, text: 'Your account is currently restricted. Contact support if you believe this is a mistake.' });
    return;
  }
  const keyboard = { inline_keyboard: [[{ text: `🎮 PLAY ${APP_TITLE}`, web_app: { url: MINI_APP_URL } }]] };
  await api.sendMessage({ chat_id: chatId, text: `Welcome, ${user.firstName || 'player'}! Tap below to PLAY SOKOBAN. 
    
    `, reply_markup: keyboard });
  if (isAdmin(user.tgId)) {
    await api.sendMessage({ chat_id: chatId, text: 'Admin tools are available with /admin.' });
  }
}

export default async function (message) {
  if (!message?.from || !message?.chat) return;

  // Telegram sends successful Stars/card payments as a Message update.
  if (message.successful_payment) {
    await touchUser(message.from);
    const p = message.successful_payment;
    const paymentRecord = {
      userId: Number(message.from.id),
      chargeId: p.telegram_payment_charge_id,
      providerChargeId: p.provider_payment_charge_id || null,
      amount: Number(p.total_amount),
      currency: p.currency,
      invoicePayload: p.invoice_payload || null,
    };
    await db.insert(payments).values(paymentRecord).onConflictDoUpdate({
      target: payments.chargeId,
      set: { chargeId: p.telegram_payment_charge_id },
    }).run();
    await api.sendMessage({ chat_id: message.chat.id, text: '✅ Payment received. Thank you!' });
    await notifyAdmins([
      '💳 Successful payment received',
      `User: ${message.from.id}`,
      `Amount: ${paymentRecord.amount} ${paymentRecord.currency}`,
      `Payload: ${paymentRecord.invoicePayload || 'n/a'}`,
    ].join('\n'));
    return;
  }

  const user = await touchUser(message.from);
  if (user.isBanned && !isAdmin(message.from.id)) {
    if (message.text?.startsWith('/start')) {
      await sendStart(message.chat.id, user);
    }
    return;
  }

  const text = (message.text || '').trim();
  const command = text.split(/\s+/)[0].split('@')[0].toLowerCase();

  if (command === '/start') return sendStart(message.chat.id, user);
  if (command === '/admin') {
    if (!isAdmin(message.from.id)) return api.sendMessage({ chat_id: message.chat.id, text: 'Not authorized.' });
    return home(message.chat.id, null);
  }
  if (command === '/stats') {
    if (!isAdmin(message.from.id)) return api.sendMessage({ chat_id: message.chat.id, text: 'Not authorized.' });
    return analyticsPage(message.chat.id, null);
  }
  if (command === '/help') {
    const help = isAdmin(message.from.id)
      ? 'Commands: /start, /admin, /stats, /help. Use the admin dashboard for user moderation and reports.'
      : 'Commands: /start, /help. Tap the button to open the Mini App.';
    return api.sendMessage({ chat_id: message.chat.id, text: help });
  }
};
