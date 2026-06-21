// =============================================================================
// JETS — AUDIO ENGINE (fully synthesized retro chiptune + SFX)
// =============================================================================
// Pure Web Audio API. No audio files. Everything is generated at runtime from
// oscillators, a shared white-noise buffer, gain envelopes and filters.
//
// Architecture / signal flow:
//
//   [music voices] --> musicBus --\
//                                  +--> masterGain --> compressor --> destination
//   [sfx voices]   --> sfxBus   --/
//
// - masterGain / compressor protect the mix from clipping.
// - musicBus and sfxBus are separate so enable/disable toggles are clean and
//   never touch each other.
// - The music is driven by a lookahead scheduler (setInterval + currentTime),
//   NOT setTimeout chains, so it loops seamlessly and stays sample-accurate.
// - SFX are voice-capped (AUDIO.MAX_SFX_VOICES); excess simultaneous SFX are
//   dropped so rapid auto-fire cannot pile up and clip.
//
// Every public method is defensive: safe to call before resume(), while the
// context is suspended, or after dispose() — it simply no-ops instead of
// throwing.
// =============================================================================

import { AUDIO } from './config.js';

// Resolve a cross-browser AudioContext constructor (webkit prefix fallback).
const AudioContextCtor =
  (typeof window !== 'undefined' &&
    (window.AudioContext || window.webkitAudioContext)) ||
  null;

// ---- Musical helpers -------------------------------------------------------
// Equal-temperament frequency from a MIDI note number (A4 = 69 = 440 Hz).
function mtof(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Tiny note-name -> MIDI map for composing the loop readably.
// Octave numbers follow the scientific convention (middle C = C4 = 60).
const NOTE = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};
function n(name, octave) {
  return (NOTE[name] ?? 0) + (octave + 1) * 12; // C4 -> 60
}

