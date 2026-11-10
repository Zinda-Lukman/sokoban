import { db, EndpointError } from 'sdk';
import { eq, and } from 'sdk/db';
import { users, sessions } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');
  const user = await db.select().from(users).where(eq(users.tgId, Number(tgUser.id))).get();
  if (!user || user.isBanned) throw new EndpointError('Account is not allowed to use the app.');
  const sessionId = Number(input?.sessionId);
  if (!Number.isSafeInteger(sessionId) || sessionId <= 0) throw new EndpointError('Invalid session.');
  await db.update(sessions).set({ endedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, Number(tgUser.id)))).run();
  return { ok: true };
}
