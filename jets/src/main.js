// =============================================================================
// JETS — bootstrap / app shell
// =============================================================================
// Owns: the single requestAnimationFrame master loop, the InputManager (the one
// place input.update() is called), the AudioEngine lifecycle (unlock on gesture,
// music/sfx toggles persisted to localStorage), the menu/help/pause/gameover
// flow, on-screen touch controls, and orientation handling.
// =============================================================================

import { AudioEngine } from './audio.js';
import { InputManager } from './input.js';
import { Hud } from './hud.js';
import { Game } from './game.js';
import { Gallery, getEditableColors } from './gallery.js';
import { STORE, PALETTE } from './config.js';
import { LEVELS } from './levels.js';

const App = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover', GALLERY: 'gallery' };

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const audio = new AudioEngine();
const input = new InputManager({ target: window });
const hud = new Hud();

const sceneRoot = document.getElementById('scene-root');
let appState = App.MENU;
let helpOpen = false;
let debugOpen = false;
let currentLevel = 0;
let rafId = 0;
let padHintShown = false;
let padHintTimer = 0;
// On the game-over screen: index of the next sector to advance to ('NEXT
// SECTOR'), or null to replay the current one ('FLY AGAIN').
let goNextIndex = null;
// Briefly ignore "confirm" input right after the game-over screen appears so a
// fire/bomb key still held from dying can't instantly skip the screen.
let gameoverReady = false;

const game = new Game({
  container: sceneRoot,
  audio,
  hud,
  onGameOver: handleGameOver,
});

// Debug asset gallery — one per theme, lazily built on first open; all share
// the game's single renderer.
const galleries = { city: null, canyon: null };
let activeGallery = null;
let galleryColorsTheme = null;

input.start();

// ---- Preferences (music / sfx) -------------------------------------------
let musicEnabled = readBool(STORE.MUSIC, true);
let sfxEnabled = readBool(STORE.SFX, true);
audio.setMusicEnabled(musicEnabled);
audio.setSfxEnabled(sfxEnabled);
// NOTE: reflectToggles()/refreshMenu() touch the `el` DOM helper, which is a
// `const` declared below — they are called after that section to avoid the TDZ.

function readBool(key, dflt) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? dflt : v === 'true';
  } catch (_e) { return dflt; }
}
function writeBool(key, val) {
  try { localStorage.setItem(key, val ? 'true' : 'false'); } catch (_e) {}
}

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------
const el = (id) => document.getElementById(id);
const elMenu = el('menu'), elHelp = el('help'), elPause = el('pause');
const elGameOver = el('gameover'), elLoading = el('loading');

// menu buttons
el('btn-start').addEventListener('click', () => { unlockAudio(); startGame(); });
el('btn-music').addEventListener('click', () => { unlockAudio(); toggleMusic(); });
el('btn-sfx').addEventListener('click', () => { unlockAudio(); toggleSfx(); });
el('btn-help').addEventListener('click', () => { unlockAudio(); openHelp(); });
el('btn-help-close').addEventListener('click', () => { audio.uiSelect(); closeHelp(); });

// pause buttons
el('btn-resume').addEventListener('click', () => { audio.uiSelect(); resumeGame(); });
el('btn-pause-music').addEventListener('click', () => toggleMusic());
el('btn-pause-sfx').addEventListener('click', () => toggleSfx());
el('btn-quit').addEventListener('click', () => { audio.uiSelect(); quitToMenu(); });

// gameover buttons
el('btn-again').addEventListener('click', () => { audio.uiSelect(); flyAgainOrNext(); });
el('btn-go-menu').addEventListener('click', () => { audio.uiSelect(); quitToMenu(); });

// debug dialog + gallery
const elDebug = el('debug-dialog');
const elGalleryUI = el('gallery-ui');
buildDebugLevels();               // one "GALLERY: SECTOR n" button per level
el('btn-debug-close').addEventListener('click', () => { audio.uiSelect(); debugOpen = false; hide(elDebug); });
el('gx-back').addEventListener('click', () => { audio.uiSelect(); exitGallery(); });
elGalleryUI.querySelectorAll('.gx-btn').forEach((b) => {
  b.addEventListener('click', () => {
    if (!activeGallery) return;
    const a = b.dataset.action;
    if (a === 'firePlayer') activeGallery.firePlayer();
    else if (a === 'fireEnemy') activeGallery.fireEnemy();
    else activeGallery.explode(a);          // 'small' | 'big' | 'bomb' | 'muzzle'
  });
});

