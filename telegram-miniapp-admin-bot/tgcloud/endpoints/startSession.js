import { db, EndpointError } from 'sdk';
import { eq, and } from 'sdk/db';
import { users, sessions, activity } from '../schema.js';

export default async function (_input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');
  const user = await db.select().from(users).where(eq(users.tgId, Number(tgUser.id))).get();
  if (!user || user.isBanned) throw new EndpointError('Account is not allowed to use the app.');
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(activity)
    .where(and(eq(activity.userId, Number(tgUser.id)), eq(activity.activityDate, today))).get();
  if (!rows) {
    await db.insert(activity).values({ userId: Number(tgUser.id), activityDate: today }).run();
  }
  const [session] = await db.insert(sessions).values({ userId: Number(tgUser.id), source: 'mini_app' }).returning().run();
  return { sessionId: session?.id ?? null };
}
