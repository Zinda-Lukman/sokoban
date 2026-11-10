import { db, EndpointError } from 'sdk';
import { desc } from 'sdk/db';
import { leaderboard } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');

  const limit = Math.max(1, Math.min(100, Number(input?.limit ?? 10) || 10));
  const rows = await db.select().from(leaderboard)
    .orderBy(desc(leaderboard.completedLevels), desc(leaderboard.updatedAt))
    .limit(limit)
    .all();

  return { rows: rows.map((row) => ({
    userId: row.userId,
    displayName: row.displayName,
    completedLevels: row.completedLevels,
    stars: row.stars,
    updatedAt: row.updatedAt,
  })) };
}
