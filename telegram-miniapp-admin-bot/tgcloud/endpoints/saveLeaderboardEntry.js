import { db, EndpointError } from 'sdk';
import { leaderboard } from '../schema.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');

  const row = input?.entry || input || {};
  const userId = String(row.userId || `tg_${tgUser.id}`);
  const displayName = String(row.displayName || tgUser.first_name || 'Player');
  const completedLevels = Number(row.completedLevels ?? row.completed_levels ?? 0);
  const stars = Number(row.stars ?? 0);

  await db.insert(leaderboard).values({
    userId,
    displayName,
    completedLevels: Number.isFinite(completedLevels) ? completedLevels : 0,
    stars: Number.isFinite(stars) ? stars : 0,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: leaderboard.userId,
    set: {
      displayName,
      completedLevels: Number.isFinite(completedLevels) ? completedLevels : 0,
      stars: Number.isFinite(stars) ? stars : 0,
      updatedAt: new Date(),
    },
  }).run();

  return { ok: true };
}
