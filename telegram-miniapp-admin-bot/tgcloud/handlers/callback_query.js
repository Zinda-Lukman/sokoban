import { api, db } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';
import { isAdmin } from '../lib/config.js';
import { logAdmin } from '../lib/admin.js';
import {
  home, analyticsPage, retentionPage, usersPage, userPage,
  paymentsPage, moderationPage, gamePage, logsPage, render,
} from '../lib/dashboard.js';

export default async function (query) {
  const adminId = Number(query.from?.id);
  const chatId = query.message?.chat?.id;
  const messageId = query.message?.message_id;
  const data = query.data || '';
  if (!chatId || !messageId) {
    await api.answerCallbackQuery({ callback_query_id: query.id });
    return;
  }
  if (!isAdmin(adminId)) {
    await api.answerCallbackQuery({ callback_query_id: query.id, text: 'Not authorized.', show_alert: true });
    return;
  }

  try {
    if (data === 'close') {
      await api.deleteMessage({ chat_id: chatId, message_id: messageId });
    } else if (data === 'home') await home(chatId, messageId);
    else if (data === 'analytics') await analyticsPage(chatId, messageId);
    else if (data === 'retention') await retentionPage(chatId, messageId);
    else if (data.startsWith('users:')) await usersPage(chatId, messageId, Number(data.split(':')[1]) || 0);
    else if (data.startsWith('user:')) {
      const [, id, page] = data.split(':');
      await userPage(chatId, messageId, id, Number(page) || 0);
    } else if (data.startsWith('payments:')) await paymentsPage(chatId, messageId, Number(data.split(':')[1]) || 0);
    else if (data === 'moderation') await moderationPage(chatId, messageId);
    else if (data === 'game') await gamePage(chatId, messageId);
    else if (data.startsWith('logs:')) await logsPage(chatId, messageId, Number(data.split(':')[1]) || 0);
    else if (data.startsWith('toggleban:')) {
      const [, rawId, page] = data.split(':');
      const targetId = Number(rawId);
      const target = await db.select().from(users).where(eq(users.tgId, targetId)).get();
      if (isAdmin(targetId)) {
        await api.answerCallbackQuery({ callback_query_id: query.id, text: 'Admin accounts cannot be banned here.', show_alert: true });
        return;
      }
      if (!target) {
        await render(chatId, messageId, 'User not found.');
      } else {
        const nextBanned = !target.isBanned;
        await db.update(users).set({ isBanned: nextBanned, banReason: nextBanned ? 'Blocked by an administrator' : null }).where(eq(users.tgId, targetId)).run();
        await logAdmin(adminId, nextBanned ? 'ban_user' : 'unban_user', targetId);
        await userPage(chatId, messageId, targetId, Number(page) || 0);
        await api.answerCallbackQuery({ callback_query_id: query.id, text: nextBanned ? 'User banned.' : 'User unbanned.' });
        return;
      }
    } else {
      await api.answerCallbackQuery({ callback_query_id: query.id, text: 'Unknown action.' });
      return;
    }
    await api.answerCallbackQuery({ callback_query_id: query.id });
  } catch (error) {
    console.error('Admin callback failed:', error);
    await api.answerCallbackQuery({ callback_query_id: query.id, text: 'Action failed. Check logs.', show_alert: true });
  }
}