// Ctrl+D on the main menu opens the debug dialog.
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && (e.code === 'KeyD' || e.key === 'd' || e.key === 'D')) {
    if (appState === App.MENU && !helpOpen) {
      e.preventDefault();
      debugOpen = true;
      show(elDebug);
    }
  }
});

// Now that `el` and the buttons exist, paint initial toggle + menu/level state.
reflectToggles();
refreshMenu();

// ---------------------------------------------------------------------------
// Audio unlock — must happen inside a user gesture
// ---------------------------------------------------------------------------
// audio.resume() is idempotent and a no-op once the context is running, so we
// just call it on any interaction. Not latched on a flag: a gamepad press that
// a browser doesn't count as a user-activation gesture won't permanently block
// a later real gesture (mouse/key/touch) from unlocking audio.
function unlockAudio() { audio.resume(); }
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// ---------------------------------------------------------------------------
// Toggles
// ---------------------------------------------------------------------------
function toggleMusic() {
  musicEnabled = !musicEnabled;
  audio.setMusicEnabled(musicEnabled);
  writeBool(STORE.MUSIC, musicEnabled);
  if (musicEnabled && (appState === App.PLAYING || appState === App.PAUSED)) audio.startMusic();
  reflectToggles();
  audio.uiSelect();
}
function toggleSfx() {
  sfxEnabled = !sfxEnabled;
  audio.setSfxEnabled(sfxEnabled);
  writeBool(STORE.SFX, sfxEnabled);
  reflectToggles();
  if (sfxEnabled) audio.uiSelect();
}
function reflectToggles() {
  setToggle('btn-music', 'MUSIC', musicEnabled);
  setToggle('btn-pause-music', 'MUSIC', musicEnabled);
  setToggle('btn-sfx', 'SFX', sfxEnabled);
  setToggle('btn-pause-sfx', 'SFX', sfxEnabled);
}
function setToggle(id, label, on) {
  const b = el(id);
  if (!b) return;
  b.textContent = `${label}: ${on ? 'ON' : 'OFF'}`;
  b.dataset.on = on ? 'true' : 'false';
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------
function setBodyState(state) {
  document.body.classList.remove('state-menu', 'state-playing', 'state-paused', 'state-gameover');
  document.body.classList.add('state-' + state);
}
function show(elm) { elm.classList.remove('hidden'); }
function hide(elm) { elm.classList.add('hidden'); }

function startGame() {
  hide(elMenu); hide(elGameOver); hide(elPause); closeHelp();
  input.reset();          // start neutral; held keys re-assert via keydown
  appState = App.PLAYING;
  setBodyState('playing');
  const lvl = LEVELS[currentLevel] || LEVELS[0];
  game.start(currentLevel);
  if (musicEnabled) audio.startMusic();
  sendAnalytics('start', lvl ? lvl.id : 1, 0);
}

/** Report a game event to GA4 via the page's pkAnalytics(action, level, score). */
function sendAnalytics(action, level, score) {
  try { if (typeof window.pkAnalytics === 'function') window.pkAnalytics(action, level, Math.round(score) || 0); }
  catch (_e) {}
}

function pauseGame() {
  if (appState !== App.PLAYING) return;
  appState = App.PAUSED;
  setBodyState('paused');
  game.pause();
  // NOTE: deliberately NOT calling input.reset() here. The sim is frozen while
  // paused, so held movement keys do nothing; keeping edge-tracking intact means
  // a held P can't synthesize a phantom resume edge (it needs release + repress).
  show(elPause);
  audio.uiSelect();
}

function resumeGame() {
  if (appState !== App.PAUSED) return;
  appState = App.PLAYING;
  setBodyState('playing');
  hide(elPause);
  game.resume();
}

function quitToMenu() {
  appState = App.MENU;
  setBodyState('menu');
  hide(elPause); hide(elGameOver);
  show(elMenu);
  audio.stopMusic();
  refreshMenu();                 // rebuild sector list (picks up new unlocks)
  game.toAttract(currentLevel);  // preview the selected sector's theme
}

// ---- Debug asset gallery (per theme) --------------------------------------
function enterGallery(theme = 'city') {
  debugOpen = false;
  hide(elDebug); hide(elMenu);
  input.reset();                 // clear the Ctrl+D keys so the jet doesn't drift
  appState = App.GALLERY;
  setBodyState('gallery');
  if (!galleries[theme]) galleries[theme] = new Gallery({ renderer: game.renderer, audio, theme });
  activeGallery = galleries[theme];
  if (galleryColorsTheme !== theme) { buildGalleryColors(theme); galleryColorsTheme = theme; }
  activeGallery.start();
  show(elGalleryUI);
}

function exitGallery() {
  appState = App.MENU;
  setBodyState('menu');
  hide(elGalleryUI);
  if (activeGallery) activeGallery.stop();
  show(elMenu);
  game.toAttract(currentLevel);  // resume the attract backdrop behind the menu
}

/** Build a "GALLERY: SECTOR n — NAME" button per level into the debug dialog. */
function buildDebugLevels() {
  const root = el('debug-levels');
  root.innerHTML = '';
  LEVELS.forEach((lvl) => {
    const b = document.createElement('button');
    b.className = 'btn btn-primary';
    b.textContent = `🎨 SECTOR ${lvl.id} — ${lvl.name}`;
    b.addEventListener('click', () => { unlockAudio(); enterGallery(lvl.theme); });
    root.appendChild(b);
  });
}

function buildGalleryColors(theme) {
  const root = el('gx-colors');
  root.innerHTML = '';
  const toHex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);
  for (const grp of getEditableColors(theme)) {
    const h = document.createElement('div');
    h.className = 'gx-group-title';
    h.textContent = grp.group;
    root.appendChild(h);
    for (const [key, label] of grp.items) {
      const row = document.createElement('label');
      row.className = 'gx-color-row';
      const span = document.createElement('span');
      span.textContent = label;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = toHex(PALETTE[key] != null ? PALETTE[key] : 0xffffff);
      input.addEventListener('input', () => {
        if (activeGallery) activeGallery.setColor(key, parseInt(input.value.slice(1), 16));
      });
      row.appendChild(span);
      row.appendChild(input);
      root.appendChild(row);
    }
  }
}

