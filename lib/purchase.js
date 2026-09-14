// ============================================================
  // Undo pool + Telegram Stars purchase flow
  // ============================================================
import {showToast} from "./sokoban.js"
  // ---- product catalog (what users can buy with Telegram Stars) ----
  // Prices are in XTR (Telegram Stars). The Stars go to the bot's
  // admin account automatically when the user pays.
  export const PRODUCTS = {
    undos10: {
      id:        "undos_10",
      title:     "10 Undos",
      undos:     10,
      stars:     5,            // price in Telegram Stars (XTR)
      payload:   "undos_10",
    },
  };

  export const PRODUCTSIDs = {
    solution : 26, skips: 27, restarts: 28, undos: 29
  };
  // ---- backend URL (your server that creates the invoice link) ----
  // Leave empty to run in DEMO MODE (purchases are simulated).
  // Set this to your real backend URL that returns a Telegram invoice
  // link (see README/backend.md for the API contract).
  const PURCHASE_API = "";    // e.g. "https://your-bot.example.com/api/invoice"

  // Force demo mode via ?demo=1 in the URL.
  const FORCE_DEMO = /[?&]demo=1\b/.test(location.search);


  
  // ---- telegram webapp helpers ----
  export function getTg()    { return (window.Telegram && window.Telegram.WebApp) || null; }

  // ---- mode detection ----
  function isDemoMode() {
    if (FORCE_DEMO) return true;
    if (!PURCHASE_API) return true;
    // If Telegram WebApp isn't available, fall back to demo so the UX
    // is still testable in a regular browser.
    if (!getTg()){ 
        
        return false
    };
    return false;
  }

  // ---- request an invoice URL from the backend ----
  // Real backend should respond: { invoiceUrl: "https://t.me/invoice/..." }
  // The backend is responsible for calling Telegram's createInvoiceLink
  // and signing the price. The Stars it collects go to the bot's
  // admin account.
  async function requestInvoiceUrl(product, userId, stars, quantity) {
    const res = await fetch(PURCHASE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId:    userId(),
        productId: PRODUCTSIDs[product],
        title:     product,
        quantity:  quantity,
        stars:     stars,
        payload:   `${product}_${quantity}`,
      }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    if (!data || !data.invoiceUrl) throw new Error("Missing invoiceUrl");
    return data.invoiceUrl;
  }

  // ---- open the Telegram invoice and wait for the result ----
  function openTelegramInvoice(url) {
    return new Promise((resolve) => {
      const tg = getTg();
      if (!tg || typeof tg.openInvoice !== "function") {
        // No Telegram WebApp — treat as cancelled.
        resolve("cancelled");
        return;
      }
      try {
        tg.openInvoice(url, (status) => resolve(status || "cancelled"));
      } catch (e) {
        resolve("failed");
      }
    });
  }

  // ---- buy handler (called when the user taps "Buy") ----
  export async function buyProduct(product, stars, userId, quantity, isDemo) {
    
    try {
      if (isDemoMode() || isDemo) {
        // Simulate a short "network" delay so the loading state is visible
        await new Promise((r) => setTimeout(r, 700));
        showToast("Purshase successful In Dem")
        return true;
      }
      const url = await requestInvoiceUrl(product, userId, stars, quantity);
      const status = await openTelegramInvoice(url);
      if (status === "paid") {
        return true
      } else if (status === "cancelled") {
        // user closed the invoice sheet — say nothing
        showToast("Payment Cancelled By You — please try again.");
        return false
      } else {
        showToast("Payment failed — please try again.");
        return false
      }
    } catch (e) {
      console.error("[purchase] failed", e);
      showToast("Purchase failed. Please try again later.");
      return false
    }
  }


  // ---- toast ----
 /**  let toastTimer = null;
  function showToast(message, iconHtml) {
    if (!toastEl) return;
    toastEl.innerHTML = (iconHtml || "") + "<span>" + message + "</span>";
    toastEl.hidden = false;
    toastEl.classList.remove("is-hiding");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.add("is-hiding");
      setTimeout(() => { toastEl.hidden = true; }, 250);
    }, 2400);
  }
**/


  // Update badge when the user comes back from another tab (e.g. after
  // completing a payment in the Telegram invoice sheet).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      //loadPersisted();
      //updateUndoBadge();
    }
  });
