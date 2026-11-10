import { db, EndpointError } from 'sdk';
import { users, scores } from '../schema.js';
import { eq } from 'sdk/db';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');
  const user = await db.select().from(users).where(eq(users.tgId, Number(tgUser.id))).get();
  if (!user || user.isBanned) throw new EndpointError('Account is not allowed to use the app.');
  const score = Number(input?.score);
  const level = Number(input?.level ?? 1);
  if (!Number.isSafeInteger(score) || score < 0 || score > 1000000000) throw new EndpointError('Invalid score.');
  if (!Number.isSafeInteger(level) || level < 1 || level > 10000) throw new EndpointError('Invalid level.');
  await db.insert(scores).values({ userId: Number(tgUser.id), score, level }).run();
  return { ok: true };
}
