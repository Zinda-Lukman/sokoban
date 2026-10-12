Yes. For a **Telegram Mini App game**, I’d structure it like this:

```text
┌────────────────────┐
│ Telegram Mini App  │
│                    │
│ User clicks        │
│ "Buy 100 Coins"    │
└─────────┬──────────┘
          │ POST /create-invoice
          ▼
┌────────────────────┐
│ Your Node.js       │
│ bot/backend        │
│                    │
│ Creates Stars      │
│ invoice             │
└─────────┬──────────┘
          │ invoice URL
          ▼
┌────────────────────┐
│ Telegram Stars     │
│ payment screen     │
└─────────┬──────────┘
          │
          ▼
     User pays
          │
          ▼
┌────────────────────┐
│ Your Bot           │
│                    │
│ pre_checkout       │
│       ↓            │
│ successful_payment │
└─────────┬──────────┘
          │
          │ securely record purchase
          ▼
┌────────────────────┐
│ Your Database      │
│                    │
│ +100 coins         │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Mini App            │
│ refreshes balance   │
└────────────────────┘
```

## 1. Mini App frontend

For example, your game has:

```html
<button id="buyCoins">Buy 100 Coins — ⭐50</button>

<script src="https://telegram.org/js/telegram-web-app.js"></script>

<script>
const tg = window.Telegram.WebApp;

tg.ready();
tg.expand();

document.getElementById("buyCoins").onclick = async () => {

    const response = await fetch("/api/create-invoice", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            product: "coins_100"
        })
    });

    const data = await response.json();

    if (!data.ok) {
        alert("Could not create payment");
        return;
    }

    // Open Telegram's payment interface
    tg.openInvoice(data.invoice_url, (status) => {

        console.log("Telegram payment status:", status);

        if (status === "paid") {
            // Don't blindly add coins here.
            // Ask your backend for the confirmed balance.
            refreshBalance();
        }
    });
};

async function refreshBalance() {

    const response = await fetch("/api/balance");
    const data = await response.json();

    document.getElementById("balance").textContent =
        data.coins;
}
</script>
```

The important security principle is:

**The frontend never decides that the user has paid.**

It only asks your backend to create the invoice and later asks for the confirmed balance.

---

# 2. Node.js backend

Here's a minimal plain Node.js server using the built-in `http` module.

```js
const http = require("http");

const BOT_TOKEN = process.env.BOT_TOKEN;

const PRODUCTS = {
    coins_100: {
        title: "100 Game Coins",
        description: "100 coins for your game",
        stars: 50,
        coins: 100
    },

    coins_500: {
        title: "500 Game Coins",
        description: "500 coins for your game",
        stars: 200,
        coins: 500
    }
};
```

### Create the invoice

```js
async function createInvoice(userId, productId) {

    const product = PRODUCTS[productId];

    if (!product) {
        throw new Error("Invalid product");
    }

    const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                title: product.title,
                description: product.description,

                // This identifies what was purchased.
                payload: JSON.stringify({
                    userId,
                    productId
                }),

                currency: "XTR",

                prices: [
                    {
                        label: product.title,
                        amount: product.stars
                    }
                ]
            })
        }
    );

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.description);
    }

    return data.result;
}
```

Then your `/api/create-invoice` endpoint calls it.

---

# 3. Very important: authenticate the Mini App

Don't trust:

```js
{
    userId: 123456789
}
```

sent by the browser.

A malicious player could simply change it to somebody else's ID.

Telegram gives your Mini App an `initData` value that your server can validate.

Frontend:

```js
const initData = Telegram.WebApp.initData;

const response = await fetch("/api/create-invoice", {
    method: "POST",

    headers: {
        "Content-Type": "application/json"
    },

    body: JSON.stringify({
        initData: initData,
        product: "coins_100"
    })
});
```

Your server verifies `initData` and obtains the actual Telegram user ID.

This is **especially important for a game where coins have value**.

---

