import { db } from 'sdk';
import { auditLogs } from '../schema.js';

export async function logAdmin(adminId, action, targetUserId = null, details = '') {
  await db.insert(auditLogs).values({
    adminId: Number(adminId), action, targetUserId: targetUserId == null ? null : Number(targetUserId), details,
  }).run();
}
