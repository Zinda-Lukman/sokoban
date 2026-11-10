import { table, integer, text, boolean, index, sql } from 'sdk/db';

export const users = table('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tgId: integer('tg_id').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  username: text('username'),
  languageCode: text('language_code'),
  isBanned: boolean('is_banned').notNull().default(false),
  banReason: text('ban_reason'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  lastSeen: integer('last_seen', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  tgIdIdx: index('users_tg_id_idx').on(t.tgId),
  createdIdx: index('users_created_at_idx').on(t.createdAt),
  lastSeenIdx: index('users_last_seen_idx').on(t.lastSeen),
}));

export const activity = table('activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  activityDate: text('activity_date').notNull(), // UTC YYYY-MM-DD
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({
  userDayIdx: index('activity_user_day_idx').on(t.userId, t.activityDate),
  dateIdx: index('activity_date_idx').on(t.activityDate),
}));

export const sessions = table('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  source: text('source').default('mini_app'),
}, (t) => ({ userIdx: index('sessions_user_idx').on(t.userId) }));

export const events = table('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  eventName: text('event_name').notNull(),
  payload: text('payload'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ eventIdx: index('events_name_idx').on(t.eventName) }));

export const payments = table('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  chargeId: text('charge_id').notNull().unique(),
  providerChargeId: text('provider_charge_id'),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull(),
  invoicePayload: text('invoice_payload'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ userIdx: index('payments_user_idx').on(t.userId) }));

export const scores = table('scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  score: integer('score').notNull().default(0),
  level: integer('level').default(1),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ userIdx: index('scores_user_idx').on(t.userId) }));

export const auditLogs = table('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  adminId: integer('admin_id').notNull(),
  action: text('action').notNull(),
  targetUserId: integer('target_user_id'),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
}, (t) => ({ createdIdx: index('audit_created_idx').on(t.createdAt) }));