// =============================================================================
// The chiptune loop — A minor, heroic/driving arcade feel.
// 8 bars, 4/4. Step grid = 16th notes (4 steps per beat, 16 per bar).
// Built once at construction (pure data) and reused every loop iteration.
// =============================================================================
function buildScore() {
  const C4 = (name, oct) => n(name, oct);

  // ---- BASS: one driving root-fifth pattern per chord, 8th-note pulse ----
  // Chord progression (i - VI - III - VII, classic heroic minor):
  //   Am  -  F  -  C  -  G   (two bars each)  => 8 bars total
  // Bass plays root, root, fifth, root pattern on the beat (8th notes).
  const bassRoots = [
    ['A', 2], ['A', 2], // bars 1-2  Am
    ['F', 2], ['F', 2], // bars 3-4  F
    ['C', 3], ['C', 3], // bars 5-6  C
    ['G', 2], ['G', 2], // bars 7-8  G
  ];
  const bassFifthOffset = 7; // perfect fifth above the root

  const bass = [];
  for (let bar = 0; bar < 8; bar++) {
    const [rn, ro] = bassRoots[bar];
    const root = C4(rn, ro);
    const fifth = root + bassFifthOffset;
    // 8th-note groove: R R R 5  R R 5 R  (8 eighth notes / bar)
    const pat = [root, root, root, fifth, root, root, fifth, root];
    for (let i = 0; i < 8; i++) {
      bass.push({ bar, step: i * 2, dur: 1.8, midi: pat[i] });
    }
  }

  // ---- LEAD: bright pulse arpeggio/melody over the chords ----
  // Each chord gets an arpeggiated/melodic figure. step is in 16ths (0..15).
  // We layer a memorable rising hook that resolves at the end.
  const chordTones = [
    // Am: A C E ; F: F A C ; C: C E G ; G: G B D
    [C4('A', 4), C4('C', 5), C4('E', 5), C4('A', 5)],
    [C4('F', 4), C4('A', 4), C4('C', 5), C4('F', 5)],
    [C4('C', 5), C4('E', 5), C4('G', 5), C4('C', 6)],
    [C4('G', 4), C4('B', 4), C4('D', 5), C4('G', 5)],
  ];
  // Map 8 bars -> 4 chords (2 bars each).
  const barChord = [0, 0, 1, 1, 2, 2, 3, 3];

  const lead = [];
  for (let bar = 0; bar < 8; bar++) {
    const ct = chordTones[barChord[bar]];
    const odd = bar % 2 === 1; // second bar of each chord = variation
    if (!odd) {
      // Bar A: ascending 16th-note arpeggio up the chord, then octave ping.
      const seq = [ct[0], ct[1], ct[2], ct[3], ct[2], ct[1], ct[2], ct[3]];
      for (let i = 0; i < 8; i++) {
        lead.push({ bar, step: i * 2, dur: 1.7, midi: seq[i] });
      }
    } else {
      // Bar B: a syncopated hook landing on the high tone, a touch of swagger.
      lead.push({ bar, step: 0, dur: 3.4, midi: ct[3] });
      lead.push({ bar, step: 4, dur: 1.7, midi: ct[2] });
      lead.push({ bar, step: 6, dur: 1.7, midi: ct[3] });
      lead.push({ bar, step: 8, dur: 3.4, midi: ct[3] + 2 });
      lead.push({ bar, step: 12, dur: 1.7, midi: ct[2] });
      lead.push({ bar, step: 14, dur: 1.7, midi: ct[1] });
    }
  }

  // ---- PERCUSSION: kick / snare / hat on the 16th grid ----
  // 'k' kick, 's' snare, 'h' hat. Four-on-the-floor with backbeat + hats.
  const drums = [];
  for (let bar = 0; bar < 8; bar++) {
    // kick on beats 1 & 3 (steps 0, 8) plus a pickup before beat 1 of next.
    drums.push({ bar, step: 0, type: 'k' });
    drums.push({ bar, step: 8, type: 'k' });
    if (bar % 2 === 1) drums.push({ bar, step: 14, type: 'k' }); // fill pickup
    // snare backbeat on beats 2 & 4 (steps 4, 12).
    drums.push({ bar, step: 4, type: 's' });
    drums.push({ bar, step: 12, type: 's' });
    // hats on every 8th (offbeat shimmer), with closed/open feel via gain.
    for (let i = 0; i < 16; i += 2) drums.push({ bar, step: i, type: 'h' });
  }

  return { bass, lead, drums, bars: 8, stepsPerBar: 16 };
}

