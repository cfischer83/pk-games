// =============================================================================
// JETS — HUD controller (DOM overlay)
// =============================================================================
// Owns the in-game heads-up display: lives, bombs, time, score, progress bar,
// transient center messages, and the damage / bomb screen flashes. Pure DOM —
// the 3D game calls these methods; nothing here touches three.js.
// =============================================================================

const JET_ICON = `
<svg viewBox="0 0 24 24" class="life-icon" xmlns="http://www.w3.org/2000/svg">
  <polygon points="12,1 14,9 23,15 14,14 13,21 16,23 8,23 11,21 10,14 1,15 10,9"
    fill="#e9eef5" stroke="#49b6ff" stroke-width="0.6"/>
  <polygon points="12,1 13,9 12,14 11,9" fill="#ff3b3b"/>
</svg>`;

const BOMB_ICON = `
<svg viewBox="0 0 24 24" class="bomb-icon" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="14" r="8" fill="#ffd23f" stroke="#1a1400" stroke-width="1"/>
  <rect x="10.5" y="2" width="3" height="6" fill="#7a8aa0"/>
  <circle cx="12" cy="14" r="3" fill="#fff" opacity="0.5"/>
</svg>`;

export class Hud {
  constructor() {
    this.elLives = document.getElementById('hud-lives');
    this.elBombs = document.getElementById('hud-bombs');
    this.elTime = document.getElementById('hud-time');
    this.elScore = document.getElementById('hud-score');
    this.elProgress = document.getElementById('hud-progress-fill');
    this.elMessage = document.getElementById('hud-message');
    this.elPadHint = document.getElementById('pad-hint');
    this.elTouchBombCount = document.getElementById('touch-bomb-count');
    this.elTouchBombBtn = document.getElementById('touch-bomb');

    // Create the full-screen flash layers if they aren't in the DOM yet.
    this.elDamage = this._ensureFlash('damage-flash');
    this.elBomb = this._ensureFlash('bomb-flash');

    this._msgTimer = 0;
    this._maxLives = 3;
    this._maxBombs = 3;
  }

  _ensureFlash(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
    return el;
  }

  // ---- Setup / per-level reset ---------------------------------------------
  init(maxLives, maxBombs) {
    this._maxLives = maxLives;
    this._maxBombs = maxBombs;
    this.setLives(maxLives);
    this.setBombs(maxBombs);
    this.setScore(0);
    this.setTime(0);
    this.setProgress(0);
    this.hideMessage();
  }

  // ---- Lives ----------------------------------------------------------------
  setLives(n) {
    if (!this.elLives) return;
    let html = '';
    for (let i = 0; i < this._maxLives; i++) {
      html += JET_ICON.replace('class="life-icon"',
        i < n ? 'class="life-icon"' : 'class="life-icon lost"');
    }
    this.elLives.innerHTML = html;
  }

  // ---- Bombs ----------------------------------------------------------------
  setBombs(n) {
    if (this.elBombs) {
      let html = '';
      for (let i = 0; i < this._maxBombs; i++) {
        html += BOMB_ICON.replace('class="bomb-icon"',
          i < n ? 'class="bomb-icon"' : 'class="bomb-icon used"');
      }
      this.elBombs.innerHTML = html;
    }
    if (this.elTouchBombCount) this.elTouchBombCount.textContent = String(n);
    if (this.elTouchBombBtn) this.elTouchBombBtn.classList.toggle('depleted', n <= 0);
  }

  // ---- Numbers --------------------------------------------------------------
  setScore(n) {
    if (this.elScore) this.elScore.textContent = String(Math.max(0, Math.round(n)));
  }

  setTime(seconds) {
    if (!this.elTime) return;
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    this.elTime.textContent = `${m}:${r < 10 ? '0' : ''}${r}`;
  }

  setProgress(frac) {
    if (this.elProgress) {
      const pct = Math.max(0, Math.min(1, frac)) * 100;
      this.elProgress.style.width = pct + '%';
    }
  }

  // ---- Center message -------------------------------------------------------
  showMessage(text, opts = {}) {
    if (!this.elMessage) return;
    this.elMessage.textContent = text;
    this.elMessage.classList.toggle('danger', !!opts.danger);
    this.elMessage.classList.add('show');
    this._msgTimer = opts.duration != null ? opts.duration : 2.0;
  }

  hideMessage() {
    if (this.elMessage) this.elMessage.classList.remove('show');
    this._msgTimer = 0;
  }

  /** Called each frame with dt to time out transient messages. */
  update(dt) {
    if (this._msgTimer > 0) {
      this._msgTimer -= dt;
      if (this._msgTimer <= 0) this.hideMessage();
    }
  }

  // ---- Flashes --------------------------------------------------------------
  damageFlash() {
    this._retrigger(this.elDamage, 'flash');
  }
  bombFlash() {
    this._retrigger(this.elBomb, 'flash');
  }
  _retrigger(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    // force reflow so the animation restarts even if re-triggered quickly
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // ---- Gamepad hint ---------------------------------------------------------
  showPadHint(show) {
    if (this.elPadHint) this.elPadHint.classList.toggle('show', !!show);
  }
}
