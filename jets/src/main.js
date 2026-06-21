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
import { STORE } from './config.js';
import { LEVELS } from './levels.js';

const App = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const audio = new AudioEngine();
const input = new InputManager({ target: window });
const hud = new Hud();

const sceneRoot = document.getElementById('scene-root');
let appState = App.MENU;
let helpOpen = false;
let currentLevel = 0;
let rafId = 0;
let padHintShown = false;
let padHintTimer = 0;
// Briefly ignore "confirm" input right after the game-over screen appears so a
// fire/bomb key still held from dying can't instantly skip the screen.
let gameoverReady = false;

const game = new Game({
  container: sceneRoot,
  audio,
  hud,
  onGameOver: handleGameOver,
});

input.start();

// ---- Preferences (music / sfx) -------------------------------------------
let musicEnabled = readBool(STORE.MUSIC, true);
let sfxEnabled = readBool(STORE.SFX, true);
audio.setMusicEnabled(musicEnabled);
audio.setSfxEnabled(sfxEnabled);
// NOTE: reflectToggles()/updateBestTime() touch the `el` DOM helper, which is a
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
el('btn-again').addEventListener('click', () => { audio.uiSelect(); startGame(); });
el('btn-go-menu').addEventListener('click', () => { audio.uiSelect(); quitToMenu(); });

// Now that `el` and the buttons exist, paint initial toggle/best-time state.
reflectToggles();
updateBestTime();

// ---------------------------------------------------------------------------
// Audio unlock — must happen inside a user gesture
// ---------------------------------------------------------------------------
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audio.resume();
}
// Backup unlock on the very first interaction anywhere.
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

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
  game.start(currentLevel);
  if (musicEnabled) audio.startMusic();
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
  game.toAttract();
  updateBestTime();
}

function handleGameOver(win, stats) {
  appState = App.GAMEOVER;
  setBodyState('gameover');
  // Swallow any input held from the death moment; re-arm "confirm" after a beat.
  input.reset();
  gameoverReady = false;
  setTimeout(() => { gameoverReady = true; }, 650);
  // persist best survival time
  const best = saveBest(stats.timeSurvived);
  el('go-title').textContent = win ? 'SECTOR CLEAR!' : 'MISSION FAILED';
  el('go-title').style.color = win ? 'var(--c-green)' : 'var(--c-red)';
  el('go-stats').innerHTML =
    `SURVIVED: ${fmtTime(stats.timeSurvived)}<br>` +
    `SCORE: ${stats.score}<br>` +
    (win ? `BONUS LIVES: ${stats.livesLeft}<br>` : '') +
    `BEST: ${fmtTime(best)}`;
  el('btn-again').textContent = win ? 'NEXT RUN' : 'FLY AGAIN';
  show(elGameOver);
}

function openHelp() { helpOpen = true; show(elHelp); audio.uiSelect(); }
function closeHelp() { helpOpen = false; hide(elHelp); }

// ---------------------------------------------------------------------------
// Best time
// ---------------------------------------------------------------------------
function saveBest(t) {
  let best = 0;
  try { best = parseFloat(localStorage.getItem(STORE.BEST) || '0') || 0; } catch (_e) {}
  if (t > best) { best = t; try { localStorage.setItem(STORE.BEST, String(best)); } catch (_e) {} }
  return best;
}
function updateBestTime() {
  let best = 0;
  try { best = parseFloat(localStorage.getItem(STORE.BEST) || '0') || 0; } catch (_e) {}
  const span = el('best-time');
  if (span) span.textContent = best > 0 ? fmtTime(best) : '--';
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const m = Math.floor(s / 60), r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

// ---------------------------------------------------------------------------
// Master loop — the ONLY place input.update() is called
// ---------------------------------------------------------------------------
function loop(now) {
  rafId = requestAnimationFrame(loop);
  input.update();
  const s = input.state;

  updatePadHint(s);

  switch (appState) {
    case App.MENU:
      if (!helpOpen && s.startPressed) { unlockAudio(); startGame(); }
      break;
    case App.PLAYING:
      if (s.pausePressed) { pauseGame(); break; }
      break;
    case App.PAUSED:
      if (s.pausePressed || s.startPressed) { resumeGame(); }
      break;
    case App.GAMEOVER:
      if (gameoverReady && s.startPressed) { startGame(); }
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
  game.resize();
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
game.toAttract();
setBodyState('menu');
hide(elLoading);
