# Telegram Mini App + Admin Bot (Telegram Serverless)

A plain-JavaScript starter for Telegram's hosted Serverless runtime. It includes a `/start` Mini App button, a private inline-button admin dashboard, basic usage analytics, Day-1/7/30 retention, user lookup and ban/unban, payment records (including Telegram Stars), moderation logs, score summaries, and Mini App endpoints.

## Included features

- `/start`: registers the Telegram user and sends a Web App button.
- `/admin`: opens the inline admin dashboard (configured admins only).
- `/stats`: sends the analytics summary.
- Admin dashboard: users, user profiles, ban/unban, DAU/WAU/MAU, new users, retention, payment history, moderation count, game score leaderboard, admin audit log.
- Successful Telegram `successful_payment` updates are saved once per Telegram charge ID.
- Mini App endpoints: `checkAccess`, `trackEvent`, `startSession`, `endSession`, `submitScore`.
- Endpoints use `ctx.initData.user`, which Telegram Serverless verifies before invoking the endpoint.

## Before you deploy

1. Install Node.js 18 or newer.
2. In **@BotFather → your bot → Serverless**, enable Serverless and obtain its **CLI access token**. This is not the normal Bot API token.
3. Edit `tgcloud/lib/config.js`:
   - Replace `123456789` in `ADMIN_IDS` with your numeric Telegram user ID(s).
   - Replace `https://YOUR-MINI-APP-URL` with the deployed Mini App URL.
4. Keep the URL as a valid HTTPS URL. The placeholder intentionally will not work.

## Install and link the project

From this folder:

```bash
npm install
npx tgcloud login
```

Paste the CLI access token when prompted. The CLI stores it in `.tgcloud/`; do not commit that folder or share its contents.

## Deploy

```bash
npm run check
npm test
npx tgcloud push
npx tgcloud migrate
```

Review the migration plan before confirming it. The platform deliberately separates code deployment (`push`) from database migration (`migrate`). After deployment, use the app URL printed by the CLI and set that URL in `MINI_APP_URL`, then push again if you changed the config.

## Test handlers on Telegram Serverless

The local checks in this ZIP do not replace the platform's own runtime test. After `login`, run:

```bash
npx tgcloud run handlers/message '{ chat: { id: 123456789 }, from: { id: 123456789, first_name: "Test" }, text: "/start" }'
npx tgcloud run handlers/callback_query '{ id: "test-callback", from: { id: 123456789 }, message: { chat: { id: 123456789 }, message_id: 1 }, data: "home" }'
npx tgcloud run endpoints/checkAccess '{}' --ctx '{ initData: { user: { id: 123456789, first_name: "Test" } } }'
```

The examples use a made-up test ID. Use a real admin ID for dashboard testing after deployment.

## Connect the Mini App

Include Telegram's Web App script in your Mini App, then call the endpoints like this:

```html
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<script>
  const tg = window.Telegram.WebApp;
  tg.ready();

  tg.Serverless.call('checkAccess', {}, (error, result) => {
    if (error) {
      console.error(error.message, error.parameters);
      return;
    }
    console.log('Access granted', result.user);
  });

  tg.Serverless.call('startSession', {}, (error, result) => {
    if (!error) window.currentSessionId = result.sessionId;
  });

  // Call when a meaningful event occurs, not on every frame/tick.
  tg.Serverless.call('trackEvent', {
    eventName: 'game_started',
    payload: { mode: 'classic' }
  }, (error) => {
    if (error) console.error(error.message);
  });

  // Call when the user leaves a session.
  function finishSession() {
    if (window.currentSessionId) {
      tg.Serverless.call('endSession', { sessionId: window.currentSessionId }, () => {});
    }
  }
</script>
```

`submitScore` accepts `{ score: integer, level: integer }`. The endpoint currently records submitted scores; it does not decide whether a score is legitimate. For a competitive game, validate scores server-side from trusted gameplay state rather than trusting a client-provided number.

## Payments

The bot records Telegram `successful_payment` updates. The dashboard reports the recorded amount and currency; `XTR` amounts are whole Telegram Stars. Other currencies are displayed as the raw Bot API minor-unit amount to avoid assuming every currency has two decimal places.

This project does **not** create invoices or grant in-game items. Keep your existing Stars invoice/pre-checkout/order fulfilment flow and add the fulfilment logic after validating `successful_payment`. Never grant an item solely because the Mini App says a payment succeeded.

## Important notes / limitations

- Retention is based on UTC calendar dates: a user is retained on Day N if an activity record exists exactly N calendar days after their signup date. Activity is recorded when they interact with the bot or call the Mini App tracking/session endpoints. It is not passive app-open telemetry.
- DAU/WAU/MAU are distinct users with recorded activity in the last 1/7/30 UTC dates.
- Analytics currently reads the relevant tables into memory. This is suitable as a starter for a small app; use SQL aggregates and bounded date queries as the dataset grows.
- The `submitScore` endpoint validates ranges but cannot prevent a modified client from submitting a fabricated score. Add server-authoritative validation for a production leaderboard.
- No mass-broadcast feature is included. Bulk messaging needs consent handling, rate limiting, resumable batches, and opt-out support.
- The hosted Telegram Serverless runtime, database migrations, real Bot API calls, and actual Telegram payment events cannot be exercised from an ordinary local Node process. Use `npx tgcloud run` and a test bot for those checks.
- This starter records payment data, but does not store card details or handle card processing.

## Files

```text
telegram-miniapp-admin-bot/
├── tgcloud/
│   ├── schema.js
│   ├── handlers/
│   │   ├── message.js
│   │   └── callback_query.js
│   ├── endpoints/
│   │   ├── checkAccess.js
│   │   ├── trackEvent.js
│   │   ├── startSession.js
│   │   ├── endSession.js
│   │   └── submitScore.js
│   └── lib/
│       ├── config.js
│       ├── users.js
│       ├── admin.js
│       ├── analytics.js
│       └── dashboard.js
├── scripts/check-project.mjs
├── tests/project.test.mjs
├── package.json
└── tgcloud.jsonc
```
