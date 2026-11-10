import { api, db } from 'sdk';
import { ADMIN_IDS } from './config.js';
import { auditLogs } from '../schema.js';

export async function logAdmin(adminId, action, targetUserId = null, details = '') {
  await db.insert(auditLogs).values({
    adminId: Number(adminId), action, targetUserId: targetUserId == null ? null : Number(targetUserId), details,
  }).run();
}

export async function notifyAdmins(message) {
  const text = String(message || '').trim();
  if (!text) return [];

  const ids = [...new Set(ADMIN_IDS.map((id) => Number(id)).filter(Number.isFinite))];
  const sent = [];

  for (const adminId of ids) {
    try {
      await api.sendMessage({
        chat_id: adminId,
        text,
        disable_web_page_preview: true,
      });
      sent.push(adminId);
    } catch (error) {
      console.warn('notifyAdmins failed for admin', adminId, error);
    }
  }

  return sent;
}