// =============================================================================
export class AudioEngine {
  constructor() {
    // --- public-ish state (do NOT create an AudioContext yet) ---
    this.ctx = null;            // created lazily in resume()
    this._masterGain = null;
    this._compressor = null;
    this._musicBus = null;
    this._sfxBus = null;

    // toggles default ON; the caller restores persisted prefs via setters.
    this._musicEnabled = true;
    this._sfxEnabled = true;
    this._musicPlaying = false; // logical "should music be running" flag

    // --- SFX voice tracking (cap concurrency) ---
    this._activeSfx = new Set();
    this._maxSfx = AUDIO.MAX_SFX_VOICES | 0 || 14;

    // --- shared white-noise buffer (built once on first resume) ---
    this._noiseBuffer = null;

    // --- music scheduler state ---
    this._score = buildScore();
    this._schedulerId = null;     // setInterval handle
    this._lookahead = 25;         // ms between scheduler ticks
    this._scheduleAhead = 0.12;   // seconds of audio to schedule ahead
    this._nextNoteTime = 0;       // ctx time of the next 16th step to schedule
    this._currentStep = 0;        // absolute step counter (0..bars*stepsPerBar-1)

    // tempo (seconds per 16th note) derived from BPM.
    const bpm = AUDIO.MUSIC_BPM || 132;
    this._secondsPerBeat = 60 / bpm;
    this._secondsPer16th = this._secondsPerBeat / 4;

    this._disposed = false;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  // Create or resume the AudioContext. Must be called from a user gesture the
  // first time (browser autoplay policy). Idempotent + safe to spam.
  resume() {
    if (this._disposed) return;
    if (!AudioContextCtor) return; // no Web Audio support — silently no-op

    try {
      if (!this.ctx) {
        this.ctx = new AudioContextCtor();
        this._buildGraph();
        this._buildNoiseBuffer();
      }
      // A freshly created context may start 'suspended' on some browsers.
      if (this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        // resume() returns a promise; we don't need to await it here.
        this.ctx.resume().catch(() => {});
      }
      // If music should be playing and the scheduler isn't running, (re)start.
      if (this._musicPlaying && this._musicEnabled && !this._schedulerId) {
        this._startScheduler();
      }
    } catch (_e) {
      // Never let audio init crash the game.
    }
  }

  get ready() {
    return !!(this.ctx && this.ctx.state === 'running');
  }

  // Build the master/compressor/bus graph. Called once, after ctx creation.
  _buildGraph() {
    const ctx = this.ctx;

    // Master gain.
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = AUDIO.MASTER_GAIN ?? 0.55;

    // Gentle bus compressor/limiter to tame stacked transients.
    this._compressor = ctx.createDynamicsCompressor();
    try {
      this._compressor.threshold.value = -14;
      this._compressor.knee.value = 24;
      this._compressor.ratio.value = 4;
      this._compressor.attack.value = 0.003;
      this._compressor.release.value = 0.25;
    } catch (_e) {
      // Some params may be read-only in odd impls; ignore.
    }

    // Separate buses for clean toggling.
    this._musicBus = ctx.createGain();
    this._musicBus.gain.value = this._musicEnabled ? (AUDIO.MUSIC_GAIN ?? 0.32) : 0;

    this._sfxBus = ctx.createGain();
    this._sfxBus.gain.value = this._sfxEnabled ? (AUDIO.SFX_GAIN ?? 0.5) : 0;

    // Wire it up: buses -> master -> compressor -> destination.
    this._musicBus.connect(this._masterGain);
    this._sfxBus.connect(this._masterGain);
    this._masterGain.connect(this._compressor);
    this._compressor.connect(ctx.destination);
  }

  // Build a single reusable ~2s white-noise buffer for all percussion/SFX.
  _buildNoiseBuffer() {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this._noiseBuffer = buf;
  }

  // Stop everything and release the context.
  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    this.stopMusic();

    // Stop any lingering SFX voices.
    for (const stop of this._activeSfx) {
      try { stop(); } catch (_e) {}
    }
    this._activeSfx.clear();

    try {
      if (this._masterGain) this._masterGain.disconnect();
      if (this._compressor) this._compressor.disconnect();
      if (this._musicBus) this._musicBus.disconnect();
      if (this._sfxBus) this._sfxBus.disconnect();
    } catch (_e) {}

    try {
      if (this.ctx && typeof this.ctx.close === 'function') {
        this.ctx.close().catch(() => {});
      }
    } catch (_e) {}

    this.ctx = null;
    this._masterGain = null;
    this._compressor = null;
    this._musicBus = null;
    this._sfxBus = null;
    this._noiseBuffer = null;
  }

  // ---------------------------------------------------------------------------
  // Enable / disable toggles
  // ---------------------------------------------------------------------------

  get musicEnabled() { return this._musicEnabled; }
  get sfxEnabled() { return this._sfxEnabled; }