# 4. Telegram sends the payment confirmation to your bot

Your bot receives:

```js
update.pre_checkout_query
```

You must answer it:

```js
async function answerPreCheckout(queryId) {

    const response = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                pre_checkout_query_id: queryId,
                ok: true
            })
        }
    );

    return response.json();
}
```

Then, after Telegram completes the payment:

```js
update.message.successful_payment
```

will contain the successful payment.

---

# 5. Give the coins ONLY after successful payment

```js
async function processSuccessfulPayment(update) {

    const payment = update.message.successful_payment;

    const telegramUserId = update.message.from.id;

    const payload =
        JSON.parse(payment.invoice_payload);

    const product =
        PRODUCTS[payload.productId];

    if (!product) {
        console.error("Unknown product!");
        return;
    }

    console.log("Payment confirmed");

    console.log({
        user: telegramUserId,
        product: payload.productId,
        stars: payment.total_amount,
        chargeId: payment.telegram_payment_charge_id
    });

    // IMPORTANT:
    // Save the transaction and add coins atomically
    // in your real database.

    await giveCoins(
        telegramUserId,
        product.coins
    );
}
```

---

# 6. Prevent double-crediting

This is **extremely important**.

Suppose Telegram sends the successful payment update twice.

Without protection:

```text
Payment = 50 Stars

First update → +100 coins
Second update → +100 coins

Player gets 200 coins for one payment.
```

Store:

```text
telegram_payment_charge_id
```

in your database.

Before crediting:

```js
if (await transactionExists(payment.telegram_payment_charge_id)) {
    return;
}
```

Then:

```js
await database.transaction(async () => {

    await saveTransaction({
        chargeId: payment.telegram_payment_charge_id,
        userId: telegramUserId,
        product: payload.productId,
        stars: payment.total_amount
    });

    await addCoins(
        telegramUserId,
        product.coins
    );
});
```

Your database should enforce a **UNIQUE constraint on `telegram_payment_charge_id`** as an additional safeguard.

---

# 7. Tell the Mini App the purchase succeeded

You don't actually need to send the "success" message from the bot to the Mini App.

The Mini App can simply ask your server:

```js
async function refreshBalance() {

    const response =
        await fetch("/api/balance");

    const data =
        await response.json();

    document.getElementById("balance").textContent =
        data.coins;
}
```

So the authoritative flow is:

```text
Telegram payment
       ↓
successful_payment
       ↓
Backend verifies/records payment
       ↓
Database +100 coins
       ↓
Mini App asks backend for balance
       ↓
Backend returns 100 additional coins
```

This is much safer than:

```text
Telegram says "paid"
       ↓
JavaScript immediately gives coins
```

because the browser is not trusted.

---

## One more thing for your game

For your Telegram game, I'd actually make the architecture:

```text
                TELEGRAM
                    │
              Stars payment
                    │
                    ▼
┌─────────────── YOUR SERVER ───────────────┐
│                                           │
│  Mini App ──► authenticated API            │
│                  │                        │
│                  ▼                        │
│             Game database                 │
│                  ▲                        │
│                  │                        │
│          Telegram Bot API                 │
│                  │                        │
│          successful_payment              │
│                  │                        │
│                  ▼                        │
│             +100 coins                    │
│                                           │
└───────────────────────────────────────────┘
```

**Never put `BOT_TOKEN` in your Mini App JavaScript.** It belongs exclusively on the server.

[Telegram Mini Apps documentation](https://core.telegram.org/bots/webapps?utm_source=chatgpt.com)
[Telegram Stars payment documentation](https://core.telegram.org/bots/payments-stars?utm_source=chatgpt.com)
[Telegram Bot API](https://core.telegram.org/bots/api?utm_source=chatgpt.com)

If you want, I can also give you a **single working `server.js` + `index.html` example using plain JavaScript, including Telegram `initData` validation, Stars payments, a coin balance, and a simple in-memory/database-style purchase ledger** that you can adapt directly to your game.
