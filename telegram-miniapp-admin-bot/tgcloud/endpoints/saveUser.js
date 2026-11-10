import { db, EndpointError } from 'sdk';
import { gameState } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');

  const userId = String(input?.userId || `tg_${tgUser.id}`);
  const payload = input?.data ?? {};
  const serialized = JSON.stringify(payload);

  await db.insert(gameState).values({
    userId,
    data: serialized,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: gameState.userId,
    set: { data: serialized, updatedAt: new Date() },
  }).run();

  return { ok: true };
}
