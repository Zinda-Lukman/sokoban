import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { users } from '../schema.js';

export default async function (_input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Telegram user is missing.');
  const user = await db.select().from(users).where(eq(users.tgId, Number(tgUser.id))).get();
  if (!user) throw new EndpointError('Please start the bot first.');
  if (user.isBanned) throw new EndpointError('This account is restricted.', { code: 'USER_BANNED' });
  return { ok: true, user: { id: user.tgId, firstName: user.firstName, username: user.username } };
}