function handleGameOver(win, stats) {
  appState = App.GAMEOVER;
  setBodyState('gameover');
  // Swallow any input held from the death moment; re-arm "confirm" after a beat.
  input.reset();
  gameoverReady = false;
  setTimeout(() => { gameoverReady = true; }, 650);
  // persist per-level high score + report the result to analytics
  const levelId = (stats.level && stats.level.id) || 1;
  const hi = saveHiScore(levelId, stats.score);
  sendAnalytics(win ? 'win' : 'lose', levelId, stats.score);

  // Clearing a sector unlocks the next one. Offer 'NEXT SECTOR' on a win if a
  // further (now-unlocked) level exists; otherwise replay the current one.
  let nextLabel;
  if (win) {
    markCleared(levelId);
    const next = currentLevel + 1;
    if (next < LEVELS.length) { goNextIndex = next; nextLabel = 'NEXT SECTOR ▸'; }
    else { goNextIndex = null; nextLabel = 'PLAY AGAIN'; }
  } else {
    goNextIndex = null; nextLabel = 'FLY AGAIN';
  }

  el('go-title').textContent = win ? 'SECTOR CLEAR!' : 'MISSION FAILED';
  el('go-title').style.color = win ? 'var(--c-green)' : 'var(--c-red)';
  el('go-stats').innerHTML =
    `SCORE: ${stats.score}<br>` +
    (win ? `BONUS LIVES: ${stats.livesLeft}<br>` : '') +
    (hi.isNew ? `<span class="new-hi">★ NEW HIGH SCORE ★</span>`
              : `HIGH SCORE: ${hi.best}`);
  el('btn-again').textContent = nextLabel;
  show(elGameOver);
}

/** Game-over primary button: advance to the unlocked next sector, or replay. */
function flyAgainOrNext() {
  if (goNextIndex != null) currentLevel = goNextIndex;
  startGame();
}

function openHelp() { helpOpen = true; show(elHelp); audio.uiSelect(); }
function closeHelp() { helpOpen = false; hide(elHelp); }

