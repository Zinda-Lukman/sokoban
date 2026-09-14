/* ============================================================
   Mobile Touch Controls — pluggable module
   ----------------------------------------------------------
   Usage from another ES module file:

     import { createMobileControls } from "./controls.js";

     const controls = createMobileControls({
       onMove:  (dir) => game.move(dir),
       onUndo:  () => game.undo(),
       onReset: () => game.reset(),
     });

   Usage from a classic <script> tag (no bundler / no module loader):

     <script src="controls.js"></script>
     <script>
       const controls = createMobileControls({ onMove: ... });
     </script>

   The module:
     - Detects phone / touch device and toggles a `.touch-mode` class on <html>
     - Wires pointer / touch / mouse events on each button
     - Provides press visual feedback (.is-pressed)
     - Supports press-and-hold repeat (optional, on by default)
     - Disables native touch gestures while interacting
   ============================================================ */

// ES module exports — use these from `import { ... } from "./controls.js"`
export const DIR_VEC = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 }
};

// ---------- Show controls only on phones / touch devices ----------
export function detectTouchMode() {
  // Combine signals: coarse pointer + small viewport + (hover: none)
  const coarse   = window.matchMedia("(pointer: coarse)").matches;
  const noHover  = window.matchMedia("(hover: none)").matches;
  const smallish = window.matchMedia("(max-width: 900px)").matches;
  const isTouch  = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);

  // Telegram WebApp always runs in a WebView on mobile
  const inTg     = !!(window.Telegram && window.Telegram.WebApp);

  return (coarse && smallish) || (noHover && isTouch) || (inTg && smallish);
}

export function applyTouchMode() {
  const on = detectTouchMode();
  const root = document.documentElement;
  root.classList.toggle("touch-mode", on);
  // Default to "buttons" mode if the host page hasn't picked a mode yet,
  // so the D-pad shows up out of the box. The host can override by adding
  // `mode-swipe` or `mode-double-swipe` to <html>.
  if (!root.className.match(/mode-(buttons|swipe|double-swipe)/)) {
    root.classList.add("mode-buttons");
  }
  const ctrl = document.getElementById("touch-controls");
  if (ctrl) ctrl.setAttribute("aria-hidden", on ? "false" : "true");
  return on;
}

// ---------- Public factory ----------
/**
 * @param {Object} opts
 * @param {(dir:'up'|'down'|'left'|'right') => void} opts.onMove
 * @param {() => void} [opts.onUndo]
 * @param {() => void} [opts.onReset]
 * @param {boolean}    [opts.repeat=true]   press-and-hold to repeat moves
 * @param {number}     [opts.repeatDelay=180] ms before repeat starts
 * @param {number}     [opts.repeatRate=110] ms between repeats
 */
export function createMobileControls(opts) {
  const {
    onMove,
    onUndo,
    onReset,
    repeat = true,
    repeatDelay = 180,
    repeatRate = 110
  } = opts || {};

  if (typeof onMove !== "function") {
    throw new Error("createMobileControls: onMove callback is required");
  }

  const root = document.getElementById("touch-controls");
  if (!root) return { setEnabled() {}, destroy() {} };

  const dirButtons = root.querySelectorAll("[data-dir]");          // scoped to #touch-controls
  const actionBtns = document.querySelectorAll("[data-action]");   // ← global
  const buttons = [...dirButtons, ...actionBtns];
  const holds   = new WeakMap();  // btn -> { timer, interval, pointerId }

  let enabled = true;

  // ---- low-level: mark a button as pressed for visual feedback
  function press(btn, on) {
    btn.classList.toggle("is-pressed", !!on);
  }

  // ---- low-level: fire a single action
  function fire(btn) {
    const dir    = btn.dataset.dir;
    const action = btn.dataset.action;
    if (dir)   { onMove(dir);  return; }
    if (action === "undo"  && onUndo)  onUndo();
    if (action === "reset" && onReset) onReset();
  }

  // ---- gesture handling (pointer events unify mouse + touch)
  function onPointerDown(e) {
    if (!enabled) return;
    // ignore non-primary buttons on mouse
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}

    const btn = e.currentTarget;
    press(btn, true);

    // first fire immediately
    fire(btn);

    if (!repeat || !btn.dataset.dir) return;  // only repeat movement
    const state = { pointerId: e.pointerId, timer: null, interval: null };
    holds.set(btn, state);
    state.timer = setTimeout(() => {
      state.interval = setInterval(() => {
        if (!enabled) return;
        // stop repeating if the pointer was released in the meantime
        if (state.pointerId == null) return;
        fire(btn);
      }, repeatRate);
    }, repeatDelay);
  }

  function onPointerUp(e) {
    const btn = e.currentTarget;
    const state = holds.get(btn);
    if (state) {
      clearTimeout(state.timer);
      clearInterval(state.interval);
      state.pointerId = null;
      holds.delete(btn);
    }
    press(btn, false);
  }

  function onPointerCancel(e) {
    onPointerUp(e);
  }

  // Bind
  buttons.forEach((btn) => {
    btn.addEventListener("pointerdown",   onPointerDown,   { passive: false });
    btn.addEventListener("pointerup",     onPointerUp,     { passive: true  });
    btn.addEventListener("pointerleave",  onPointerUp,     { passive: true  });
    btn.addEventListener("pointercancel", onPointerCancel, { passive: true  });
    // block long-press context menu / iOS callout
    btn.addEventListener("contextmenu",   (e) => e.preventDefault());
  });

  // Swallow global gestures while a control is held, so the page doesn't
  // scroll/zoom when the user slides off a button.
  root.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  return {
    setEnabled(on) {
      enabled = !!on;
      if (!enabled) {
        // clear any active press visuals
        buttons.forEach((b) => press(b, false));
      }
    },
    isEnabled() { return enabled; },
    isVisible() { return document.documentElement.classList.contains("touch-mode"); },
    destroy() {
      buttons.forEach((btn) => {
        btn.removeEventListener("pointerdown",   onPointerDown);
        btn.removeEventListener("pointerup",     onPointerUp);
        btn.removeEventListener("pointerleave",  onPointerUp);
        btn.removeEventListener("pointercancel", onPointerCancel);
      });
    }
  };
}

// ---------- Backwards-compat global ----------
// When loaded as a classic <script src="controls.js"></script> (no module),
// attach the API to `window` so non-module files can use it too.
// When loaded as <script type="module">, callers should `import` instead.
if (typeof window !== "undefined") {
  window.createMobileControls = createMobileControls;
  window.MobileControls = {
    create: createMobileControls,
    detect: detectTouchMode,
    apply:  applyTouchMode,
    DIR_VEC
  };
  // Auto-init the phone detection on first load.
  applyTouchMode();
  ["(pointer: coarse)", "(hover: none)", "(max-width: 900px)"].forEach((q) => {
    try {
      window.matchMedia(q).addEventListener?.("change", applyTouchMode);
    } catch (_) {}
  });
  window.addEventListener("orientationchange", applyTouchMode);
}
