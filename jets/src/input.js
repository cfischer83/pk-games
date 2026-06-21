// =============================================================================
// JETS — Unified Input Manager
// =============================================================================
// Merges three input sources into a single normalized per-frame snapshot:
//   1. Keyboard  (event.code based; never deprecated keyCode)
//   2. Gamepad   (navigator.getGamepads(), polled each update())
//   3. Touch     (programmatic API; the on-screen mobile controls call the
//                 setters/pressers below — this module creates NO DOM elements)
//
// USAGE per frame:
//   input.update();           // poll + merge + compute edges  (call ONCE/frame)
//   const s = input.state;    // read the snapshot
//   if (s.fire) { ... }
//   if (s.bombPressed) { ... } // edge flags are true for exactly one update()
//
// Coordinate conventions (see config.js):
//   moveX  -1..1  strafe: left(-) / right(+)   (+Z = strafe RIGHT)
//   moveY  -1..1  altitude: down(-) / up(+)    (+Y = UP)
// Gamepad stick: pushing UP yields a NEGATIVE axis value, so we invert it for
// moveY. Strafe stick X is already left(-)/right(+) so no inversion.
// =============================================================================

// Analog stick deadzone — ignore tiny resting drift.
const DEADZONE = 0.18;

// ---- Game key sets (event.code) --------------------------------------------
// Keys we own for gameplay; we preventDefault on these so the page doesn't
// scroll / scrub focus. (Modifier-less codes only — we never touch text inputs
// because the game has no focused text fields, and we additionally bail out of
// preventDefault if the event target looks like an editable element.)
const MOVE_LEFT_CODES  = new Set(['KeyA', 'ArrowLeft']);
const MOVE_RIGHT_CODES = new Set(['KeyD', 'ArrowRight']);
const MOVE_UP_CODES    = new Set(['KeyW', 'ArrowUp']);
const MOVE_DOWN_CODES  = new Set(['KeyS', 'ArrowDown']);
const FIRE_CODES       = new Set(['Space']);
const BOMB_CODES       = new Set(['Enter']);
const PAUSE_CODES      = new Set(['KeyP']);
const START_CODES      = new Set(['Enter', 'Space']);

// The union of every code we react to / want to suppress default behavior for.
const GAME_CODES = new Set([
  ...MOVE_LEFT_CODES, ...MOVE_RIGHT_CODES, ...MOVE_UP_CODES, ...MOVE_DOWN_CODES,
  ...FIRE_CODES, ...BOMB_CODES, ...PAUSE_CODES, // START_CODES ⊆ FIRE+BOMB
]);

// ---- Standard-mapping gamepad indices --------------------------------------
// Per the W3C "standard" gamepad mapping.
const GP = {
  A: 0,          // bottom face button   -> fire / start
  B: 1,          // right face button    -> bomb
  X: 2,          // left face button     -> bomb
  RT: 7,         // right trigger        -> fire
  START: 9,      // start / options      -> pause / start
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  AXIS_LX: 0,    // left stick X (left -, right +)
  AXIS_LY: 1,    // left stick Y (up -, down +)
};

/**
 * Apply a radial-ish deadzone to a single axis and rescale the remaining range
 * to 0..1 so movement starts smoothly just past the deadzone edge.
 * @param {number} v raw axis value (-1..1)
 * @returns {number} processed value (-1..1)
 */
function applyDeadzone(v) {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  // rescale [DEADZONE..1] -> [0..1], preserve sign
  const scaled = (a - DEADZONE) / (1 - DEADZONE);
  return Math.sign(v) * Math.min(1, scaled);
}

