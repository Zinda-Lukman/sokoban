import Board from "./board.js";
import LEVELS from "./levels.js";
import * as Storage from "./storage.js";
import { createMobileControls } from "./controls.js";
import { getTg, buyProduct } from "./purchase.js";

class Sokoban {

  constructor(level = 0) {
    this.level = level;
    this.textGrid = LEVELS[this.level];
    this.rows = this.textGrid.length;
    this.cols = Math.max(...this.textGrid.map(row => row.length));

    const canvas = document.getElementById("canvas");
    if (canvas) {
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      canvas.style.maxWidth = '100%';
      canvas.style.maxHeight = '100%';
    }

    const tileSize = this.getTileSize(this.cols, this.rows);
    this.setCanvasSize(tileSize);
    this.board = new Board(this.textGrid, { tileSize });
  }

  setCanvasSize(tileSize) {
    const canvas = document.getElementById("canvas");
    if (!canvas) return;
    canvas.width = this.cols * tileSize;
    canvas.height = this.rows * tileSize;
  }

  applyCanvasStyles(tileSize) {
    const canvas = document.getElementById("canvas");
    if (!canvas) return;

    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.display = 'block';
    canvas.style.margin = '0 auto';
    canvas.style.objectFit = 'contain';
    canvas.style.aspectRatio = `${this.cols} / ${this.rows}`;
  }

  resizeBoard() {
    const tileSize = this.getTileSize(this.cols, this.rows);
    this.setCanvasSize(tileSize);
    this.applyCanvasStyles(tileSize);
    if (this.board?.resize) {
      this.board.resize(tileSize);
    }
  }

  getTileSize(cols, rows) {
    const gameArea = document.querySelector('.game-area');
    const header = document.querySelector('.modern-header');
    const bottomNav = document.querySelector('.mobile-bottom-nav');
    const controls = document.querySelector('.game-controls');
    const canvas = document.getElementById("canvas");

    const rect = gameArea?.getBoundingClientRect();
    const headerHeight = header?.getBoundingClientRect().height || 0;
    const bottomNavHeight = bottomNav?.getBoundingClientRect().height || 0;
    const controlsHeight = controls?.getBoundingClientRect().height || 0;
    const screenPadding = 48;
    /** 
    const availableWidth = Math.max(1, (rect?.width || window.innerWidth) - 24);
    const availableHeight = Math.max(1, window.innerHeight - headerHeight - bottomNavHeight - controlsHeight - screenPadding);
    */
   const dpr = window.devicePixelRatio || 1;
    const W = canvas.width / dpr, H = canvas.height / dpr;

    
    const tileWidth = W / cols;
    const tileHeight = H / rows;

    return Math.max(25, Math.floor(Math.min(tileWidth, tileHeight)));
  }
}

export function showToast(message) {
    let toast = document.getElementById('alert-message');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'alert-message';
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.bottom = '92px';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'rgba(2, 6, 23, 0.95)';
      toast.style.color = '#fff';
      toast.style.padding = '8px 12px';
      toast.style.borderRadius = '999px';
      toast.style.fontSize = '0.84rem';
      toast.style.fontWeight = '700';
      toast.style.zIndex = '2000';
      toast.style.boxShadow = '0 8px 24px rgba(2, 6, 23, 0.24)';
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 1400);
  }

