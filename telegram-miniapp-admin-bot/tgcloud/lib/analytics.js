import { db } from 'sdk';
import { users, activity, sessions, payments, scores } from '../schema.js';

const dayMs = 86400000;
const dateAt = (daysAgo) => new Date(Date.now() - daysAgo * dayMs).toISOString().slice(0, 10);
const startAt = (daysAgo) => new Date(Date.now() - daysAgo * dayMs);
const utcTodayStart = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
const addUtcDays = (date, days) => { const d = new Date(date); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

export async function getAnalytics() {
  const [allUsers, allActivity, allSessions, allPayments, allScores] = await Promise.all([
    db.select().from(users).all(),
    db.select().from(activity).all(),
    db.select().from(sessions).all(),
    db.select().from(payments).all(),
    db.select().from(scores).all(),
  ]);
  const active = (days) => new Set(allActivity.filter((x) => x.activityDate >= dateAt(days - 1)).map((x) => x.userId)).size;
  const revenue = {};
  for (const p of allPayments) revenue[p.currency] = (revenue[p.currency] ?? 0) + p.amount;
  return {
    totalUsers: allUsers.length,
    bannedUsers: allUsers.filter((u) => u.isBanned).length,
    newToday: allUsers.filter((u) => u.createdAt >= utcTodayStart()).length,
    new7d: allUsers.filter((u) => u.createdAt >= startAt(7)).length,
    dau: active(1), wau: active(7), mau: active(30),
    sessionsToday: allSessions.filter((s) => s.startedAt >= utcTodayStart()).length,
    paymentCount: allPayments.length,
    revenue,
    scoreCount: allScores.length,
  };
}

export async function getRetention() {
  const [allUsers, allActivity] = await Promise.all([
    db.select().from(users).all(),
    db.select().from(activity).all(),
  ]);
  const activePairs = new Set(allActivity.map((a) => `${a.userId}:${a.activityDate}`));
  return [1, 7, 30].map((n) => {
    const eligible = allUsers.filter((u) => u.createdAt && addUtcDays(u.createdAt, n) <= dateAt(0));
    const returned = eligible.filter((u) => activePairs.has(`${u.tgId}:${addUtcDays(u.createdAt, n)}`)).length;
    return { day: n, cohort: eligible.length, returned, rate: eligible.length ? Math.round(returned / eligible.length * 100) : 0 };
  });
}

export async function getRevenueByCurrency() {
  const rows = await db.select().from(payments).all();
  return rows.reduce((out, row) => {
    out[row.currency] = (out[row.currency] ?? 0) + row.amount;
    return out;
  }, {});
}