/** Clamp a number to [-1, 1]. */
function clamp1(v) {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

/** True if a button entry is pressed. Standard mapping uses GamepadButton
 *  objects, but some browsers/devices expose raw numbers — handle both. */
function btnPressed(buttons, i) {
  const b = buttons && buttons[i];
  if (b == null) return false;
  if (typeof b === 'number') return b > 0.5;
  // GamepadButton: prefer .pressed, fall back to analog .value
  return !!b.pressed || (typeof b.value === 'number' && b.value > 0.5);
}

export class InputManager {
  /**
   * @param {{target?: EventTarget}} [opts]
   *   opts.target — element that receives key listeners (default: window).
   */
  constructor(opts = {}) {
    this._target = opts.target || (typeof window !== 'undefined' ? window : null);

    // Set of currently-held keyboard codes (live, mutated by listeners).
    this._keys = new Set();

    // --- Touch (programmatic) live state, set by the on-screen controls ---
    this._touchMoveX = 0;        // -1..1
    this._touchMoveY = 0;        // -1..1
    this._touchFire = false;     // held
    // Latched one-shot touch requests; consumed (cleared) by update() as edges.
    this._touchBombReq = false;
    this._touchPauseReq = false;
    this._touchStartReq = false;

    // --- Edge-detection bookkeeping ---
    // Previous-frame "held" booleans for the logical actions that produce edges,
    // so an edge = (held now) && (not held last frame).
    this._prevBombHeld = false;
    this._prevPauseHeld = false;
    this._prevStartHeld = false;
    // For anyPressed we track the count of distinct held keys/buttons; an edge
    // fires when any newly-held key/button appears this frame.
    this._prevAnyHeld = false;

    // Gamepad connection tracking.
    this._gamepadConnected = false;
    this._activeGamepadIndex = -1;

    // The normalized snapshot, recomputed each update().
    this._state = {
      moveX: 0,
      moveY: 0,
      fire: false,
      bombPressed: false,
      pausePressed: false,
      startPressed: false,
      anyPressed: false,
    };

    this._started = false;

    // Bind handlers once so add/removeEventListener pair correctly.
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
    this._onGamepadConnected = this._onGamepadConnected.bind(this);
    this._onGamepadDisconnected = this._onGamepadDisconnected.bind(this);
  }

  // ---- Lifecycle -----------------------------------------------------------

  /** Attach keyboard, blur, and gamepad connection listeners. Idempotent. */
  start() {
    if (this._started || !this._target) return;
    this._started = true;

    this._target.addEventListener('keydown', this._onKeyDown);
    this._target.addEventListener('keyup', this._onKeyUp);
    // Blur is fired on window; attach to the target if it supports it.
    this._target.addEventListener('blur', this._onBlur);

    // Gamepad connection events fire on window in all engines.
    const w = typeof window !== 'undefined' ? window : null;
    if (w) {
      w.addEventListener('gamepadconnected', this._onGamepadConnected);
      w.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
      // A gamepad may already be connected before we attached the listener.
      this._detectExistingGamepad();
    }
  }

  /** Detach every listener and clear held inputs. Idempotent. */
  stop() {
    if (!this._started || !this._target) return;
    this._started = false;

    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
    this._target.removeEventListener('blur', this._onBlur);

    const w = typeof window !== 'undefined' ? window : null;
    if (w) {
      w.removeEventListener('gamepadconnected', this._onGamepadConnected);
      w.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    }

    this.reset();
  }

  // ---- Event handlers ------------------------------------------------------

  _isEditableTarget(t) {
    // Defensive: never swallow keys destined for a text field / editable node.
    if (!t || typeof t !== 'object') return false;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (t.isContentEditable) return true;
    return false;
  }

  _onKeyDown(e) {
    // Ignore auto-repeat for clean state; held-tracking is enough for movement.
    const code = e.code;
    if (!code) return;

    if (GAME_CODES.has(code) && !this._isEditableTarget(e.target)) {
      // Suppress page scroll / spacebar-scroll / etc. for our game keys.
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }

    // e.repeat events still keep the key in the set (no-op if already present).
    this._keys.add(code);
  }

  _onKeyUp(e) {
    const code = e.code;
    if (!code) return;
    if (GAME_CODES.has(code) && !this._isEditableTarget(e.target)) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
    }
    this._keys.delete(code);
  }

  _onBlur() {
    // Window lost focus: keyup events for held keys will be missed, so clear
    // everything to avoid stuck movement/fire.
    this.reset();
  }

  _onGamepadConnected(e) {
    this._gamepadConnected = true;
    if (e && e.gamepad && typeof e.gamepad.index === 'number') {
      this._activeGamepadIndex = e.gamepad.index;
    }
  }

  _onGamepadDisconnected(e) {
    // If the disconnected pad was our active one, drop it; re-detect on poll.
    if (e && e.gamepad && e.gamepad.index === this._activeGamepadIndex) {
      this._activeGamepadIndex = -1;
    }
    // Recompute connection flag from a fresh poll (another pad may remain).
    const pads = this._getGamepads();
    let any = false;
    for (const p of pads) {
      if (p && p.connected) { any = true; break; }
    }
    this._gamepadConnected = any;
  }

  // ---- Gamepad polling helpers ---------------------------------------------

  /** Safe wrapper around navigator.getGamepads(); returns an array (possibly
   *  with null holes) or an empty array if the API is unavailable. */
  _getGamepads() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return [];
    }
    try {
      const pads = navigator.getGamepads();
      return pads ? pads : [];
    } catch (_err) {
      // Some browsers throw if called from an insecure context, etc.
      return [];
    }
  }

  /** On start(), find any already-connected pad (events may have fired before
   *  we attached our listeners). */
  _detectExistingGamepad() {
    const pads = this._getGamepads();
    for (const p of pads) {
      if (p && p.connected) {
        this._gamepadConnected = true;
        this._activeGamepadIndex = p.index;
        return;
      }
    }
  }

  /** Return the active gamepad object for this frame, or null. Prefers the
   *  tracked active index, otherwise the first connected pad. */
  _pollActiveGamepad() {
    const pads = this._getGamepads();
    if (!pads.length) {
      this._gamepadConnected = false;
      return null;
    }

    // Try the tracked active index first.
    if (this._activeGamepadIndex >= 0) {
      const p = pads[this._activeGamepadIndex];
      if (p && p.connected) {
        this._gamepadConnected = true;
        return p;
      }
    }

    // Fall back to the first connected pad and adopt it.
    for (const p of pads) {
      if (p && p.connected) {
        this._activeGamepadIndex = p.index;
        this._gamepadConnected = true;
        return p;
      }
    }

    this._gamepadConnected = false;
    return null;
  }

  // ---- Per-frame merge ------------------------------------------------------

  /**
   * Poll gamepad, merge all sources into this._state, and compute edge flags.
   * MUST be called exactly once per frame BEFORE reading state.
   */
  update() {
    const keys = this._keys;

    // ---------- Keyboard contributions ----------
    let kMoveX = 0;
    if (this._anyIn(keys, MOVE_LEFT_CODES)) kMoveX -= 1;
    if (this._anyIn(keys, MOVE_RIGHT_CODES)) kMoveX += 1;

    let kMoveY = 0;
    if (this._anyIn(keys, MOVE_UP_CODES)) kMoveY += 1;
    if (this._anyIn(keys, MOVE_DOWN_CODES)) kMoveY -= 1;

    const kFire = this._anyIn(keys, FIRE_CODES);
    const kBomb = this._anyIn(keys, BOMB_CODES);
    const kPause = this._anyIn(keys, PAUSE_CODES);
    const kStart = this._anyIn(keys, START_CODES);
    // Was any tracked game key held this frame (for anyPressed)?
    const kAny = keys.size > 0;

    // ---------- Gamepad contributions ----------
    const pad = this._pollActiveGamepad();

    let gMoveX = 0;
    let gMoveY = 0;
    let gFire = false;
    let gBomb = false;
    let gPause = false;
    let gStart = false;
    let gAny = false;

    if (pad) {
      const axes = pad.axes || [];
      const buttons = pad.buttons || [];

      // Left stick (deadzoned). Stick up = negative -> invert for moveY.
      const lx = applyDeadzone(typeof axes[GP.AXIS_LX] === 'number' ? axes[GP.AXIS_LX] : 0);
      const lyRaw = applyDeadzone(typeof axes[GP.AXIS_LY] === 'number' ? axes[GP.AXIS_LY] : 0);
      gMoveX += lx;
      gMoveY += -lyRaw; // invert: push up -> +moveY

      // D-pad (digital) adds on top of the stick.
      if (btnPressed(buttons, GP.DPAD_LEFT)) gMoveX -= 1;
      if (btnPressed(buttons, GP.DPAD_RIGHT)) gMoveX += 1;
      if (btnPressed(buttons, GP.DPAD_UP)) gMoveY += 1;
      if (btnPressed(buttons, GP.DPAD_DOWN)) gMoveY -= 1;

      const aHeld = btnPressed(buttons, GP.A);
      const rtHeld = btnPressed(buttons, GP.RT);
      const bHeld = btnPressed(buttons, GP.B);
      const xHeld = btnPressed(buttons, GP.X);
      const startHeld = btnPressed(buttons, GP.START);

      gFire = aHeld || rtHeld;
      gBomb = bHeld || xHeld;
      gPause = startHeld;
      gStart = aHeld || startHeld;

      // anyPressed: was ANY button held this frame?
      for (let i = 0; i < buttons.length; i++) {
        if (btnPressed(buttons, i)) { gAny = true; break; }
      }
      // Significant stick deflection also counts as activity.
      if (!gAny && (lx !== 0 || lyRaw !== 0)) gAny = true;
    }

    // ---------- Touch contributions ----------
    const tMoveX = this._touchMoveX;
    const tMoveY = this._touchMoveY;
    const tFire = this._touchFire;
    // Consume latched one-shot touch requests as this-frame edges.
    const tBombReq = this._touchBombReq;
    const tPauseReq = this._touchPauseReq;
    const tStartReq = this._touchStartReq;
    this._touchBombReq = false;
    this._touchPauseReq = false;
    this._touchStartReq = false;

    // ---------- Merge analog movement ----------
    const moveX = clamp1(kMoveX + gMoveX + tMoveX);
    const moveY = clamp1(kMoveY + gMoveY + tMoveY);

    // ---------- Merge held fire ----------
    const fire = !!(kFire || gFire || tFire);

    // ---------- Compute edge flags ----------
    // Logical "held" for each edge action this frame, from keyboard + gamepad.
    // (Touch contributes via its consumed one-shot requests separately.)
    const bombHeld = kBomb || gBomb;
    const pauseHeld = kPause || gPause;
    const startHeldNow = kStart || gStart;

    // An edge fires on the rising transition (held now, not held last frame),
    // OR when a touch one-shot request was latched this frame.
    const bombPressed = (bombHeld && !this._prevBombHeld) || tBombReq;
    const pausePressed = (pauseHeld && !this._prevPauseHeld) || tPauseReq;
    const startPressed = (startHeldNow && !this._prevStartHeld) || tStartReq;

    // anyPressed: any key/button newly went down this frame, OR any touch
    // action was triggered (a tap on any on-screen control dismisses splashes).
    const anyHeldNow = kAny || gAny;
    const touchActivity =
      tBombReq || tPauseReq || tStartReq || tFire ||
      tMoveX !== 0 || tMoveY !== 0;
    const anyPressed = (anyHeldNow && !this._prevAnyHeld) || touchActivity;

    // Update previous-held bookkeeping for next frame.
    this._prevBombHeld = bombHeld;
    this._prevPauseHeld = pauseHeld;
    this._prevStartHeld = startHeldNow;
    this._prevAnyHeld = anyHeldNow;

    // ---------- Commit snapshot ----------
    const s = this._state;
    s.moveX = moveX;
    s.moveY = moveY;
    s.fire = fire;
    s.bombPressed = bombPressed;
    s.pausePressed = pausePressed;
    s.startPressed = startPressed;
    s.anyPressed = anyPressed;
  }

  /** True if any code in `codes` is currently in the held set `keys`. */
  _anyIn(keys, codes) {
    for (const c of codes) {
      if (keys.has(c)) return true;
    }
    return false;
  }

  // ---- Accessors -----------------------------------------------------------

  /** Current normalized snapshot (mutated in place each update()). */
  get state() {
    return this._state;
  }

  /** Whether a gamepad is currently connected. */
  get gamepadConnected() {
    return this._gamepadConnected;
  }

  // ---- Programmatic touch API (on-screen mobile controls call these) -------

  /**
   * Set the touch movement vector.
   * @param {number} x strafe, -1..1 (left -, right +)
   * @param {number} y altitude, -1..1 (down -, up +)
   */
  setTouchMove(x, y) {
    const nx = typeof x === 'number' && Number.isFinite(x) ? x : 0;
    const ny = typeof y === 'number' && Number.isFinite(y) ? y : 0;
    this._touchMoveX = clamp1(nx);
    this._touchMoveY = clamp1(ny);
  }

  /** Set the touch fire button held-state. */
  setTouchFire(bool) {
    this._touchFire = !!bool;
  }

  /** Request a bomb. Latched until the next update() consumes it as an edge. */
  pressTouchBomb() {
    this._touchBombReq = true;
  }

  /** Request a pause toggle. Latched until consumed by the next update(). */
  pressTouchPause() {
    this._touchPauseReq = true;
  }

  /** Request menu confirm / start. Latched until consumed by the next update(). */
  pressTouchStart() {
    this._touchStartReq = true;
  }

  // ---- Reset ----------------------------------------------------------------

  /**
   * Clear all held inputs and pending edges. Call on pause / blur to avoid
   * stuck keys. Does NOT detach listeners (use stop() for that).
   */
  reset() {
    this._keys.clear();

    this._touchMoveX = 0;
    this._touchMoveY = 0;
    this._touchFire = false;
    this._touchBombReq = false;
    this._touchPauseReq = false;
    this._touchStartReq = false;

    // Clear edge bookkeeping so the next update() doesn't synthesize a phantom
    // rising edge from stale "held" state.
    this._prevBombHeld = false;
    this._prevPauseHeld = false;
    this._prevStartHeld = false;
    this._prevAnyHeld = false;

    // Zero the live snapshot too.
    const s = this._state;
    s.moveX = 0;
    s.moveY = 0;
    s.fire = false;
    s.bombPressed = false;
    s.pausePressed = false;
    s.startPressed = false;
    s.anyPressed = false;
  }
}
