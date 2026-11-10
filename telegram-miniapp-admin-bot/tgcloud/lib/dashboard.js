import { api, db } from 'sdk';
import { eq, desc } from 'sdk/db';
import { users, payments, auditLogs, scores, sessions } from '../schema.js';
import { PAGE_SIZE, APP_TITLE } from './config.js';
import { getAnalytics, getRetention } from './analytics.js';

const keyboard = (rows) => ({ inline_keyboard: rows });
const btn = (text, data) => ({ text, callback_data: data });

export async function render(chatId, messageId, text, rows = []) {
  const reply_markup = keyboard([...rows, [btn('↻ Refresh', 'home'), btn('✖ Close', 'close')]]);
  if (messageId) {
    await api.editMessageText({ chat_id: chatId, message_id: messageId, text, reply_markup });
  } else {
    await api.sendMessage({ chat_id: chatId, text, reply_markup });
  }
}

export async function home(chatId, messageId) {
  await render(chatId, messageId, `⚙️ ${APP_TITLE} — Admin dashboard\nChoose a section:`, [
    [btn('📊 Analytics', 'analytics'), btn('🔁 Retention', 'retention')],
    [btn('👥 Users', 'users:0'), btn('💳 Payments', 'payments:0')],
    [btn('🛡 Moderation', 'moderation'), btn('🎮 Game stats', 'game')],
    [btn('📜 Admin log', 'logs:0')],
  ]);
}

export async function analyticsPage(chatId, messageId) {
  const a = await getAnalytics();
  const revenue = Object.entries(a.revenue).map(([currency, amount]) => `${currency}: ${amount}${currency === 'XTR' ? ' Stars' : ' (Bot API minor units)'}`).join('\n') || 'No payments yet';
  await render(chatId, messageId,
    `📊 ANALYTICS\n\nUsers: ${a.totalUsers}\nBanned: ${a.bannedUsers}\nNew today: ${a.newToday}\nNew 7 days: ${a.new7d}\n\nDAU: ${a.dau}\nWAU: ${a.wau}\nMAU: ${a.mau}\nSessions today: ${a.sessionsToday}\n\nPayments: ${a.paymentCount}\nRevenue (XTR is whole Stars; other currencies are Bot API minor units):\n${revenue}`,
    [[btn('🔁 Retention', 'retention')]]);
}

export async function retentionPage(chatId, messageId) {
  const rows = await getRetention();
  const lines = rows.map((r) => `Day ${r.day}: ${r.returned}/${r.cohort} (${r.rate}%)`).join('\n');
  await render(chatId, messageId, `🔁 RETENTION\n\n${lines}\n\nDay-N is calculated against the UTC calendar date exactly N days after each user's signup date. Activity is recorded when the bot or Mini App tracking endpoint is used.`);
}

export async function usersPage(chatId, messageId, page = 0) {
  const rows = await db.select().from(users).orderBy(desc(users.createdAt)).limit(PAGE_SIZE).offset(page * PAGE_SIZE).all();
  const buttons = rows.map((u) => [btn(`${u.isBanned ? '🚫' : '👤'} ${u.firstName || 'User'} · ${u.tgId}`, `user:${u.tgId}:${page}`)]);
  buttons.push([btn('⬅ Prev', `users:${Math.max(0, page - 1)}`), btn('Next ➡', `users:${page + 1}`)]);
  await render(chatId, messageId, `👥 USERS · page ${page + 1}\nSelect a user to view details.`, buttons);
}

export async function userPage(chatId, messageId, tgId, page = 0) {
  const u = await db.select().from(users).where(eq(users.tgId, Number(tgId))).get();
  if (!u) return render(chatId, messageId, 'User not found.');
  const [paymentCount, sessionCount] = await Promise.all([
    db.$count(payments, eq(payments.userId, Number(tgId))),
    db.$count(sessions, eq(sessions.userId, Number(tgId))),
  ]);
  await render(chatId, messageId,
    `👤 USER PROFILE\n\nID: ${u.tgId}\nName: ${u.firstName ?? ''} ${u.lastName ?? ''}\nUsername: ${u.username ? '@' + u.username : '—'}\nBanned: ${u.isBanned ? 'YES' : 'No'}\nReason: ${u.banReason || '—'}\nJoined: ${u.createdAt?.toISOString?.() ?? '—'}\nLast seen: ${u.lastSeen?.toISOString?.() ?? '—'}\nPayments: ${paymentCount}\nSessions: ${sessionCount}`,
    [[btn(u.isBanned ? 'Unban user' : 'Ban user', `toggleban:${u.tgId}:${page}`)]]);
}

export async function paymentsPage(chatId, messageId, page = 0) {
  const rows = await db.select().from(payments).orderBy(desc(payments.createdAt)).limit(PAGE_SIZE).offset(page * PAGE_SIZE).all();
  const lines = rows.map((p) => `#${p.id} · user ${p.userId} · ${p.amount} ${p.currency} · ${p.createdAt?.toISOString?.().slice(0, 10) ?? ''}`);
  await render(chatId, messageId, `💳 PAYMENTS · page ${page + 1}\n\n${lines.join('\n') || 'No successful payments recorded.'}`,
    [[btn('⬅ Prev', `payments:${Math.max(0, page - 1)}`), btn('Next ➡', `payments:${page + 1}`)]]);
}

export async function moderationPage(chatId, messageId) {
  const count = await db.$count(users, eq(users.isBanned, true));
  await render(chatId, messageId, `🛡 MODERATION\n\nBanned users: ${count}\nUse Users to open a profile and ban/unban an account. Bans are enforced by the Mini App endpoints.`);
}

export async function gamePage(chatId, messageId) {
  const count = await db.$count(scores);
  const best = await db.select().from(scores).orderBy(desc(scores.score)).limit(5).all();
  const lines = best.map((s, i) => `${i + 1}. ${s.userId}: ${s.score} (level ${s.level ?? 1})`);
  await render(chatId, messageId, `🎮 GAME STATS\n\nScore records: ${count}\nTop scores:\n${lines.join('\n') || 'No scores yet.'}`);
}

export async function logsPage(chatId, messageId, page = 0) {
  const rows = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(PAGE_SIZE).offset(page * PAGE_SIZE).all();
  const lines = rows.map((x) => `${x.createdAt?.toISOString?.() ?? ''} · admin ${x.adminId} · ${x.action} · target ${x.targetUserId ?? '—'}`);
  await render(chatId, messageId, `📜 ADMIN LOG · page ${page + 1}\n\n${lines.join('\n') || 'No actions logged.'}`,
    [[btn('⬅ Prev', `logs:${Math.max(0, page - 1)}`), btn('Next ➡', `logs:${page + 1}`)]]);
}