// ---------------------------------------------------------------------------
// Per-level high score (points) — the only stat we surface in menus
// ---------------------------------------------------------------------------
function hiScoreKey(levelId) { return `${STORE.HISCORE}.${levelId}`; }
function getHiScore(levelId) {
  try { return parseInt(localStorage.getItem(hiScoreKey(levelId)) || '0', 10) || 0; } catch (_e) { return 0; }
}
function saveHiScore(levelId, score) {
  const s = Math.round(score);
  const prev = getHiScore(levelId);
  if (s > prev) {
    try { localStorage.setItem(hiScoreKey(levelId), String(s)); } catch (_e) {}
    return { best: s, isNew: true };
  }
  return { best: prev, isNew: false };
}

// ---------------------------------------------------------------------------
// Progression — clearing a sector unlocks the next (persisted in localStorage)
// ---------------------------------------------------------------------------
function clearedKey(levelId) { return `${STORE.CLEARED}.${levelId}`; }
function isCleared(levelId) {
  try { return localStorage.getItem(clearedKey(levelId)) === 'true'; } catch (_e) { return false; }
}
function markCleared(levelId) {
  try { localStorage.setItem(clearedKey(levelId), 'true'); } catch (_e) {}
}
/** A sector is unlocked if it's the first, or the previous sector was cleared. */
function isUnlocked(index) {
  if (index <= 0) return true;
  const prev = LEVELS[index - 1];
  return prev ? isCleared(prev.id) : false;
}
function unlockedCount() {
  let n = 0;
  for (let i = 0; i < LEVELS.length; i++) if (isUnlocked(i)) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Main-menu sector picker
// ---------------------------------------------------------------------------
// Until a second sector is unlocked, the menu keeps its single START button.
// Once you can choose, the START button is replaced by a list of buttons for the
// UNLOCKED sectors only — locked sectors aren't shown at all until you earn them.
function refreshMenu() {
  const list = el('sector-list');
  const startBtn = el('btn-start');
  let highest = 0;
  for (let i = 0; i < LEVELS.length; i++) if (isUnlocked(i)) highest = i;

  if (unlockedCount() <= 1) {
    // Single sector: keep the START button, and carry its high score on it so
    // the score is always tied to a level (no ambiguous generic readout).
    show(startBtn);
    hide(list);
    currentLevel = 0;
    const hi1 = getHiScore((LEVELS[0] && LEVELS[0].id) || 1);
    startBtn.textContent = hi1 > 0 ? `START · HI ${hi1}` : 'START MISSION';
  } else {
    hide(startBtn);
    show(list);
    list.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      if (!isUnlocked(i)) return;            // hide locked sectors entirely
      const hs = getHiScore(lvl.id);
      const b = document.createElement('button');
      b.className = 'btn sector-btn';
      b.innerHTML = `<span class="sector-name">LEVEL ${lvl.id}: ${lvl.name}</span>` +
                    (hs > 0 ? `<span class="sector-hi">HI ${hs}</span>` : '');
      b.addEventListener('click', () => launchLevel(i));
      list.appendChild(b);
    });
    currentLevel = highest;
  }
}

/** Select + immediately start a sector from the menu picker. */
function launchLevel(i) {
  unlockAudio();
  currentLevel = i;
  startGame();
}

// ---------------------------------------------------------------------------
// Gamepad menu navigation
// ---------------------------------------------------------------------------
// A focus ring is shown ONLY when the controller is the active input device
// (body.gamepad-active). Mouse/keyboard/touch use restores the normal look.
let usingGamepad = false;
let navOverlayEl = null;
let navButtons = [];
let navIndex = 0;

function setUsingGamepad(on) {
  if (usingGamepad === on) return;
  usingGamepad = on;
  document.body.classList.toggle('gamepad-active', on);
}

/** The overlay currently accepting menu navigation, or null (gameplay/gallery). */
function currentOverlay() {
  if (appState === App.MENU) {
    if (debugOpen) return elDebug;
    if (helpOpen) return elHelp;
    return elMenu;
  }
  if (appState === App.PAUSED) return elPause;
  if (appState === App.GAMEOVER) return elGameOver;
  return null;
}

