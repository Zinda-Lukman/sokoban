import { db, EndpointError } from 'sdk';
import { eq, and } from 'sdk/db';
import { users, events, activity } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');
  const user = await db.select().from(users).where(eq(users.tgId, Number(tgUser.id))).get();
  if (!user || user.isBanned) throw new EndpointError('Account is not allowed to use the app.');
  const eventName = String(input?.eventName || '').slice(0, 80);
  if (!/^[a-zA-Z0-9_.-]+$/.test(eventName)) throw new EndpointError('Invalid event name.');
  const today = new Date().toISOString().slice(0, 10);
  const todays = await db.select().from(activity)
    .where(and(eq(activity.userId, Number(tgUser.id)), eq(activity.activityDate, today))).get();
  if (!todays) {
    await db.insert(activity).values({ userId: Number(tgUser.id), activityDate: today }).run();
  }
  await db.insert(events).values({
    userId: Number(tgUser.id), eventName,
    payload: JSON.stringify(input?.payload ?? {}).slice(0, 2000),
  }).run();
  return { ok: true };
}
