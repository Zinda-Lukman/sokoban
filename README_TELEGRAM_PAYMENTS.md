Telegram Payments integration (overview)
======================================

This repo includes a client-side stub to simulate purchases for development. For real payments, follow these steps:

1) Create a Telegram Bot via BotFather and enable payments.
2) Set up a server to create invoices using the `sendInvoice` method of the Bot API.
3) When the user pays, the bot will receive an `pre_checkout_query` and a `successful_payment` update.
4) On successful payment, your server should credit the user's `stars` in Supabase (or your DB), then notify the client.

Client-side options in this repo:
- `lib/sokoban.js` includes `initiateTelegramPurchase()` — a local simulation. Replace this with a call to your server which initiates the Telegram payment flow.

Testing without real money:
- Use the simulated flow in `initiateTelegramPurchase()` which prompts the user and grants stars locally.

Security notes:
- Never use the Supabase service role key in client-side code. Use server-side endpoints for payment verification and crediting.