function refreshNav() {
  const ov = currentOverlay();
  if (ov === navOverlayEl) return;
  navButtons.forEach((b) => b.classList.remove('gp-focus'));   // clear old overlay
  navOverlayEl = ov;
  navButtons = ov
    ? Array.from(ov.querySelectorAll('button')).filter((b) => b.offsetParent !== null && !b.disabled)
    : [];
  navIndex = 0;
  applyFocus();
}
function applyFocus() {
  navButtons.forEach((b, i) => b.classList.toggle('gp-focus', i === navIndex));
}
function moveFocus(delta) {
  if (!navButtons.length) return;
  navIndex = (navIndex + delta + navButtons.length) % navButtons.length;
  applyFocus();
  audio.uiMove();
}
function activateFocus() {
  const b = navButtons[navIndex];
  if (b) b.click();
}
function menuBack() {
  if (debugOpen) { debugOpen = false; hide(elDebug); }
  else if (helpOpen) { closeHelp(); }
  else if (appState === App.PAUSED) { resumeGame(); }
  else if (appState === App.GAMEOVER && gameoverReady) { quitToMenu(); }
}

// Switching back to mouse/keyboard hides the controller focus ring.
window.addEventListener('pointerdown', () => setUsingGamepad(false));
window.addEventListener('pointermove', () => setUsingGamepad(false));
window.addEventListener('keydown', () => setUsingGamepad(false));

// ---------------------------------------------------------------------------
// Master loop — the ONLY place input.update() is called
// ---------------------------------------------------------------------------
function loop(now) {
  rafId = requestAnimationFrame(loop);
  input.update();
  const s = input.state;

  updatePadHint(s);
  if (s.gamepadActivity) setUsingGamepad(true);

  // Gallery owns the canvas while active; the game does not render.
  if (appState === App.GALLERY && activeGallery) { activeGallery.frame(now, s); return; }

  // ---- Gamepad menu navigation (when a menu overlay is up) ----
  refreshNav();
  // On the game-over screen, ignore controller input until it's armed (so a
  // mashed A from dying can't instantly skip the screen) — mirrors the keyboard.
  const navLocked = appState === App.GAMEOVER && !gameoverReady;
  if (navOverlayEl && !navLocked) {
    if (s.navUp || s.navLeft) moveFocus(-1);
    if (s.navDown || s.navRight) moveFocus(1);
    if (s.menuConfirm) { unlockAudio(); activateFocus(); }
    if (s.menuBack) menuBack();
  }

  switch (appState) {
    case App.MENU:
      // Keyboard shortcut (Enter/Space) only when NOT navigating by controller,
      // so a gamepad A press activates the focused item instead of force-starting.
      if (!usingGamepad && !helpOpen && !debugOpen && s.startPressed) { unlockAudio(); startGame(); }
      break;
    case App.PLAYING:
      if (s.pausePressed) { pauseGame(); break; }
      break;
    case App.PAUSED:
      if (s.pausePressed) { resumeGame(); }            // Start always toggles
      else if (!usingGamepad && s.startPressed) { resumeGame(); }
      break;
    case App.GAMEOVER:
      if (!usingGamepad && gameoverReady && s.startPressed) { startGame(); }
      break;
  }

  // The game always renders (attract backdrop in menu/gameover, live when playing).
  game.frame(now, s);
}
rafId = requestAnimationFrame(loop);

function updatePadHint(s) {
  const connected = input.gamepadConnected;
  if (connected && !padHintShown) {
    padHintShown = true;
    padHintTimer = 3.0;
    hud.showPadHint(true);
  }
  if (padHintTimer > 0) {
    padHintTimer -= 1 / 60;
    if (padHintTimer <= 0) hud.showPadHint(false);
  }
}

// ---------------------------------------------------------------------------
// Resize + orientation
// ---------------------------------------------------------------------------
function onResize() {
  game.resize();          // also updates the shared renderer's size
  for (const k in galleries) { if (galleries[k]) galleries[k].resize(); }
  updateOrientation();
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));

const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
if (isTouch) document.body.classList.add('touch-device');

function updateOrientation() {
  if (!isTouch) return;
  const portrait = window.innerHeight > window.innerWidth;
  document.body.classList.toggle('portrait', portrait);
}
updateOrientation();

// ---------------------------------------------------------------------------
// Touch controls
// ---------------------------------------------------------------------------
if (isTouch) setupTouchControls();

