import { api, EndpointError } from 'sdk';
import { notifyAdmins } from '../lib/admin.js';

export default async function (input, ctx) {
  const tgUser = ctx.initData?.user;
  if (!tgUser?.id) throw new EndpointError('Unauthorized.');

  const title = String(input?.title || 'Purchase');
  const quantity = Number(input?.quantity ?? 1) || 1;
  const amount = Number(input?.amount ?? input?.stars ?? 0) || 0;
  const payload = String(input?.payload || `${input?.productId || 'purchase'}_${Date.now()}`);
  const prices = Array.isArray(input?.prices) && input.prices.length ? input.prices : [{ label: title, amount }];

  try {
    const invoiceUrl = await api.createInvoiceLink({
      title,
      description: `Purchase ${quantity} ${title}`,
      payload,
      currency: String(input?.currency || 'XTR'),
      prices,
    });

    return { invoiceUrl };
  } catch (error) {
    await notifyAdmins([
      '⚠️ Invoice creation failed',
      `User: ${tgUser.id}`,
      `Title: ${title}`,
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    ].join('\n'));
    throw new EndpointError('Failed to create invoice link.', { code: 'INVOICE_CREATE_FAILED' });
  }
}
