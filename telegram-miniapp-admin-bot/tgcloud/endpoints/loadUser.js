import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { gameState } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');

  const userId = String(input?.userId || `tg_${tgUser.id}`);
  const row = await db.select().from(gameState).where(eq(gameState.userId, userId)).get();

  if (!row || row.data == null) {
    return { data: null };
  }

  try {
    return { data: JSON.parse(row.data) };
  } catch (error) {
    console.warn('Failed to parse game state JSON for user', userId, error);
    return { data: null };
  }
}
