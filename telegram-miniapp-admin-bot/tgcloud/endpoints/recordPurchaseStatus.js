import { db, EndpointError } from 'sdk';
import { payments } from '../schema.js';
import { notifyAdmins } from '../lib/admin.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');

  const status = String(input?.status || 'unknown').toLowerCase();
  const payload = input?.payload || input?.productId || 'unknown';
  const userId = input?.userId ?? tgUser.id;
  const product = input?.title || input?.product || 'unknown';
  const quantity = Number(input?.quantity ?? 1) || 1;
  const stars = Number(input?.stars ?? input?.amount ?? 0) || 0;

  if (status === 'succeeded') {
    const chargeId = String(payload || `tg-${Date.now()}`);
    await db.insert(payments).values({
      userId: Number(userId),
      chargeId,
      providerChargeId: null,
      amount: stars,
      currency: 'XTR',
      invoicePayload: String(payload),
    }).onConflictDoUpdate({
      target: payments.chargeId,
      set: { amount: stars, currency: 'XTR', invoicePayload: String(payload) },
    }).run();
  }

  await notifyAdmins([
    '💳 Purchase update',
    `Status: ${status}`,
    `User: ${userId}`,
    `Product: ${product}`,
    `Quantity: ${quantity}`,
    `Stars: ${stars}`,
    `Payload: ${payload}`,
    input?.errorMessage ? `Error: ${String(input.errorMessage)}` : '',
  ].filter(Boolean).join('\n'));

  return { ok: true, status };
}
