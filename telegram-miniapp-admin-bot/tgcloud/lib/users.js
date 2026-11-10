import { db } from 'sdk';
import { eq, and } from 'sdk/db';
import { users, activity } from '../schema.js';

export function utcDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export async function touchUser(from) {
  const tgId = Number(from.id);
  const values = {
    tgId,
    firstName: from.first_name ?? '',
    lastName: from.last_name ?? null,
    username: from.username ?? null,
    languageCode: from.language_code ?? null,
    lastSeen: new Date(),
  };
  await db.insert(users).values(values).onConflictDoUpdate({
    target: users.tgId,
    set: {
      firstName: values.firstName,
      lastName: values.lastName,
      username: values.username,
      languageCode: values.languageCode,
      lastSeen: values.lastSeen,
    },
  }).run();
  const today = utcDate();
  const existingActivity = await db.select().from(activity)
    .where(and(eq(activity.userId, tgId), eq(activity.activityDate, today))).get();
  if (!existingActivity) {
    await db.insert(activity).values({ userId: tgId, activityDate: today }).run();
  }
  return await db.select().from(users).where(eq(users.tgId, tgId)).get();
}

export async function getUser(tgId) {
  return await db.select().from(users).where(eq(users.tgId, Number(tgId))).get();
}