function setupTouchControls() {
  const joy = el('joystick');
  const knob = el('joystick-knob');
  const fireBtn = el('touch-fire');
  const bombBtn = el('touch-bomb');
  const pauseBtn = el('touch-pause');

  // --- Joystick ---
  let joyId = null;
  const maxR = 37;   // knob travel radius (px)

  function joyStart(e) {
    const t = primaryTouch(e);
    joyId = t.id;
    joy.classList.add('active');
    joyMove(e);
    e.preventDefault();
  }
  function joyMove(e) {
    if (joyId == null) return;
    const t = findTouch(e, joyId);
    if (!t) return;
    const rect = joy.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = t.x - cx;
    let dy = t.y - cy;
    const len = Math.hypot(dx, dy);
    if (len > maxR) { dx = dx / len * maxR; dy = dy / len * maxR; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    // screen y-down -> altitude up positive
    input.setTouchMove(dx / maxR, -dy / maxR);
    e.preventDefault();
  }
  function joyEnd(e) {
    if (joyId != null && hasTouch(e, joyId) === false && e.type !== 'pointerup' && e.type !== 'mouseup') {
      // not our pointer ending
    }
    joyId = null;
    joy.classList.remove('active');
    knob.style.transform = 'translate(0px, 0px)';
    input.setTouchMove(0, 0);
  }

  bindPointer(joy, joyStart, joyMove, joyEnd);

  // --- Fire (held) ---
  bindHold(fireBtn,
    () => { input.setTouchFire(true); fireBtn.classList.add('pressed'); },
    () => { input.setTouchFire(false); fireBtn.classList.remove('pressed'); });

  // --- Bomb (edge) ---
  bindTap(bombBtn, () => { input.pressTouchBomb(); flash(bombBtn); });

  // --- Pause (edge) ---
  bindTap(pauseBtn, () => { input.pressTouchPause(); });
}

// Pointer/touch helpers ------------------------------------------------------
function primaryTouch(e) {
  if (e.changedTouches && e.changedTouches.length) {
    const t = e.changedTouches[0];
    return { id: t.identifier, x: t.clientX, y: t.clientY };
  }
  return { id: e.pointerId != null ? e.pointerId : 'mouse', x: e.clientX, y: e.clientY };
}
function findTouch(e, id) {
  if (e.touches) {
    for (const t of e.touches) if (t.identifier === id) return { x: t.clientX, y: t.clientY };
    return null;
  }
  return { x: e.clientX, y: e.clientY };
}
function hasTouch(e, id) {
  if (e.touches) {
    for (const t of e.touches) if (t.identifier === id) return true;
    return false;
  }
  return true;
}

function bindPointer(elm, onStart, onMove, onEnd) {
  // Prefer touch events for multi-touch fidelity; fall back to pointer events.
  if ('ontouchstart' in window) {
    elm.addEventListener('touchstart', onStart, { passive: false });
    elm.addEventListener('touchmove', onMove, { passive: false });
    elm.addEventListener('touchend', onEnd, { passive: false });
    elm.addEventListener('touchcancel', onEnd, { passive: false });
  } else {
    elm.addEventListener('pointerdown', (e) => { elm.setPointerCapture(e.pointerId); onStart(e); });
    elm.addEventListener('pointermove', onMove);
    elm.addEventListener('pointerup', onEnd);
    elm.addEventListener('pointercancel', onEnd);
  }
}
function bindHold(elm, onDown, onUp) {
  if ('ontouchstart' in window) {
    elm.addEventListener('touchstart', (e) => { onDown(); e.preventDefault(); }, { passive: false });
    elm.addEventListener('touchend', (e) => { onUp(); e.preventDefault(); }, { passive: false });
    elm.addEventListener('touchcancel', () => onUp(), { passive: false });
  } else {
    elm.addEventListener('pointerdown', (e) => { elm.setPointerCapture(e.pointerId); onDown(); });
    elm.addEventListener('pointerup', onUp);
    elm.addEventListener('pointercancel', onUp);
    elm.addEventListener('pointerleave', onUp);
  }
}
function bindTap(elm, onTap) {
  if ('ontouchstart' in window) {
    elm.addEventListener('touchstart', (e) => { onTap(); e.preventDefault(); }, { passive: false });
  } else {
    elm.addEventListener('pointerdown', (e) => { onTap(); e.preventDefault(); });
  }
}
function flash(elm) {
  elm.classList.add('pressed');
  setTimeout(() => elm.classList.remove('pressed'), 120);
}

// ---------------------------------------------------------------------------
// Reveal — start in attract mode behind the menu
// ---------------------------------------------------------------------------
refreshMenu();
game.toAttract(currentLevel);
setBodyState('menu');
hide(elLoading);
