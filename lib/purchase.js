// ============================================================
  // Undo pool + Telegram Stars purchase flow
  // ============================================================
  function closeAllShopModals() {
    if (typeof document === 'undefined') return;

    ['undo-shop-modal', 'skip-shop-modal', 'restart-shop-modal'].forEach((id) => {
      const modal = document.getElementById(id);
      if (modal) {
        modal.hidden = true;
        modal.classList.remove('open');
      }
    });

    const anyShopOpen = ['undo-shop-modal', 'skip-shop-modal', 'restart-shop-modal']
      .some((id) => {
        const shopModal = document.getElementById(id);
        return shopModal && shopModal.hidden === false;
      });

    if (!anyShopOpen) {
      document.body.classList.remove('open');
      if (typeof lockScroll === 'function') {
        lockScroll(false);
      }
    }
  }

  function showToast(message, extend = false) {
    let toast = document.getElementById('alert-message');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'alert-message';
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.bottom = '92px';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'var(--wanted-dark)';
      toast.style.color = '#fff';
      toast.style.padding = '8px 12px';
      toast.style.borderRadius = '999px';
      toast.style.fontSize = '0.84rem';
      toast.style.fontWeight = '700';
      toast.style.zIndex = '2000';
      toast.style.boxShadow = '0 8px 24px rgba(2, 6, 23, 0.24)';
      document.body.appendChild(toast);
    }

    if (!toast._queue) {
      toast._queue = [];
      toast._isShowing = false;
    }

    toast._queue.push({ message, extend });

    if (toast._isShowing) {
      return;
    }

    const showNextToast = () => {
      const next = toast._queue.shift();
      if (!next) {
        toast._isShowing = false;
        toast.style.display = 'none';
        return;
      }

      toast._isShowing = true;
      const timeOut = next.extend ? 10000 : 1400;
      toast.textContent = next.message;
      toast.style.display = 'block';
      clearTimeout(toast._hideTimer);
      toast._hideTimer = setTimeout(() => {
        toast.style.display = 'none';
        showNextToast();
      }, timeOut);
    };

    showNextToast();
  }
  // ---- product catalog (what users can buy with Telegram Stars) ----
  // Prices are in XTR (Telegram Stars). The Stars go to the bot's
  // admin account automatically when the user pays.
  export const PRODUCTS = {
    solution: {
      id:      "solution",
      title:   "Solution",
      payload: "solution",
    },
    skips: {
      id:      "skips",
      title:   "Skips",
      payload: "skips",
    },
    restarts: {
      id:      "restarts",
      title:   "Restarts",
      payload: "restarts",
    },
    undos: {
      id:      "undos",
      title:   "Undos",
      payload: "undos",
    },
    undos10: {
      id:      "undos_10",
      title:   "10 Undos",
      undos:   10,
      payload: "undos_10",
    },
  };

  export const PRODUCTSIDs = {
    solution: 26,
    skips: 27,
    restarts: 28,
    undos: 29,
    undos10: 29,
  };

  export function normalizeProductKey(product) {
    const value = typeof product === 'string' ? product.trim().toLowerCase() : String(product ?? '').trim().toLowerCase();
    return value || null;
  }

  export function getProductMeta(product) {
    const key = normalizeProductKey(product);
    if (!key) return null;
    const exact = PRODUCTS[key] || null;
    if (exact) return exact;
    if (key === 'undos_10') return PRODUCTS.undos10 || null;
    return null;
  }
  // ---- backend URL (your server that creates the invoice link) ----
  // The client must never include BOT_TOKEN or other secrets. The server
  // (see /server/purchaseServer.js) will call Telegram's API and return
  // a signed invoice link. Default to the relative path so the same host
  // can serve the API during development.
  const PURCHASE_API = (() => {
    const baseUrl = (typeof window !== 'undefined' && window.APP_CONFIG && (window.APP_CONFIG.apiBaseUrl || window.APP_CONFIG.serverUrl)) || '';
    return baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}/api/invoice` : '/api/invoice';
  })();

  const PURCHASE_STATUS_API = (() => {
    const baseUrl = (typeof window !== 'undefined' && window.APP_CONFIG && (window.APP_CONFIG.apiBaseUrl || window.APP_CONFIG.serverUrl)) || '';
    return baseUrl ? `${String(baseUrl).replace(/\/+$/, '')}/api/purchase/status` : '/api/purchase/status';
  })();

  // Force demo mode via ?demo=1 in the URL.
  const FORCE_DEMO = typeof location !== 'undefined' && /[?&]demo=1\b/.test(location.search);


  
  // ---- telegram webapp helpers ----
  export function getTg() {
    return (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) || null;
  }

  // ---- mode detection ----
 export function isDemoMode(user_id) {
    if (FORCE_DEMO) return true;

    if (user_id == null) return true;

    // If Telegram WebApp isn't available, fall back to demo so the UX
    // is still testable in a regular browser.
    if (!getTg()) return true;

    if (typeof user_id === 'string' && user_id.startsWith('anon_')) {
      return true;
    }

    return false;
  }

  // ---- request an invoice URL from the backend ----
  // Real backend should respond: { invoiceUrl: "https://t.me/invoice/..." }
  // The backend is responsible for calling Telegram's createInvoiceLink
  // and signing the price. The Stars it collects go to the bot's
  // admin account.
  async function requestInvoiceUrl(product, userId, stars, quantity) {
    const safeWindow = typeof window !== 'undefined' ? window : null;
    const productKey = normalizeProductKey(product);
    const productId = productKey ? PRODUCTSIDs[productKey] : undefined;

    if (!productKey || productId == null) {
      throw new Error(`Unsupported product: ${String(product)}`);
    }

    // Allow userId to be a function (older code passes a function),
    // but also accept a direct value.
    const resolvedUserId = (typeof userId === 'function') ? userId() : userId;

    const body = {
      userId:    resolvedUserId,
      productId,
      title:     `${quantity} ${productKey}`,
      quantity:  quantity,
      stars:     stars,
      payload:   `${productKey}_${quantity}`,
      currency:  'XTR',
      prices:    [{ label: productKey, amount: stars }]
    };

    const headers = { 'Content-Type': 'application/json' };
    if (safeWindow && safeWindow.CLIENT_API_KEY) headers['X-API-Key'] = safeWindow.CLIENT_API_KEY;

    const res = await fetch(PURCHASE_API, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !data.invoiceUrl) throw new Error('Missing invoiceUrl');
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

  function reportPurchaseStatus(status, details = {}) {
    return new Promise((resolve) => {
      setTimeout(async () => {
        try {
          const safeWindow = typeof window !== 'undefined' ? window : null;
          const clientApiKey = safeWindow?.CLIENT_API_KEY || safeWindow?.APP_CONFIG?.clientApiKey || safeWindow?.__APP_CONFIG__?.clientApiKey;
          const headers = { 'Content-Type': 'application/json' };
          if (clientApiKey) headers['X-API-Key'] = clientApiKey;

          await fetch(PURCHASE_STATUS_API, {
            method: 'POST',
            headers,
            body: JSON.stringify({ status, ...details })
          });
          resolve(true);
        } catch (e) {
          console.warn('[purchase] failed to notify admin');
          resolve(false);
        }
      }, 2000);
    });
  }

  // ---- buy handler (called when the user taps "Buy") ----
  export async function buyProduct(product, stars, userId, quantity, isDemo=false) {
    const normalizedProduct = normalizeProductKey(product);
    const productId = normalizedProduct ? PRODUCTSIDs[normalizedProduct] : undefined;

    if (!normalizedProduct || productId == null) {
      console.warn('[purchase] unsupported product requested', product);
      showToast('Purchase failed. Unsupported product.', true);
      return false;
    }

    const numericStars = Number(stars);
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericStars) || numericStars <= 0 || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
      console.warn('[purchase] invalid purchase values', { product, stars, quantity });
      showToast('Purchase failed. Invalid purchase values.', true);
      return false;
    }

    try {
      if (isDemoMode(userId) || isDemo) {
        // Simulate a short "network" delay so the loading state is visible
        await new Promise((r) => setTimeout(r, 700));
        showToast("Purchase successful in demo mode.");
        closeAllShopModals();
        return true;
      }
      const url = await requestInvoiceUrl(normalizedProduct, userId, numericStars, numericQuantity);
      const status = await openTelegramInvoice(url);

      if (status === "paid" || status === "pending") {
        await reportPurchaseStatus('succeeded', {
          userId,
          product: normalizedProduct,
          quantity: numericQuantity,
          stars: numericStars,
          productId,
          title: normalizedProduct,
        });
        closeAllShopModals();
        return true;
      } else if (status === "cancelled") {
        await reportPurchaseStatus('cancelled', {
          userId,
          product: normalizedProduct,
          quantity: numericQuantity,
          stars: numericStars,
          productId,
          title: normalizedProduct,
          errorMessage: 'User cancelled the invoice payment.',
        });
        closeAllShopModals();
        // user closed the invoice sheet — say nothing
        showToast(`${normalizedProduct} purchase payment cancelled by you — please try again.`, true);
        return false;
      } else {
        await reportPurchaseStatus('failed', {
          userId,
          product: normalizedProduct,
          quantity: numericQuantity,
          stars: numericStars,
          productId,
          title: normalizedProduct,
          errorMessage: 'Invoice flow ended in failure state.',
        });
        showToast(`${normalizedProduct} purchase payment failed — please try again.`, true);
        return false;
      }
    } catch (e) {
      const errorText = e && (e.message || String(e));
      await reportPurchaseStatus('failed', {
        userId,
        product: normalizedProduct,
        quantity: numericQuantity,
        stars: numericStars,
        productId,
        title: normalizedProduct,
        errorMessage: errorText,
      });
      console.warn("[purchase] failed", e);
      showToast("Purchase failed. Please try again later.", true);
      return false;
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
  if (typeof document !== 'undefined') {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        //loadPersisted();
        //updateUndoBadge();
      }
    });
  }