document.addEventListener("DOMContentLoaded", async () => {
  let sokoban = new Sokoban();
  let board = sokoban.board;

  function resizeGameView() {
    requestAnimationFrame(() => {
      sokoban?.resizeBoard();
    });
  }

  function fitCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const canvas = document.getElementById("canvas");
    const rect = canvas.getBoundingClientRect();
    const size = Math.max(64, Math.floor(Math.min(rect.width, rect.height)));
    canvas.width  = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width  = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function scheduleBoardResize() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        sokoban?.resizeBoard();
      });
    });
  }

  const gameArea = document.querySelector('.game-area');
  if (gameArea && 'ResizeObserver' in window) {
    const gameAreaObserver = new ResizeObserver(() => {
      if (document.getElementById('game-screen')?.style.display !== 'none') {
        resizeGameView();
      }
    });
    gameAreaObserver.observe(gameArea);
  }

  window.addEventListener('resize', fitCanvas);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      resizeGameView();
    }
  });

  // User identification (Telegram WebApp user if available)
  const tgUser = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  let userId = null;
  if (tgUser) {
    userId = `tg_${tgUser}`;
  } else {
    userId = localStorage.getItem('sokoban_user_id');
    if (!userId) {
      userId = `anon_${Date.now()}`;
      localStorage.setItem('sokoban_user_id', userId);
    }
  }

  // Load user data (storage module will fallback to localStorage)
  //@app-will-change stars and username retrieval areas
  const userData = (await Storage.loadUser(userId)) || {};
  let undos = (typeof userData.undos === 'number') ? userData.undos : 30;
  const MAX_UNDOS = 30;
  const REFILL_MINUTES = 10; // refill interval in minutes per undo
  const INITIAL_FREE_SKIPS = 3;
  let lastRefill = userData.lastRefill || Date.now();
  let settings = userData.settings || { controlMode: "buttons" };
  let stars = userData.stars || 0;
  let referralCode = userData.referralCode || userId;
  let referralSource = null;
  let completedLevels = Array.isArray(userData.completedLevels) ? userData.completedLevels : (JSON.parse(localStorage.getItem('sokoban_completed_levels')) || []);
  let skippedLevels = Array.isArray(userData.skippedLevels) ? userData.skippedLevels : (JSON.parse(localStorage.getItem('sokoban_skipped_levels')) || []);
  let skipsAvailable = (typeof userData.skipsAvailable === 'number') ? userData.skipsAvailable : INITIAL_FREE_SKIPS;
  const INITIAL_FREE_RESTARTS = 3;
  // Restarts: new users get 3 restarts, refilled up to max every 24 hours
  let restartsAvailable = (typeof userData.restartsAvailable === 'number') ? userData.restartsAvailable : INITIAL_FREE_RESTARTS;
  let lastRestartRefill = userData.lastRestartRefill || Date.now();
  let activeScreen = 'initial-navigation';
  let activeModal = null;
  let lastTrigger = null;

  const storedLastLevel = Number(localStorage.getItem('sokoban_last_level') || localStorage.getItem(`sokoban_last_level_${userId}`) || '0');
  const initialLevel = Number.isFinite(storedLastLevel) ? storedLastLevel : 0;

  async function persistUser() {
    const payload = {
      undos,
      lastRefill,
      restartsAvailable,
      lastRestartRefill,
      stars,
      completedLevels,
      skippedLevels,
      skipsAvailable,
      lastLevel: sokoban?.level ?? 0,
      referralCode,
      referralSource,
      displayName: userData.displayName || 'Player',
      settings
    };
    localStorage.setItem('sokoban_completed_levels', JSON.stringify(completedLevels));
    localStorage.setItem('sokoban_skipped_levels', JSON.stringify(skippedLevels));
    localStorage.setItem('sokoban_last_level', String(payload.lastLevel));
    localStorage.setItem(`sokoban_last_level_${userId}`, String(payload.lastLevel));
    await Storage.saveUser(userId, payload);
  }

  function refreshUndosUI() {
    $('#header-undos').text(undos);
    $('#header-stars').text(stars);
    $('#header-restarts').text(restartsAvailable);
    $('#header-steps').text(skipsAvailable);

    const menuUndoBtn = document.getElementById('header-undo-btn');
    const legacyUndoBtn = document.getElementById('undo-btn');
    const isOutOfUndos = undos <= 0;
    [menuUndoBtn, legacyUndoBtn].filter(Boolean).forEach((btn) => {
      const label = isOutOfUndos ? 'BUY UNDOS' : 'Undo';
      btn.disabled = false;
      btn.classList.toggle('is-disabled', false);
      btn.classList.toggle('buy-undos-mode', isOutOfUndos);
      try{ btn.setAttribute('aria-label', label); btn.dataset.tooltip = label; }catch(e){}
    });

    const buyBtn = document.getElementById('header-buy-undos-btn');
    if (buyBtn) {
      buyBtn.disabled = false;
    }
  }

  // Restart UI & refill helpers
  function formatMsLong(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600).toString().padStart(2, '0');
    const m = Math.floor((total % 3600) / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  function refillRestartsIfNeeded() {
    const now = Date.now();
    const per = 24 * 60 * 60 * 1000; // 24 hours
    const prevRestarts = restartsAvailable;
    const prevLast = lastRestartRefill;

    if (restartsAvailable >= INITIAL_FREE_RESTARTS) {
      lastRestartRefill = Math.max(lastRestartRefill, now);
    } else {
      const elapsed = now - lastRestartRefill;
      const increments = Math.floor(elapsed / per);
      if (increments > 0) {
        restartsAvailable = Math.min(INITIAL_FREE_RESTARTS, restartsAvailable + increments);
        lastRestartRefill += increments * per;
      }
    }

    if (restartsAvailable !== prevRestarts || lastRestartRefill !== prevLast) {
      refreshUndosUI();
      updateRestartTimerUI();
      persistUser();
      return true;
    }

    if (restartsAvailable < INITIAL_FREE_RESTARTS) updateRestartTimerUI();
    return false;
  }

  function updateRestartTimerUI() {
    const elText = document.getElementById('restart-timer');
    const elFill = document.getElementById('restart-progress-fill');
    const elInfo = document.getElementById('restart-progress-text');

    const modalTimer = document.getElementById('restart-modal-timer');
    const modalFill = document.getElementById('restart-modal-progress-fill');
    const modalInfo = document.getElementById('restart-modal-progress-text');
    const headerRestarts = document.getElementById('header-restarts');

    // compute values
    const per = 24 * 60 * 60 * 1000;
    let textContent, fillWidth, infoText;
    if (restartsAvailable >= INITIAL_FREE_RESTARTS) {
      textContent = '--:--:--';
      infoText = `${restartsAvailable}/${INITIAL_FREE_RESTARTS}`;
      fillWidth = '100%';
    } else {
      const next = lastRestartRefill + per;
      const remaining = next - Date.now();
      textContent = remaining <= 0 ? '00:00:00' : formatMsLong(remaining);
      const fillPercent = Math.round((restartsAvailable / INITIAL_FREE_RESTARTS) * 100);
      fillWidth = `${fillPercent}%`;
      infoText = `${restartsAvailable}/${INITIAL_FREE_RESTARTS}`;
    }

    // update header elements if present
    if (elText) elText.textContent = textContent;
    if (elInfo) elInfo.textContent = infoText;
    if (elFill) elFill.style.width = fillWidth;

    const restartBtn = document.getElementById('header-restart-btn');
    if (restartBtn) {
      restartBtn.disabled = false;
      restartBtn.classList.toggle('buy-restarts-mode', restartsAvailable <= 0);
      const label = restartsAvailable <= 0 ? 'BUY RESTARTS' : 'Restart';
      restartBtn.setAttribute('aria-label', label);
      restartBtn.dataset.tooltip = label;
    }

    // update modal elements if present
    if (modalTimer) modalTimer.textContent = textContent;
    if (modalFill) modalFill.style.width = fillWidth;
    if (modalInfo) modalInfo.textContent = infoText;
    if (headerRestarts) headerRestarts.textContent = String(restartsAvailable);
  }

  // Preview restart modal helper (dev button)
  const previewRestartBtn = document.getElementById('preview-restart-modal-btn');
  if (previewRestartBtn) {
    previewRestartBtn.addEventListener('click', () => {
      openRestartShop();
      updateRestartTimerUI();
    });
  }

  function refillUndosIfNeeded() {
    const now = Date.now();
    const per = REFILL_MINUTES * 60 * 1000;
    const previousUndos = undos;
    const previousLastRefill = lastRefill;

    if (undos >= MAX_UNDOS) {
      lastRefill = Math.max(lastRefill, now);
    } else {
      const elapsed = now - lastRefill;
      const increments = Math.floor(elapsed / per);
      if (increments > 0) {
        undos = Math.min(MAX_UNDOS, undos + increments);
        lastRefill += increments * per;
      }
    }

    if (undos !== previousUndos || lastRefill !== previousLastRefill) {
      refreshUndosUI();
      updateUndoTimerUI();
      persistUser();
      return true;
    }

    if (undos < MAX_UNDOS) {
      updateUndoTimerUI();
    }

    return false;
  }

  function applyRefill() {
    refillUndosIfNeeded();
  }

  applyRefill();

  const refillTimer = setInterval(() => {
    refillUndosIfNeeded();
    refillRestartsIfNeeded();
  }, 1000);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refillUndosIfNeeded();
    }
  });

  refreshUndosUI();
  await persistUser();

  function formatMs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateUndoTimerUI() {
    if (undos >= MAX_UNDOS) {
      $('#undo-timer').text('--:--');
      $('#header-undo-progress-text').text(`Full (${undos}/${MAX_UNDOS})`);
      $('#header-undo-progress-fill').css('width', '100%');
      return;
    }
    const per = REFILL_MINUTES * 60 * 1000;
    const next = lastRefill + per;
    const remaining = next - Date.now();
    if (remaining <= 0) {
      $('#undo-timer').text('00:00');
    } else {
      $('#undo-timer').text(formatMs(remaining));
    }

    const fillPercent = Math.min(100, Math.round((undos / MAX_UNDOS) * 100));
    $('#header-undo-progress-fill').css('width', `${fillPercent}%`);
    $('#header-undo-progress-text').text(`${undos}/${MAX_UNDOS}`);

    const undoBtn = document.getElementById('header-undo-btn');
    if (undoBtn) {
      undoBtn.disabled = false;
      undoBtn.classList.toggle('buy-undos-mode', undos <= 0);
      const label = undos <= 0 ? 'BUY UNDOS' : 'Undo';
      undoBtn.setAttribute('aria-label', label);
      undoBtn.dataset.tooltip = label;
    }
  }

  function updateUndoProgressUI() {
    updateUndoTimerUI();
  }

  updateUndoTimerUI();
  updateUndoProgressUI();

  // Setup tooltip behavior for icon buttons (hover + long-press on touch)
  function setupTooltips() {
    const ids = ['header-undo-btn','skip-level-btn','restart-level-btn','solution-btn','header-restart-btn'];
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (!btn || !btn.dataset) return;
      // ensure tooltip text exists
      if (!btn.dataset.tooltip) {
        const lbl = btn.getAttribute('aria-label') || btn.textContent || '';
        btn.dataset.tooltip = lbl.trim();
      }
      let timer = null;
      const show = () => { btn.classList.add('show-tooltip'); };
      const hide = () => { btn.classList.remove('show-tooltip'); if (timer) { clearTimeout(timer); timer = null; } };
      btn.addEventListener('touchstart', (e) => { timer = setTimeout(show, 600); }, { passive: true });
      btn.addEventListener('touchend', hide, { passive: true });
      btn.addEventListener('touchcancel', hide, { passive: true });
      btn.addEventListener('touchmove', hide, { passive: true });
      btn.addEventListener('mouseleave', hide);
    });
  }

  setupTooltips();

  async function updateLeaderboard() {
    const rows = await Storage.getLeaderboard(10);
    const list = document.getElementById('achievement-list');
    if (list) {
      const existing = list.innerHTML;
      if (rows.length) {
        list.innerHTML = '<div class="achievement unlocked"><div class="achievement-title">🏅 Leaderboard</div><div class="achievement-desc">Top players by completed levels</div></div>' + rows.map((row, idx) => `<div class="achievement"><div class="achievement-title">#${idx + 1} ${row.displayName || 'Player'}</div><div class="achievement-desc">${row.completedLevels || 0} levels completed</div></div>`).join('');
      }
    }
  }

  async function handleReferralFlow() {
    const params = new URLSearchParams(window.location.search);
    const referralParam = params.get('start') || params.get('ref') || '';
    if (!referralParam || referralParam === userId) return;
    referralSource = referralParam;
    const referralKey = `sokoban_referral_${referralParam}`;
    const existing = JSON.parse(localStorage.getItem(referralKey) || '{}');
    if (!existing.referredUsers || !existing.referredUsers.includes(userId)) {
      existing.referredUsers = [...(existing.referredUsers || []), userId];
      existing.count = (existing.count || 0) + 1;
      localStorage.setItem(referralKey, JSON.stringify(existing));
      const referrerData = (await Storage.loadUser(referralParam)) || {};
      referrerData.undos = Math.min(MAX_UNDOS, (referrerData.undos || 30) + 5);
      referrerData.stars = (referrerData.stars || 0) + 3;
      await Storage.saveUser(referralParam, referrerData);
      undos = Math.min(MAX_UNDOS, undos + 3);
      stars += 1;
      await persistUser();
      refreshUndosUI();
      showToast('Referral reward applied. You earned 3 undos and 1 star.');
    }
  }

  await handleReferralFlow();

  async function updateLeaderboard() {
    const rows = await Storage.getLeaderboard(10);
    const list = document.getElementById('leaderboard-list');
    if (!list) return;
    list.innerHTML = '';
    if (!rows.length) {
      list.innerHTML = '<div class="leaderboard-row"><span>No leaderboard entries yet.</span></div>';
      return;
    }
    list.innerHTML = '<div class="leaderboard-row"><strong>Top players</strong><span>Completed levels</span></div>' + rows.map((row, idx) => `<div class="leaderboard-row"><span>#${idx + 1} ${row.displayName || 'Player'}</span><span>${row.completedLevels || 0}</span></div>`).join('');
  }

  // Test/earn stars button (for development/testing)
  const earnStarsBtn = document.getElementById('header-earn-stars-btn');
  if (earnStarsBtn) {
    earnStarsBtn.addEventListener('click', async () => {
      const amount = parseInt(prompt('Enter test stars to add:', '10'), 10) || 0;
      if (amount <= 0) return;
      stars = await Storage.addStars(userId, amount) || (stars + amount);
      await persistUser();
      refreshUndosUI();
      showToast('Added ' + amount + ' test stars.');
    });
  }

  const headerActionsModal = document.getElementById('header-actions-modal');
  const headerMenuToggle = document.getElementById('header-actions-btn');

  function openHeaderActionsModal() {
    if (!headerActionsModal || !headerMenuToggle) return;

    headerActionsModal.hidden = false;
    headerActionsModal.classList.remove('closing');
    headerActionsModal.classList.add('opening');
    headerActionsModal.style.display = 'flex';
    headerActionsModal.style.position = 'fixed';
    headerActionsModal.style.inset = '0';
    headerActionsModal.style.alignItems = 'center';
    headerActionsModal.style.justifyContent = 'center';
    headerActionsModal.style.background = 'rgba(0,0,0,0.45)';
    headerActionsModal.style.zIndex = '2000';

    const card = headerActionsModal.querySelector('.actions-modal-card');
    if (card) {
      card.style.background = card.style.background || 'var(--card-bg, #fff)';
      card.style.color = card.style.color || 'var(--text-color, #000)';
      card.style.borderRadius = card.style.borderRadius || '12px';
      card.style.padding = card.style.padding || '12px';
      card.style.boxShadow = card.style.boxShadow || '0 12px 40px rgba(2,6,23,0.2)';
      card.style.maxWidth = card.style.maxWidth || '92%';
      card.style.width = card.style.width || '360px';
      card.style.position = card.style.position || 'relative';
      card.classList.remove('closing');
      card.classList.add('opening');
    }

    document.body.classList.add('modal-open');
    headerMenuToggle.setAttribute('aria-expanded', 'true');

    if (!headerActionsModal._wired) {
      headerActionsModal.addEventListener('click', (event) => {
        if (event.target === headerActionsModal) closeHeaderActionsModal();
      });

      const closeBtn = headerActionsModal.querySelector('.actions-modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          closeHeaderActionsModal();
        });
      }

      headerActionsModal.querySelectorAll('button').forEach((button) => {
        if (button.classList.contains('actions-modal-close')) return;
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          closeHeaderActionsModal();
        });
      });

      headerActionsModal._wired = true;
    }

    requestAnimationFrame(() => {
      if (headerActionsModal) headerActionsModal.classList.remove('opening');
      if (card) card.classList.remove('opening');
    });
  }

  function closeHeaderActionsModal() {
    if (!headerActionsModal) return;

    headerActionsModal.classList.remove('opening');
    headerActionsModal.classList.add('closing');

    const card = headerActionsModal.querySelector('.actions-modal-card');
    if (card) {
      card.classList.remove('opening');
      card.classList.add('closing');
    }

    window.setTimeout(() => {
      headerActionsModal.hidden = true;
      headerActionsModal.style.display = 'none';
      headerActionsModal.classList.remove('closing');
      if (card) card.classList.remove('closing');
      headerMenuToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('modal-open');
    }, 180);
  }

  if (headerMenuToggle) {
    headerMenuToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      openHeaderActionsModal();
    });
  }

  const shareBtn = document.getElementById('header-share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareText = `I am playing Sokoban Mini App! I completed ${completedLevels.length} of ${LEVELS.length} levels and have ${undos} undos left.`;
      const canvasEl = document.getElementById('canvas');
      let file = null;
      if (canvasEl) {
        const blob = await new Promise(resolve => canvasEl.toBlob(resolve, 'image/png'));
        if (blob) file = new File([blob], 'sokoban-progress.png', { type: 'image/png' });
      }
      if (navigator.share && file) {
        await navigator.share({ title: 'Sokoban Progress', text: shareText, files: [file] });
      } else {
        navigator.clipboard?.writeText(shareText);
        showToast('Progress text copied to clipboard.');
      }
    });
  }

  const referralBtn = document.getElementById('header-referral-btn');
  if (referralBtn) {
    referralBtn.addEventListener('click', () => {
      const link = `https://t.me/your_bot?start=${referralCode}`;
      navigator.clipboard?.writeText(link);
      showToast(`Referral link copied to ClipBoard`)
    });
  }
  
  
  function showComingSoonMessage(button) {
    if (button) {
      button.setAttribute('title', 'Coming soon');
      button.setAttribute('aria-label', 'Coming soon');
    }

    let toast = document.getElementById('coming-soon-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'coming-soon-toast';
      toast.style.position = 'fixed';
      toast.style.left = '50%';
      toast.style.bottom = '92px';
      toast.style.transform = 'translateX(-50%)';
      toast.style.background = 'rgba(2, 6, 23, 0.95)';
      toast.style.color = '#fff';
      toast.style.padding = '8px 12px';
      toast.style.borderRadius = '999px';
      toast.style.fontSize = '0.84rem';
      toast.style.fontWeight = '700';
      toast.style.zIndex = '2000';
      toast.style.boxShadow = '0 8px 24px rgba(2, 6, 23, 0.24)';
      document.body.appendChild(toast);
    }

    toast.textContent = 'Coming soon';
    toast.style.display = 'block';
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 1400);
  }

  // Optional: configure Supabase via global (if provided by host)
  if (window.SUPABASE_CONFIG && window.SUPABASE_CONFIG.url && window.SUPABASE_CONFIG.key) {
    Storage.setSupabaseConfig({ url: window.SUPABASE_CONFIG.url, key: window.SUPABASE_CONFIG.key });
  }

  // Server-client Telegram payment scaffold
  async function initiateTelegramPurchase(starsToBuy) {
    const serverUrl = window.TELEGRAM_PAYMENT_CONFIG?.serverUrl || '';
    if (serverUrl) {
      try {
        const response = await fetch(`${serverUrl}/api/telegram/payment/initiate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, starsToBuy, amountStars: starsToBuy })
        });
        const data = await response.json();
        if (data.ok) {
          stars = (stars || 0) + starsToBuy;
          await persistUser();
          refreshUndosUI();
          showToast(`Payment request sent. Server payload: ${data.payload}`);
          return true;
        }
      } catch (error) {
        console.warn('Payment server unavailable, using local simulator.', error);
      }
    }

    const ok = confirm('Simulate Telegram payment for ' + starsToBuy + ' stars?');
    if (ok) {
      stars = (stars || 0) + starsToBuy;
      await persistUser();
      refreshUndosUI();
      return true;
    }
    return false;
  }

  function showScreen(id) {
    const screens = ["initial-navigation","level-selection","game-screen","instructions-screen","achievements-screen"];
    if (activeScreen === 'game-screen' && id !== 'game-screen') {
      persistLevelState(sokoban?.level);
    }
    activeScreen = id;
    screens.forEach(s => {
      const el = document.getElementById(s);
      if (!el) return;
      if (s === id) {
        el.style.display = s === 'game-screen' ? 'flex' : 'block';
        el.style.visibility = 'visible';
        requestAnimationFrame(() => {
          el.classList.add('active');
          if (s === 'game-screen') {
            scheduleBoardResize();
          }
        });
      } else {
        el.classList.remove('active');
        el.style.visibility = 'hidden';
        el.style.display = 'none';
      }
    });
  }

  function getLevelStorageKey(level) {
    return `sokoban_level_state_${userId}_${level}`;
  }

  function persistLevelState(level) {
    if (!sokoban || !board || typeof level !== 'number') return;
    const state = {
      level,
      snapshot: board.createSnapshot(),
      completed: completedLevels.includes(level),
      skipped: skippedLevels.includes(level)
    };
    localStorage.setItem(getLevelStorageKey(level), JSON.stringify(state));
    localStorage.setItem('sokoban_last_level', String(level));
    localStorage.setItem(`sokoban_last_level_${userId}`, String(level));
  }

  function loadLevelState(level) {
    try {
      const raw = localStorage.getItem(getLevelStorageKey(level));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function isLevelUnlocked(levelIndex) {
    if (levelIndex === 0) return true;
    return completedLevels.includes(levelIndex - 1) || skippedLevels.includes(levelIndex - 1);
  }

  function markLevelSkipped(level) {
    if (skippedLevels.includes(level)) return;
    skippedLevels.push(level);
    localStorage.setItem('sokoban_skipped_levels', JSON.stringify(skippedLevels));
    persistUser();
    updateLevelSelectOptions();
    populateLevelGrid();
    refreshUndosUI();
  }

  function populateLevelGrid() {
    const grid = document.getElementById('level-grid');
    grid.innerHTML = '';
    for (let i = 0; i < LEVELS.length; i++) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.textContent = (i + 1).toString();
      btn.dataset.level = i;

      const locked = !isLevelUnlocked(i);
      if (completedLevels.includes(i)) btn.classList.add('completed');
      if (skippedLevels.includes(i)) btn.classList.add('skipped');
      if (i === sokoban.level) btn.classList.add('current');
      if (locked) {
        btn.classList.add('locked');
        btn.disabled = true;
      }

      btn.addEventListener('click', () => {
        if (btn.disabled) {
          showToast('Level is locked. Complete previous levels to unlock.');
          return;
        }
        const levelIndex = parseInt(btn.dataset.level, 10);
        createNewGame(levelIndex);
        showScreen('game-screen');
      });

      grid.appendChild(btn);
    }
  }

  const completionModal = document.getElementById('win-dialog');
  const completionLevelNumber = document.getElementById('completion-level-number');

  function openCompletionModal(level) {
    if (!completionModal) return;
    if (completionLevelNumber) {
      completionLevelNumber.textContent = String(level + 1);
    }
    completionModal.hidden = false;
    completionModal.classList.add('open');
    document.body.classList.add('modal-open');
  }

  function closeCompletionModal() {
    if (!completionModal) return;
    completionModal.hidden = true;
    completionModal.classList.remove('open');
    document.body.classList.remove('modal-open');
  }

  async function saveShareImageForLevel(level) {
    const canvasEl = document.getElementById('canvas');
    if (!canvasEl) return null;

    const dataUrl = canvasEl.toDataURL('image/png');
    const key = `sokoban_share_image_${level}`;
    localStorage.setItem(key, dataUrl);
    return dataUrl;
  }

  async function shareCompletedLevel(level) {
    const shareText = `I completed Sokoban level ${level + 1}!`;
    const imageKey = `sokoban_share_image_${level}`;
    const savedImage = localStorage.getItem(imageKey);

    let file = null;
    if (savedImage) {
      const response = await fetch(savedImage);
      const blob = await response.blob();
      file = new File([blob], `sokoban-level-${level + 1}.png`, { type: 'image/png' });
    }

    if (navigator.share && file) {
      await navigator.share({ title: 'Sokoban Level Complete', text: shareText, files: [file] });
    } else {
      navigator.clipboard?.writeText(shareText);
      showToast('Level complete message copied to clipboard.');
    }
  }

  // Populate level dropdown dynamically from LEVELS
  const $select = $("#select-level");
  $select.empty();
  for (let i = 0; i < LEVELS.length; i++) {
    const opt = document.createElement('option');
    opt.value = i + 1;
    opt.text = (i + 1).toString();
    $select.append(opt);
  }

  function createNewGame(level, options = {}) {
    const { reset = false } = options;
    const targetLevel = Math.max(0, Math.min(LEVELS.length - 1, Number(level) || 0));
    if (targetLevel > 0 && !isLevelUnlocked(targetLevel)) {
      showToast(`Please complete or skip level ${targetLevel} before accessing level ${targetLevel + 1}!`);
      return;
    }
    if (sokoban?.level !== undefined && board) {
      persistLevelState(sokoban.level);
    }
    closeCompletionModal();
    sokoban = new Sokoban(targetLevel);
    board = sokoban.board;
    if (!reset) {
      const restoredState = loadLevelState(targetLevel);
      if (restoredState?.snapshot) {
        board.restoreSnapshot(restoredState.snapshot);
        board.stage.removeAllChildren();
        board.render();
      }
    }
    // show game screen
    showScreen('game-screen');
    requestAnimationFrame(() => {
      const screen = document.getElementById('game-screen');
      if (screen) {
        screen.style.display = 'block';
        screen.classList.add('active');
      }
      sokoban?.resizeBoard();
    });
    // update UI
    $("#canvas").show();
    $("#header-steps").text(skipsAvailable);
    $("#header-level").text(sokoban.level + 1);
    $("#current-level-number").text(sokoban.level + 1);
    $("#select-level").val(sokoban.level + 1);
    updateLevelSelectOptions();
    populateLevelGrid();
    // update control button states
    updateControlButtons();
  }

  // Mark level as completed when game over
  async function markLevelCompleted(level) {
    createNewGame(level, {reset: true})
    if (!completedLevels.includes(level)) {
      completedLevels.push(level);
      localStorage.setItem('sokoban_completed_levels', JSON.stringify(completedLevels));
      await persistUser();
      await Storage.saveLeaderboardEntry({ userId, displayName: userData.displayName || 'Player', completedLevels: completedLevels.length });
      await updateLeaderboard();
      updateLevelSelectOptions();
      populateLevelGrid();
    }
  }

  function setActiveNavButton(activeId) {
    document.querySelectorAll('.nav-item').forEach((button) => {
      button.classList.toggle('active', button.id === activeId);
    });
  }

  const leaderboardMainBtn = document.getElementById('leaderboard-main-btn');
  if (leaderboardMainBtn) {
    leaderboardMainBtn.addEventListener('mouseenter', () => showComingSoonMessage(leaderboardMainBtn));
    leaderboardMainBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showComingSoonMessage(leaderboardMainBtn);
    });
  }

  // // @should-delete: remove reset-game-btn if not needed
  $("#reset-game-btn").click(event => {
    createNewGame(0, { reset: true });
  });
  // @should-delete: remove reset-level-btn if not needed
  $("#reset-level-btn").click(event => {
    createNewGame(sokoban.level, { reset: true });
  });

  document.getElementById('continue-level-btn')?.addEventListener('click', () => {
    closeCompletionModal();
    const nextLevel = sokoban.level + 1;
    if (nextLevel < LEVELS.length) {
      createNewGame(nextLevel);
    } else {
      showScreen('level-selection');
      setActiveNavButton('home-nav-btn');
    }
  });

  document.getElementById('share-level-btn')?.addEventListener('click', async () => {
    await saveShareImageForLevel(sokoban.level);
    await shareCompletedLevel(sokoban.level);
  });

  document.getElementById('retry-level-btn')?.addEventListener('click', () => {
    createNewGame(sokoban.level, { reset: true });
  });

  $("#select-level").change(event => {
    const level = $("#select-level").val();
    createNewGame(parseInt(level - 1));
  });

  // Navigation buttons
  const startGameBtn = document.getElementById('start-game-btn');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', () => {
      populateLevelGrid();
     /**  if (initialLevel >= 0 && initialLevel < LEVELS.length) {
        createNewGame(initialLevel);
        return;
      }
      */
      showScreen('level-selection');
    });
  }

  const instructionsBtn = document.getElementById('instructions-btn');
  if (instructionsBtn) {
    instructionsBtn.addEventListener('click', () => {
      showScreen('instructions-screen');
      setActiveNavButton('instructions-btn');
    });
  }

  const homeNavBtn = document.getElementById('home-nav-btn');
  if (homeNavBtn) {
    homeNavBtn.addEventListener('click', () => {
      showScreen('initial-navigation');
      setActiveNavButton('home-nav-btn');
    });
  }

  const achievementsBtn = document.getElementById('achievements-btn');
  if (achievementsBtn) {
    achievementsBtn.addEventListener('mouseenter', () => showComingSoonMessage(achievementsBtn));
    achievementsBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      showComingSoonMessage(achievementsBtn);
    });
  }

  document.getElementById('back-to-nav-btn').addEventListener('click', () => {
    showScreen('initial-navigation');
    setActiveNavButton('home-nav-btn');
  });
  document.getElementById('back-from-instructions-btn').addEventListener('click', () => {
    showScreen('initial-navigation');
    setActiveNavButton('home-nav-btn');
  });
  document.getElementById('back-from-achievements-btn').addEventListener('click', () => {
    showScreen('initial-navigation');
    setActiveNavButton('home-nav-btn');
  });
  document.getElementById('back-to-level-select-btn').addEventListener('click', () => {
    populateLevelGrid();
    showScreen('level-selection');
    setActiveNavButton('home-nav-btn');
  });

  // Game control buttons
  const COST_PER_UNDO = 2; // 1 undo = 2 stars by default (changeable)
  const CUSTOM_UNDO_PRICE_PER_UNDO = 1; // Admin-controlled price for custom purchases
  let wasOpen = false

  function beforeAnyShopOpenOrClose() {
     if(activeModal){
       activeModal.hidden = !activeModal.hidden
       updateModalInfo()
     }
  }

  function openUndoShop() {
    const modal = document.getElementById('undo-shop-modal');
    if (modal) {
      beforeAnyShopOpenOrClose()
      modal.hidden = false;
      document.body.classList.add('open');
    }
  }

  function closeUndoShop() {
    const modal = document.getElementById('undo-shop-modal');
    if (modal) {
      beforeAnyShopOpenOrClose()
      modal.hidden = true;
      document.body.classList.remove('open');
    }
  }

  function openSkipShop() {
    const modal = document.getElementById('skip-shop-modal');
    if (modal) {
      beforeAnyShopOpenOrClose()
      modal.hidden = false;
      document.body.classList.add('open');
    }
  }

  function openRestartShop() {
    const modal = document.getElementById('restart-shop-modal');
    if (modal) {
      beforeAnyShopOpenOrClose()
      modal.hidden = false;
      document.body.classList.add('open');
      updateRestartTimerUI();
    }
  }

  function closeRestartShop() {
    const modal = document.getElementById('restart-shop-modal');
    if (modal) {
      beforeAnyShopOpenOrClose()
      modal.hidden = true;
      document.body.classList.remove('open');
    }
  }

  function closeSkipShop() {
    const modal = document.getElementById('skip-shop-modal');
    if (modal) {
      beforeAnyShopOpenOrClose()
      modal.hidden = true;
      document.body.classList.remove('open');
    }
  }

  async function purchaseUndoPackage(undosToBuy, costInStars) {
    if (undosToBuy <= 0 || costInStars <= 0) {
      showToast('Invalid package selection.');
      return;
    }

    const success = await buyProduct("undos", costInStars, userId, undosToBuy, true);

    if (!success) {
      showToast('Purchase failed. Please try again.');
      return;
    }

    undos =  undos + undosToBuy;
    lastRefill = Date.now();
    await persistUser();
    refreshUndosUI();
    refreshGameStats();
    updateUndoTimerUI();
    closeUndoShop();
    showToast(`Purchased ${undosToBuy} undos for ${costInStars} stars.`);
  }

  async function purchaseRestartPackage(restartsToBuy, costInStars) {
    if (restartsToBuy <= 0 || costInStars <= 0) {
      showToast('Invalid package selection.');
      return;
    }

    const success = await buyProduct("restarts", costInStars, userId, restartsToBuy, true);
    if (!success) {
      showToast('Purchase failed. Please try again.');
      return;
    }

    restartsAvailable = restartsAvailable + restartsToBuy;
    lastRestartRefill = Date.now();
    await persistUser();
    refreshUndosUI();
    refreshGameStats();
    updateRestartTimerUI();
    closeRestartShop();
    showToast(`Purchased ${restartsToBuy} restarts for ${costInStars} stars.`);
  }

  async function buyRestartsFlow() {
    openRestartShop();
  }

  async function buyUndosFlow() {
    openUndoShop();
  }

  const undoBtn = document.getElementById('undo-btn') || document.getElementById('header-undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      if (undos > 0) {
        const undone = board.undoMove();
        if (undone) {
          undos = Math.max(0, undos - 1);
          lastRefill = Date.now();
          await persistUser();
          refreshGameStats();
          refreshUndosUI();
          updateUndoTimerUI();
        }
        return;
      }

      await buyUndosFlow();
    });
  }

  const buyUndosBtn = document.getElementById('header-buy-undos-btn');
  if (buyUndosBtn) {
    buyUndosBtn.addEventListener('click', async () => {
      await buyUndosFlow();
    });
  }

  document.getElementById('close-undo-shop-btn')?.addEventListener('click', closeUndoShop);
  document.getElementById('undo-shop-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'undo-shop-modal') {
      closeUndoShop();
    }
  });
  document.getElementById('close-skip-shop-btn')?.addEventListener('click', closeSkipShop);
  document.getElementById('skip-shop-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'skip-shop-modal') {
      closeSkipShop();
    }
  });
  

  document.querySelectorAll('.undo-shop-buy-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      button.classList.add("is-loading");
      button.disabled = true;

      const undosToBuy = parseInt(button.dataset.undos || '0', 10);
      const costInStars = parseInt(button.dataset.cost || '0', 10);
      await purchaseUndoPackage(undosToBuy, costInStars);

      button.classList.remove("is-loading");
      button.disabled = false;
      
    });
  });

  document.querySelectorAll('.skip-shop-buy-btn').forEach((button) => {
    button.addEventListener('click', async () => {

      button.classList.add("is-loading");
      button.disabled = true;

      const skipsToBuy = parseInt(button.dataset.skips || '0', 10);
      const costInStars = parseInt(button.dataset.cost || '0', 10);

      if (skipsToBuy <= 0 || costInStars <= 0) {
        showToast('Invalid skip package.');
        return;
      }
      
      const success = await buyProduct("skips", costInStars, userId, skipsToBuy, true);
      if (!success) {
        showToast('Purchase failed. Please try again.');
        return;
      }

      skipsAvailable += skipsToBuy;
      await persistUser();
      refreshUndosUI();
      refreshGameStats();
      closeSkipShop();
      showToast(`Purchased ${skipsToBuy} skips for ${costInStars} stars.`);
 
      button.classList.remove("is-loading");
      button.disabled = false;
      
    });
  });

  document.getElementById('buy-custom-undos-btn')?.addEventListener('click', async () => {
    let button = document.getElementById('buy-custom-undos-btn')

    button.classList.add("is-loading");
    button.disabled = true;

    const amountInput = document.getElementById('custom-undo-amount');
    const amount = parseInt(amountInput?.value || '0', 10);
    if (!amount || amount <= 0) {
      showToast('Enter a valid amount of undos.');
      return;
    }
    const customCost = amount * CUSTOM_UNDO_PRICE_PER_UNDO;
    await purchaseUndoPackage(amount, customCost);

    button.classList.remove("is-loading");
    button.disabled = false;
  });

  document.getElementById('skip-level-btn').addEventListener('click', async () => {
    const next = sokoban.level + 1;
    if (next >= LEVELS.length) {
      showToast('No more levels to skip to.');
      return;
    }

    if (completedLevels.includes(sokoban.level)) {
      createNewGame(next);
      return;
    }

    if (skipsAvailable <= 0) {
      openSkipShop();
      return;
    }

    skipsAvailable = Math.max(0, skipsAvailable - 1);
    markLevelSkipped(sokoban.level);
    await persistUser();
    refreshUndosUI();
    createNewGame(next);
    showToast(`Skipped level ${sokoban.level + 1}.`);
  });

  document.getElementById('restart-level-btn').addEventListener('click', () => {
    if (restartsAvailable > 0) {
      restartsAvailable = Math.max(0, restartsAvailable - 1);
      persistUser();
      refreshUndosUI();
      createNewGame(sokoban.level, { reset: true });
      showToast('Level restarted.');
      return;
    }

    openRestartShop();
  });

  document.getElementById('close-restart-shop-btn')?.addEventListener('click', closeRestartShop);
  document.getElementById('restart-shop-modal')?.addEventListener('click', (event) => {
    if (event.target.id === 'restart-shop-modal') closeRestartShop();
  });

  document.querySelectorAll('.restart-shop-buy-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      button.classList.add('is-loading');
      button.disabled = true;
      const restartsToBuy = parseInt(button.dataset.restarts || '0', 10);
      const costInStars = parseInt(button.dataset.cost || '0', 10);
      await purchaseRestartPackage(restartsToBuy, costInStars);
      button.classList.remove('is-loading');
      button.disabled = false;
    });
  });

  document.getElementById('solution-btn').addEventListener('click', async () => {
    showToast('Coming soon: Solution feature is under development.');
  });

  function refreshGameStats() {
    $('#header-steps').text(skipsAvailable);
    $('#header-level').text(sokoban.level + 1);
    $('#current-level-number').text(sokoban.level + 1);
  }

  function updateControlButtons() {
    const next = sokoban.level + 1;
    const skipBtn = document.getElementById('skip-level-btn');
    skipBtn.disabled = next >= LEVELS.length;
  }
  
  window.addEventListener('resize', () => {
    if (document.getElementById('game-screen')?.style.display !== 'none') {
      requestAnimationFrame(() =>{ resizeGameView(); fitCanvas()});
    }
  });

  // Initialize the game and update UI
  updateLevelSelectOptions();
  updateAchievements();

  // Show initial navigation screen on load
  showScreen('initial-navigation');

  window.addEventListener('beforeunload', () => {
    if (sokoban?.level !== undefined && board) {
      persistLevelState(sokoban.level);
    }
  });

  function updateLevelSelectOptions() {
    $("#select-level option").each(function() {
      const optionLevel = parseInt($(this).val()) - 1;
      const baseLabel = (optionLevel + 1).toString();
      if (completedLevels.includes(optionLevel)) {
        $(this).prop('disabled', false);
        $(this).css('opacity', '1');
        $(this).text(baseLabel + ' ✓');
      } else if (skippedLevels.includes(optionLevel)) {
        $(this).prop('disabled', false);
        $(this).css('opacity', '1');
        $(this).text(baseLabel + ' ⏭️');
      } else if (optionLevel > 0 && !isLevelUnlocked(optionLevel)) {
        $(this).prop('disabled', true);
        $(this).css('opacity', '0.5');
        $(this).text(baseLabel + ' 🔒');
      } else {
        $(this).prop('disabled', false);
        $(this).css('opacity', '1');
        $(this).text(baseLabel);
      }
    });
    
    // Update progress bar
    const progressPercent = completedLevels.length / LEVELS.length * 100;
    $('#progress-fill').css('width', progressPercent + '%');
    $('.progress-text').text(Math.round(progressPercent) + '% Complete');
    
    // Update header stats
    $('#header-level').text(sokoban.level + 1);
    $('#header-steps').text(skipsAvailable);
    
    // Update achievements
    updateAchievements();
  }
  
  function updateAchievements() {
    const achievementList = $('#achievement-list');
    achievementList.empty();
    updateLeaderboard();
    
    // Achievement 1: First Level
    if (completedLevels.includes(0)) {
      achievementList.append(`<div class="achievement unlocked">
        <div class="achievement-title">🎯 First Steps</div>
        <div class="achievement-desc">Complete your first level</div>
      </div>`);
    } else {
      achievementList.append(`<div class="achievement locked">
        <div class="achievement-title">🎯 First Steps</div>
        <div class="achievement-desc">Complete your first level</div>
      </div>`);
    }
    
    // Achievement 2: Speed Demon
    const fastestTime = localStorage.getItem('sokoban_fastest_time');
    if (fastestTime && parseInt(fastestTime) < 60000) { // Under 1 minute
      achievementList.append(`<div class="achievement unlocked">
        <div class="achievement-title">⚡ Speed Demon</div>
        <div class="achievement-desc">Complete a level in under 1 minute</div>
      </div>`);
    } else {
      achievementList.append(`<div class="achievement locked">
        <div class="achievement-title">⚡ Speed Demon</div>
        <div class="achievement-desc">Complete a level in under 1 minute</div>
      </div>`);
    }
    
    // Achievement 3: Box Stack
    const maxBoxesPushed = localStorage.getItem('sokoban_max_boxes_pushed') || 0;
    if (maxBoxesPushed >= 10) {
      achievementList.append(`<div class="achievement unlocked">
        <div class="achievement-title">📦 Box Stack</div>
        <div class="achievement-desc">Push 10 or more boxes in a single level</div>
      </div>`);
    } else {
      achievementList.append(`<div class="achievement locked">
        <div class="achievement-title">📦 Box Stack</div>
        <div class="achievement-desc">Push 10 or more boxes in a single level</div>
      </div>`);
    }
    
    // Achievement 4: Perfect Game
    if (completedLevels.length === 30) {
      achievementList.append(`<div class="achievement unlocked">
        <div class="achievement-title">🏆 Perfect Game</div>
        <div class="achievement-desc">Complete all 30 levels</div>
      </div>`);
    } else {
      achievementList.append(`<div class="achievement locked">
        <div class="achievement-title">🏆 Perfect Game</div>
        <div class="achievement-desc">Complete all 30 levels</div>
      </div>`);
    }
  }

  

  function lockScroll(lock) {
    document.body.style.overflow = lock ? 'hidden' : '';
  }

  function getFocusableElements(container) {
    return container.querySelectorAll(
       'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
  }
 
  function updateModalInfo(){
       /**  const restartsText = restartsAvailable != 1 ? `${ restartsAvailable} restarts` : `${ restartsAvailable} restart` 
        $('#modal-info-restarts').text(restartsText);
        const skipsText = skipsAvailable != 1 ? `skips: ${ skipsAvailable} ` : `${ skipsAvailable} skip` 
        $('#modal-info-skips').text(skipsText);
        const undosText = undos != 1 ? `${ undos } undos` : `${ restartsAvailable} undo` 
        $('#modal-info-undos').text(undosText); */
      const restartsText = `restarts: ${ restartsAvailable}`
       $('#modal-info-restarts').text(restartsText);
      const skipsText = `skips: ${ skipsAvailable} ` 
      $('#modal-info-skips').text(skipsText);
      const undosText = `undos: ${ undos }`
      $('#modal-info-undos').text(undosText); 
  }
  function openModal(id, trigger) {
      const modal_limits = document.getElementById(id);

      
      if (!modal_limits) return;

      activeModal = modal_limits;
      lastTrigger = trigger || document.activeElement;
      
      updateModalInfo()
      modal_limits.hidden = false;
      document.body.classList.add('open');
      lockScroll(true);

      const focusables = getFocusableElements(modal_limits);
      if (focusables.length) focusables[0].focus();
    }

    function closeModal(id) {
      const modal_limits = id ? document.getElementById(id) : activeModal;
      if (!modal_limits) return;

      modal_limits.hidden = true;
      modal_limits.classList.remove('open');
      activeModal = null;
      lockScroll(false);

      if (lastTrigger) lastTrigger.focus();
    }

    document.getElementById('limitsBtn').addEventListener('click', () => openModal('limitsModal', limitsBtn));

    document.querySelectorAll('[data-close]').forEach(el => {
      el.addEventListener('click', () => closeModal(el.getAttribute('data-close')));
    });


  //-----------------> Movements SetUp <------------------

  const DIR_VEC = {
    left:  37,
    up:    38,
    right: 39,
    down:  40,
  };
  
  const settingsBtn   = document.getElementById("settings-btn");
  const settingsModal = document.getElementById("settings-modal");
  const settingsClose = document.getElementById("settings-close");
  const modeRadios    = document.getElementById("mode-radios");
  const swipeHint     = document.getElementById("swipe-hint");
  
  // ---------- settings ----------
  const SETTINGS_KEY = `sokoban.settings.v1_${userId}`;
  const MODES = ["buttons", "swipe", "double-swipe"];
  const MODE_LABELS = {
    "buttons":      "Buttons",
    "swipe":        "Swipe",
    "double-swipe": "Double-swipe"
  };

  function loadSettings() {
    try {
      const raw = userData.settings || "{}";
      if (MODES.includes(raw.controlMode)) settings.controlMode = raw.controlMode;
    } catch (_) { /* ignore */ }
  }

  function saveSettings() {
    persistUser();
  }

  function applyMode() {
    const m = settings.controlMode;
    const root = document.documentElement;
    root.classList.toggle("mode-buttons",      m === "buttons");
    root.classList.toggle("mode-swipe",        m === "swipe");
    root.classList.toggle("mode-double-swipe", m === "double-swipe");
   // if (modePill)    modePill.setAttribute("data-mode", m);
    //if (modeLabelEl) modeLabelEl.textContent = MODE_LABELS[m] || m;
    // keep the radio in sync (in case settings changed elsewhere)
    const radio = modeRadios && modeRadios.querySelector(`input[value="${m}"]`);
    if (radio && !radio.checked) radio.checked = true;
    // clear any pending double-swipe state when switching modes
    lastSwipe = { dir: null, at: 0 };
    hideSwipeHint();
  }

  function setMode(m) {
    if (!MODES.includes(m)) return;
    settings.controlMode = m;
    saveSettings();
    applyMode();
  }


  // ---------- swipe on canvas (mode-aware) ----------
  const SWIPE_MIN = 18;
  const DOUBLE_SWIPE_WINDOW = 700;  // ms
  let touchStart = null;
  let lastSwipe = { dir: null, at: 0 };
  let hintTimer = null;

  // Use pointer events so swipe works for touch AND mouse (desktop preview).
  // Add a touch fallback as well because mobile emulation can still trigger the
  // legacy touch path before the pointer event is normalized.
  let isDraggingSwipe = false;

  function beginSwipe(clientX, clientY) {
    touchStart = { x: clientX, y: clientY };
    isDraggingSwipe = true;
    try { canvas.setPointerCapture?.(canvas.__lastPointerId ?? 0); } catch (_) {}
  }

  function finishSwipe(clientX, clientY) {
    if (!touchStart || !isDraggingSwipe) return;
    const dx = clientX - touchStart.x;
    const dy = clientY - touchStart.y;
    touchStart = null;
    isDraggingSwipe = false;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    const dir = (Math.abs(dx) > Math.abs(dy))
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down"  : "up");
    handleSwipe(dir);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    canvas.__lastPointerId = e.pointerId;
    beginSwipe(e.clientX, e.clientY);
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  }, { passive: false });

  canvas.addEventListener("pointermove", (e) => {
    if (!isDraggingSwipe || !touchStart) return;
    const dx = e.clientX - touchStart.x;
    const dy = e.clientY - touchStart.y;
    if (Math.abs(dx) > SWIPE_MIN || Math.abs(dy) > SWIPE_MIN) {
      e.preventDefault();
    }
  }, { passive: false });

  canvas.addEventListener("pointerup", (e) => {
    e.preventDefault();
    finishSwipe(e.clientX, e.clientY);
  }, { passive: false });

  canvas.addEventListener("pointerleave", () => {
    if (!touchStart || !isDraggingSwipe) return;
    touchStart = null;
    isDraggingSwipe = false;
  }, { passive: true });

  canvas.addEventListener("pointercancel", (e) => {
    e.preventDefault();
    touchStart = null;
    isDraggingSwipe = false;
  }, { passive: false });

  canvas.addEventListener("touchstart", (e) => {
    if (!e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    e.preventDefault();
    beginSwipe(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    if (!isDraggingSwipe || !e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    e.preventDefault();
    if (Math.abs(t.clientX - touchStart.x) > SWIPE_MIN || Math.abs(t.clientY - touchStart.y) > SWIPE_MIN) {
      // keep the gesture locked so the browser does not interpret it as a scroll
      return;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const t = e.changedTouches?.[0];
    if (!t) {
      touchStart = null;
      isDraggingSwipe = false;
      return;
    }
    e.preventDefault();
    finishSwipe(t.clientX, t.clientY);
  }, { passive: false });

  canvas.addEventListener("touchcancel", () => {
    touchStart = null;
    isDraggingSwipe = false;
  }, { passive: true });

  // suppress context menu on long press
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  function handleSwipe(dir) {
    const mode = settings.controlMode;
    if (mode === "buttons") {
      // buttons mode: swipe on canvas is a fallback — register immediately
      const v = DIR_VEC[dir]; tryMoveSwipe(v);
      return;
    }
    if (mode === "swipe") {
      const v = DIR_VEC[dir]; tryMoveSwipe(v);
      return;
    }
    if (mode === "double-swipe") {
      const now = Date.now();
      if (lastSwipe.dir === dir && (now - lastSwipe.at) < DOUBLE_SWIPE_WINDOW) {
        // confirmation: move
        const v = DIR_VEC[dir]; tryMoveSwipe(v);
        lastSwipe = { dir: null, at: 0 };
        hideSwipeHint();
      } else {
        // first (or different-direction) swipe: arm + show hint
        lastSwipe = { dir, at: now };
        showSwipeHint(dir);
      }
    }
  }

  function showSwipeHint(dir) {
    if (!swipeHint) return;
    swipeHint.setAttribute("data-dir", dir);
    swipeHint.classList.add("is-visible");
    swipeHint.setAttribute("aria-hidden", "false");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideSwipeHint, DOUBLE_SWIPE_WINDOW);
  }
  function hideSwipeHint() {
    if (!swipeHint) return;
    swipeHint.classList.remove("is-visible");
    swipeHint.setAttribute("aria-hidden", "true");
    clearTimeout(hintTimer);
    hintTimer = null;
  }

  // ---------- mobile D-pad (only used in "buttons" mode) ----------
 const controls = createMobileControls({
    onMove: (dir) => {
      const v = DIR_VEC[dir]; tryMoveSwipe(v);
    },
    onUndo:  () => undo(),
    onReset: () => reset()
  });

  // ---------- settings modal ----------
  function openSettings() { settingsModal.hidden = false; }
  function closeSettings() { settingsModal.hidden = true; }

  settingsBtn.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  // close on backdrop click
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettings();
  });
  // radio change
  modeRadios.addEventListener("change", (e) => {
    const t = e.target;
    if (t && t.name === "ctrl-mode" && MODES.includes(t.value)) {
      setMode(t.value);
    }
  });


  // ---------- boot ----------
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    try {
      tg.ready();
      tg.expand();
      if (tg.themeParams && tg.themeParams.bg_color) {
        document.documentElement.style.setProperty("--bg-0", tg.themeParams.bg_color);
      }
      if (tg.themeParams && tg.themeParams.hint_color) {
        document.documentElement.style.setProperty("--mut", tg.themeParams.hint_color);
      }
    } catch (_) {}
  }
 
  async function persistAndMove(moved){
    if (moved) {
      persistLevelState(sokoban.level);
    }

    refreshGameStats();

    if (sokoban.board.gameOver()) {
      const completedLevel = sokoban.level;
      await markLevelCompleted(completedLevel);
      await saveShareImageForLevel(completedLevel);
      openCompletionModal(completedLevel);
    }
  }

  function tryMoveSwipe(keyCode){
    
    if (completionModal?.hidden === false) {
      return;
    }
    
    let moved = false;
    switch(keyCode) {
      case 37:
        moved = board.movePlayer("left");
        break;

      case 38:
        moved = board.movePlayer("up");
        break;

      case 39:
        moved = board.movePlayer("right");
        break;

      case 40:
        moved = board.movePlayer("down");
        break;
    }

    persistAndMove(moved)
    
  }
  
  document.addEventListener("keydown", async (event) => {
    if (completionModal?.hidden === false) {
      return;
    }

    event.preventDefault();

     if (event.key === 'Escape') {
      //if (!headerMenu.hidden) setHeaderMenuOpen(false);
      closeUndoShop();
      closeSkipShop();
      if (!settingsModal.hidden) closeSettings();
    }

    if (activeModal){

      if (event.key === 'Escape') {
        closeModal();
        return;
      }

      if (event.key === 'Tab') {
        const focusables = Array.from(getFocusableElements(activeModal)).filter(el => !el.disabled);
        if (!focusables.length) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    let moved = false;
    switch(event.keyCode) {
      case 37:
        moved = board.movePlayer("left");
        break;

      case 38:
        moved = board.movePlayer("up");
        break;

      case 39:
        moved = board.movePlayer("right");
        break;

      case 40:
        moved = board.movePlayer("down");
        break;
    }

    persistAndMove(moved)
  }, { passive: false });

  loadSettings();
  applyMode();
});