  setMusicEnabled(on) {
    on = !!on;
    this._musicEnabled = on;
    if (this._musicBus && this.ctx) {
      // Smoothly ramp the bus to avoid clicks.
      const now = this.ctx.currentTime;
      const g = this._musicBus.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(on ? (AUDIO.MUSIC_GAIN ?? 0.32) : 0, now + 0.08);
      } catch (_e) {
        g.value = on ? (AUDIO.MUSIC_GAIN ?? 0.32) : 0;
      }
    }
    if (!on) {
      // Disabled: stop the scheduler entirely (frees timer + nodes) but keep
      // the logical "playing" flag so re-enabling resumes the track.
      this._stopScheduler();
    } else if (this._musicPlaying) {
      // Enabled while we should be playing: (re)start the scheduler.
      if (this.ready && !this._schedulerId) this._startScheduler();
    }
  }

  setSfxEnabled(on) {
    on = !!on;
    this._sfxEnabled = on;
    if (this._sfxBus && this.ctx) {
      const now = this.ctx.currentTime;
      const g = this._sfxBus.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(on ? (AUDIO.SFX_GAIN ?? 0.5) : 0, now + 0.05);
      } catch (_e) {
        g.value = on ? (AUDIO.SFX_GAIN ?? 0.5) : 0;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Music — looping scheduled chiptune
  // ---------------------------------------------------------------------------

  startMusic() {
    if (this._disposed) return;
    // Remember intent even if not ready yet — resume() will pick it up.
    this._musicPlaying = true;
    if (!this._musicEnabled) return;
    if (!this.ready) return; // will start on resume()
    if (!this._schedulerId) this._startScheduler();
  }

  stopMusic() {
    this._musicPlaying = false;
    this._stopScheduler();
  }

  _startScheduler() {
    if (this._schedulerId || !this.ctx) return;
    // Begin scheduling a hair into the future to avoid scheduling in the past.
    this._currentStep = 0;
    this._nextNoteTime = this.ctx.currentTime + 0.06;
    const tick = () => this._schedulerTick();
    this._schedulerId = setInterval(tick, this._lookahead);
    // Kick once immediately so audio starts promptly.
    tick();
  }

  _stopScheduler() {
    if (this._schedulerId) {
      clearInterval(this._schedulerId);
      this._schedulerId = null;
    }
  }

  // Lookahead scheduler: while the next step falls within the lookahead window,
  // schedule its notes and advance. Standard Web Audio scheduling pattern.
  _schedulerTick() {
    if (!this.ctx || !this._musicEnabled || !this._musicPlaying) return;
    const totalSteps = this._score.bars * this._score.stepsPerBar;
    const horizon = this.ctx.currentTime + this._scheduleAhead;

    while (this._nextNoteTime < horizon) {
      const stepInLoop = this._currentStep % totalSteps;
      this._scheduleStep(stepInLoop, this._nextNoteTime);
      this._nextNoteTime += this._secondsPer16th;
      this._currentStep++;
    }
  }

  // Schedule every event that falls on this absolute 16th step at time `when`.
  _scheduleStep(stepInLoop, when) {
    const { bass, lead, drums, stepsPerBar } = this._score;
    const bar = Math.floor(stepInLoop / stepsPerBar);
    const localStep = stepInLoop % stepsPerBar;

    // Bass — warm square sub.
    for (let i = 0; i < bass.length; i++) {
      const ev = bass[i];
      if (ev.bar === bar && ev.step === localStep) {
        this._playMusicNote({
          midi: ev.midi,
          when,
          dur: ev.dur * this._secondsPer16th,
          type: 'square',
          gain: 0.42,
          detune: 0,
          attack: 0.004,
          release: 0.06,
          cutoff: 1400,
        });
      }
    }

    // Lead — bright pulse-ish (sawtooth through a bandpass = pulse shimmer).
    for (let i = 0; i < lead.length; i++) {
      const ev = lead[i];
      if (ev.bar === bar && ev.step === localStep) {
        this._playMusicNote({
          midi: ev.midi,
          when,
          dur: ev.dur * this._secondsPer16th,
          type: 'sawtooth',
          gain: 0.20,
          detune: 6,
          attack: 0.005,
          release: 0.05,
          cutoff: 4200,
          // a faint second voice an octave-ish detune for chiptune "buzz".
          stack: { type: 'square', semis: 0, detune: -8, gainMul: 0.5 },
        });
      }
    }

    // Drums.
    for (let i = 0; i < drums.length; i++) {
      const ev = drums[i];
      if (ev.bar === bar && ev.step === localStep) {
        if (ev.type === 'k') this._playKick(when);
        else if (ev.type === 's') this._playSnare(when);
        else this._playHat(when, localStep % 4 === 0 ? 0.10 : 0.06);
      }
    }
  }

  // A single melodic/bass music note routed to the music bus.
  _playMusicNote(opts) {
    const ctx = this.ctx;
    if (!ctx || !this._musicBus) return;
    const freq = mtof(opts.midi);
    const when = Math.max(opts.when, ctx.currentTime);
    const dur = opts.dur;
    const end = when + dur;

    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(freq, when);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, when);

    // Gentle lowpass keeps the saw/square from being harsh.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(opts.cutoff ?? 3000, when);
    filter.Q.setValueAtTime(0.7, when);

    const env = ctx.createGain();
    const peak = opts.gain ?? 0.25;
    const atk = opts.attack ?? 0.005;
    const rel = opts.release ?? 0.05;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + atk);
    // sustain slightly below peak, then release to near-zero.
    env.gain.setValueAtTime(peak, Math.max(when + atk, end - rel - 0.001));
    env.gain.exponentialRampToValueAtTime(0.0001, end + rel);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this._musicBus);

    osc.start(when);
    osc.stop(end + rel + 0.02);

    // Optional stacked detuned voice for a fatter chiptune lead.
    let stackOsc = null;
    if (opts.stack) {
      stackOsc = ctx.createOscillator();
      stackOsc.type = opts.stack.type;
      stackOsc.frequency.setValueAtTime(mtof(opts.midi + (opts.stack.semis || 0)), when);
      stackOsc.detune.setValueAtTime(opts.stack.detune || 0, when);
      const sEnv = ctx.createGain();
      const sPeak = peak * (opts.stack.gainMul ?? 0.5);
      sEnv.gain.setValueAtTime(0.0001, when);
      sEnv.gain.exponentialRampToValueAtTime(sPeak, when + atk);
      sEnv.gain.setValueAtTime(sPeak, Math.max(when + atk, end - rel - 0.001));
      sEnv.gain.exponentialRampToValueAtTime(0.0001, end + rel);
      stackOsc.connect(sEnv);
      sEnv.connect(this._musicBus);
      stackOsc.start(when);
      stackOsc.stop(end + rel + 0.02);
    }

    // Clean up references on end (nodes auto-disconnect when GC'd, but be tidy).
    osc.onended = () => {
      try { osc.disconnect(); filter.disconnect(); env.disconnect(); } catch (_e) {}
    };
    if (stackOsc) {
      stackOsc.onended = () => { try { stackOsc.disconnect(); } catch (_e) {} };
    }
  }

  // Kick: pitch-swept sine thump -> music bus.
  _playKick(when) {
    const ctx = this.ctx;
    if (!ctx || !this._musicBus) return;
    when = Math.max(when, ctx.currentTime);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.11);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.9, when + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.18);
    osc.connect(env);
    env.connect(this._musicBus);
    osc.start(when);
    osc.stop(when + 0.2);
    osc.onended = () => { try { osc.disconnect(); env.disconnect(); } catch (_e) {} };
  }

  // Snare: short filtered-noise burst + a little tonal body.
  _playSnare(when) {
    const ctx = this.ctx;
    if (!ctx || !this._musicBus || !this._noiseBuffer) return;
    when = Math.max(when, ctx.currentTime);

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1400;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.5, when + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.14);
    src.connect(hp);
    hp.connect(env);
    env.connect(this._musicBus);
    src.start(when);
    src.stop(when + 0.16);
    src.onended = () => { try { src.disconnect(); hp.disconnect(); env.disconnect(); } catch (_e) {} };
  }

  // Hi-hat: very short bright filtered noise. `level` differentiates accents.
  _playHat(when, level) {
    const ctx = this.ctx;
    if (!ctx || !this._musicBus || !this._noiseBuffer) return;
    when = Math.max(when, ctx.currentTime);

    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(level ?? 0.08, when + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    src.connect(hp);
    hp.connect(env);
    env.connect(this._musicBus);
    src.start(when);
    src.stop(when + 0.06);
    src.onended = () => { try { src.disconnect(); hp.disconnect(); env.disconnect(); } catch (_e) {} };
  }

  // ---------------------------------------------------------------------------
  // SFX infrastructure — voice cap + cleanup
  // ---------------------------------------------------------------------------

  // Returns true if a new SFX voice may start (and reserves a slot). The caller
  // registers a `stop` cleanup via _trackVoice so dispose() can kill it.
  _canPlaySfx() {
    if (this._disposed) return false;
    if (!this._sfxEnabled) return false;
    // Auto-resume on first SFX in case the caller forgot — cheap + idempotent.
    if (!this.ctx) {
      this.resume();
    }
    if (!this.ready || !this._sfxBus) return false;
    if (this._activeSfx.size >= this._maxSfx) return false;
    return true;
  }

  // Register a voice so it counts against the cap and is cleaned up on end.
  // `nodes` are the source nodes whose 'ended' frees the slot.
  // `extra` is an optional list of nodes to disconnect on cleanup.
  _trackVoice(nodes, extra) {
    const all = [].concat(nodes || [], extra || []);
    let done = false;
    const stop = () => {
      if (done) return;
      done = true;
      for (const node of all) {
        try {
          if (node && typeof node.stop === 'function') node.stop();
        } catch (_e) {}
        try { if (node) node.disconnect(); } catch (_e) {}
      }
      this._activeSfx.delete(stop);
    };
    this._activeSfx.add(stop);
    // Free the slot when the (last) source finishes naturally.
    const sources = [].concat(nodes || []);
    for (const s of sources) {
      if (s && 'onended' in s) {
        s.onended = stop;
      }
    }
    return stop;
  }

  // Convenience: make a short tone with an exponential pluck envelope -> sfx bus.
  // Returns the oscillator (already started/stopped) or null.
  _blip({ freqStart, freqEnd, type = 'square', dur = 0.12, gain = 0.5,
          attack = 0.003, curve = 'exp', delay = 0 }) {
    const ctx = this.ctx;
    if (!ctx || !this._sfxBus) return null;
    const when = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freqStart), when);
    if (freqEnd != null && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), when + dur);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + attack);
    if (curve === 'lin') {
      env.gain.linearRampToValueAtTime(0.0001, when + dur);
    } else {
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    }
    osc.connect(env);
    env.connect(this._sfxBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
    return { osc, env, when, dur };
  }

  // Convenience: a filtered noise burst -> sfx bus. Returns the source node.
  _noiseBurst({ dur = 0.2, gain = 0.5, type = 'lowpass', freqStart = 4000,
                freqEnd = null, q = 0.8, attack = 0.002, delay = 0 }) {
    const ctx = this.ctx;
    if (!ctx || !this._sfxBus || !this._noiseBuffer) return null;
    const when = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freqStart, when);
    if (freqEnd != null) {
      filt.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), when + dur);
    }
    filt.Q.setValueAtTime(q, when);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(gain, when + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(filt);
    filt.connect(env);
    env.connect(this._sfxBus);
    src.start(when);
    src.stop(when + dur + 0.02);
    return { src, filt, env, when, dur };
  }

  // ---------------------------------------------------------------------------
  // One-shot SFX — all guarded, fire-and-forget, never throw
  // ---------------------------------------------------------------------------

  playerShoot() {
    if (!this._canPlaySfx()) return;
    // Bright descending pew with a tiny noise tick for "snap".
    const v = this._blip({
      freqStart: 1300, freqEnd: 420, type: 'square',
      dur: 0.11, gain: 0.34, attack: 0.001,
    });
    const tick = this._noiseBurst({
      dur: 0.04, gain: 0.12, type: 'highpass', freqStart: 3000, q: 0.5,
    });
    if (v) this._trackVoice([v.osc], [v.env, tick ? tick.src : null, tick ? tick.filt : null, tick ? tick.env : null]);
  }

  enemyShoot() {
    if (!this._canPlaySfx()) return;
    // Lower, zappier square/saw down-sweep — clearly different from the player.
    const v = this._blip({
      freqStart: 560, freqEnd: 150, type: 'sawtooth',
      dur: 0.16, gain: 0.30, attack: 0.001,
    });
    if (v) this._trackVoice([v.osc], [v.env]);
  }

  explosionSmall() {
    if (!this._canPlaySfx()) return;
    // Noise burst with a downward filter sweep + a low pitch-down tone thump.
    const noise = this._noiseBurst({
      dur: 0.22, gain: 0.4, type: 'lowpass', freqStart: 2600, freqEnd: 400, q: 1.0,
    });
    const tone = this._blip({
      freqStart: 220, freqEnd: 60, type: 'square', dur: 0.2, gain: 0.22, attack: 0.001,
    });
    const sources = [];
    const extra = [];
    if (noise) { sources.push(noise.src); extra.push(noise.filt, noise.env); }
    if (tone) { sources.push(tone.osc); extra.push(tone.env); }
    if (sources.length) this._trackVoice(sources, extra);
  }

  explosionBig() {
    if (!this._canPlaySfx()) return;
    // Layered: long low-passed noise rumble + deep pitch-down body + crack.
    const rumble = this._noiseBurst({
      dur: 0.6, gain: 0.5, type: 'lowpass', freqStart: 1800, freqEnd: 160, q: 1.2,
    });
    const body = this._blip({
      freqStart: 180, freqEnd: 38, type: 'sawtooth', dur: 0.55, gain: 0.3, attack: 0.002,
    });
    const crack = this._noiseBurst({
      dur: 0.08, gain: 0.3, type: 'bandpass', freqStart: 3200, q: 0.6,
    });
    const sources = [];
    const extra = [];
    if (rumble) { sources.push(rumble.src); extra.push(rumble.filt, rumble.env); }
    if (body) { sources.push(body.osc); extra.push(body.env); }
    if (crack) { sources.push(crack.src); extra.push(crack.filt, crack.env); }
    if (sources.length) this._trackVoice(sources, extra);
  }

  bomb() {
    if (!this._canPlaySfx()) return;
    // Deep boom: long sine pitch-down + a rising-then-falling filtered sweep.
    const boom = this._blip({
      freqStart: 120, freqEnd: 30, type: 'sine', dur: 0.7, gain: 0.45, attack: 0.004,
    });
    const sweep = this._noiseBurst({
      dur: 0.7, gain: 0.32, type: 'lowpass', freqStart: 300, freqEnd: 2600, q: 2.0,
    });
    const sources = [];
    const extra = [];
    if (boom) { sources.push(boom.osc); extra.push(boom.env); }
    if (sweep) { sources.push(sweep.src); extra.push(sweep.filt, sweep.env); }
    if (sources.length) this._trackVoice(sources, extra);
  }

  playerHit() {
    if (!this._canPlaySfx()) return;
    // Harsh alarm-ish hit: a square buzz with quick downward warble + noise.
    const ctx = this.ctx;
    const buzz = this._blip({
      freqStart: 420, freqEnd: 110, type: 'square', dur: 0.3, gain: 0.4, attack: 0.001,
    });
    // overlay a dissonant second tone for "harsh".
    let second = null;
    if (ctx && this._sfxBus) {
      second = this._blip({
        freqStart: 330, freqEnd: 95, type: 'sawtooth', dur: 0.3, gain: 0.22, attack: 0.001,
      });
    }
    const noise = this._noiseBurst({
      dur: 0.18, gain: 0.2, type: 'highpass', freqStart: 1500, freqEnd: 400, q: 0.7,
    });
    const sources = [];
    const extra = [];
    if (buzz) { sources.push(buzz.osc); extra.push(buzz.env); }
    if (second) { sources.push(second.osc); extra.push(second.env); }
    if (noise) { sources.push(noise.src); extra.push(noise.filt, noise.env); }
    if (sources.length) this._trackVoice(sources, extra);
  }

  lowHealthWarning() {
    if (!this._canPlaySfx()) return;
    // Subtle two-pip warning beep.
    const a = this._blip({
      freqStart: 880, freqEnd: 880, type: 'triangle', dur: 0.09, gain: 0.2, attack: 0.004, delay: 0,
    });
    const b = this._blip({
      freqStart: 880, freqEnd: 880, type: 'triangle', dur: 0.09, gain: 0.2, attack: 0.004, delay: 0.14,
    });
    const sources = [];
    const extra = [];
    if (a) { sources.push(a.osc); extra.push(a.env); }
    if (b) { sources.push(b.osc); extra.push(b.env); }
    if (sources.length) this._trackVoice(sources, extra);
  }

  uiSelect() {
    if (!this._canPlaySfx()) return;
    // Confirm blip: quick up-chirp.
    const v = this._blip({
      freqStart: 660, freqEnd: 1320, type: 'square', dur: 0.1, gain: 0.3, attack: 0.002,
    });
    if (v) this._trackVoice([v.osc], [v.env]);
  }

  uiMove() {
    if (!this._canPlaySfx()) return;
    // Light tick.
    const v = this._blip({
      freqStart: 520, freqEnd: 520, type: 'square', dur: 0.05, gain: 0.18, attack: 0.001,
    });
    if (v) this._trackVoice([v.osc], [v.env]);
  }

  // Victory or defeat jingle. These intentionally use several short scheduled
  // notes; each note is one tracked voice (cap still applies, but a jingle is
  // a deliberate moment so we let it through up to the cap).
  gameOver(win) {
    if (!this._canPlaySfx()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const beat = 0.16;

    // helper to schedule a single jingle note at an offset.
    const note = (midi, offset, dur, type, gain) => {
      if (this._activeSfx.size >= this._maxSfx) return;
      const when = now + offset;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(mtof(midi), when);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, when);
      env.gain.exponentialRampToValueAtTime(gain, when + 0.006);
      env.gain.setValueAtTime(gain, when + dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(env);
      env.connect(this._sfxBus);
      osc.start(when);
      osc.stop(when + dur + 0.02);
      this._trackVoice([osc], [env]);
    };

    if (win) {
      // Heroic victory fanfare: C E G C (up), then a high sparkle.
      note(n('C', 5), 0 * beat, 0.18, 'square', 0.34);
      note(n('E', 5), 1 * beat, 0.18, 'square', 0.34);
      note(n('G', 5), 2 * beat, 0.18, 'square', 0.34);
      note(n('C', 6), 3 * beat, 0.34, 'square', 0.38);
      // sparkle harmony
      note(n('E', 6), 3 * beat, 0.34, 'triangle', 0.18);
      note(n('G', 6), 4.2 * beat, 0.42, 'triangle', 0.22);
    } else {
      // Sad defeat motif: descending minor, a slow droop.
      note(n('A', 4), 0 * beat * 2, 0.26, 'sawtooth', 0.3);
      note(n('G', 4), 1 * beat * 2, 0.26, 'sawtooth', 0.3);
      note(n('E', 4), 2 * beat * 2, 0.26, 'sawtooth', 0.3);
      note(n('A', 3), 3 * beat * 2, 0.6, 'sawtooth', 0.32);
      // low drone underneath the final note
      note(n('A', 2), 3 * beat * 2, 0.6, 'triangle', 0.22);
    }
  }
}
