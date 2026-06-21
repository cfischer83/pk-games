// =============================================================================
// JETS — core game engine
// =============================================================================
// Owns the three.js scene, the fixed-angle orthographic "Zaxxon" camera, the
// fixed-timestep simulation loop, and all gameplay: player flight, enemy jets,
// projectiles, smart bombs, collisions, and win/lose flow. The world streams
// under the player (see world.js); the camera only translates, never rotates.
//
// Lifecycle (driven by main.js, which owns the single rAF loop + InputManager):
//   const game = new Game({ container, audio, hud, onGameOver });
//   game.frame(now, inputState)   // EVERY animation frame (advances + renders)
//   game.start(levelIndex)        // begin a fresh run         -> mode 'playing'
//   game.pause() / game.resume()  // freeze / unfreeze the sim
//   game.toAttract()              // decorative menu backdrop  -> mode 'attract'
//
// IMPORTANT: main calls input.update() exactly once per frame, then passes the
// snapshot here. Game never calls input.update() itself.
// =============================================================================

import * as THREE from 'three';
import { CAMERA, GAME, PALETTE } from './config.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { getLevel } from './levels.js';
import {
  createPlayerJet, createEnemyJet, createShadow,
  createPlayerBullet, createEnemyBullet, createBomb,
} from './meshes.js';

export const Mode = { ATTRACT: 'attract', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

const STEP_MS = 1000 / 60;        // fixed simulation step
const MAX_FRAME_MS = 100;         // clamp huge gaps (tab switch / resume)
const FOCUS_BASE_Y = 30;          // camera focus altitude baseline

// pool sizes
const PLAYER_BULLETS = 48;
const ENEMY_BULLETS = 72;
const ENEMIES = 14;

const PLAYER_HIT_R = 2.6;         // forgiving player collision radius

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);

export class Game {
  constructor({ container, audio, hud, onGameOver }) {
    this.container = container;
    this.audio = audio;
    this.hud = hud;
    this.onGameOver = onGameOver || (() => {});

    this.mode = Mode.ATTRACT;
    this._lastNow = null;
    this._accum = 0;
    this._time = 0;             // wall-ish sim time (for attract animation)

    this._initRenderer();
    this._initScene();
    this._initEntities();

    this.world = new World(this.scene);

    this.finishGate = this._buildFinishGate();
    this.scene.add(this.finishGate);
    this.finishX = Infinity;

    this.level = getLevel(0);
    this._resetRunState();

    this.resize();
    this.world.reset(this.player.x, this.level);
    this._frameCamera(true);    // snap camera to start
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(PALETTE.sky, 1);
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);
    this.scene.fog = new THREE.Fog(PALETTE.sky, 380, 700);

    // Orthographic camera — fixed iso angle. Frustum set in resize().
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA.NEAR, CAMERA.FAR);
    // Position once and lookAt once to lock the orientation; afterwards we only
    // translate the camera (true Zaxxon scrolling, no rotation).
    const o = CAMERA.OFFSET, la = CAMERA.LOOK_AHEAD;
    this.camera.position.set(o.x, FOCUS_BASE_Y + o.y, o.z);
    this.camera.lookAt(la.x, FOCUS_BASE_Y + la.y, la.z);
    this.camera.updateMatrixWorld();
    this.scene.add(this.camera);

    // Lights — hemisphere + key directional + low ambient give the vibrant,
    // readable low-poly look. No real-time shadows (we fake them with sprites).
    const hemi = new THREE.HemisphereLight(0x9fc4ff, 0x18183a, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(-0.4, 1, 0.5);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xff8a5a, 0.25);
    fill.position.set(0.6, 0.3, -0.5);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0x404a66, 0.5));

    this.effects = new Effects(this.scene);
  }

  _initEntities() {
    // ---- Player ----
    this.player = {
      group: createPlayerJet(),
      shadow: createShadow(),
      x: 0, y: 36, z: 0,
      vz: 0, vy: 0,
      bank: 0, pitch: 0,
      alive: true,
      lives: GAME.PLAYER_MAX_HITS,
      bombs: GAME.BOMBS_PER_LEVEL,
      invuln: 0,
      fireCd: 0,
      score: 0,
      blink: 0,
    };
    this.scene.add(this.player.group);
    this.scene.add(this.player.shadow);

    // ---- Pools ----
    this.playerBullets = this._makePool(PLAYER_BULLETS, () => {
      const m = createPlayerBullet();
      m.visible = false; this.scene.add(m);
      return { mesh: m, active: false, x: 0, y: 0, z: 0, life: 0 };
    });
    this.enemyBullets = this._makePool(ENEMY_BULLETS, () => {
      const m = createEnemyBullet();
      m.visible = false; this.scene.add(m);
      return { mesh: m, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0 };
    });
    this.enemies = this._makePool(ENEMIES, () => {
      const g = createEnemyJet();
      const sh = createShadow();
      g.visible = false; sh.visible = false;
      this.scene.add(g); this.scene.add(sh);
      return {
        group: g, shadow: sh, active: false,
        x: 0, y: 0, z: 0, vz: 0, targetZ: 0,
        phase: 0, fireTimer: 0, bank: 0, hp: 1, deadFor: 0,
      };
    });
    // Lobbed smart-bombs (project from the jet, arc down, then detonate).
    this.bombProjectiles = this._makePool(GAME.BOMBS_PER_LEVEL, () => {
      const g = createBomb();
      const sh = createShadow();
      g.visible = false; sh.visible = false;
      this.scene.add(g); this.scene.add(sh);
      return { group: g, shadow: sh, active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, fuse: 0, spin: 0 };
    });

    this._enemySpawnTimer = 0;
  }

  _makePool(n, factory) {
    const arr = [];
    for (let i = 0; i < n; i++) arr.push(factory());
    return arr;
  }

  _resetRunState() {
    const p = this.player;
    p.x = 0; p.y = 36; p.z = 0; p.vz = 0; p.vy = 0;
    p.bank = 0; p.pitch = 0;
    p.alive = true;
    p.lives = GAME.PLAYER_MAX_HITS;
    p.bombs = GAME.BOMBS_PER_LEVEL;
    p.invuln = 0; p.fireCd = 0; p.score = 0; p.blink = 0;
    p.group.visible = true;
    p.group.position.set(p.x, p.y, p.z);
    p.group.rotation.set(0, 0, 0);
    p.shadow.visible = true;

    for (const b of this.playerBullets) { b.active = false; b.mesh.visible = false; }
    for (const b of this.enemyBullets) { b.active = false; b.mesh.visible = false; }
    for (const e of this.enemies) { e.active = false; e.group.visible = false; e.shadow.visible = false; }
    for (const bm of this.bombProjectiles) { bm.active = false; bm.group.visible = false; bm.shadow.visible = false; }

    this.elapsed = 0;
    this._enemySpawnTimer = 1.2;
    this._endingTimer = 0;
    this._endingWin = false;
    this._shake = 0;
    this._lowHealthWarned = false;
    this._pendingBomb = false;
  }

  // ---------------------------------------------------------------------------
  // Public lifecycle
  // ---------------------------------------------------------------------------
  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    const aspect = w / Math.max(1, h);
    const halfH = CAMERA.ORTHO_HALF_HEIGHT;
    const halfW = halfH * aspect;
    const cam = this.camera;
    cam.left = -halfW; cam.right = halfW;
    cam.top = halfH; cam.bottom = -halfH;
    cam.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  /** Begin a fresh playthrough of `levelIndex`. */
  start(levelIndex = 0) {
    this.level = getLevel(levelIndex);
    this._resetRunState();
    this.effects.reset();
    // The player starts at x=0; the finish is the distance covered over the
    // level's duration, so reaching it coincides with surviving the full time.
    this.finishX = this._levelDistance(this.level);
    this.world.setFinish(this.finishX);
    this.finishGate.position.set(this.finishX, 0, 0);
    this.finishGate.visible = true;
    this.world.reset(this.player.x, this.level);
    this.mode = Mode.PLAYING;
    this._resetTiming();
    this.hud.init(GAME.PLAYER_MAX_HITS, GAME.BOMBS_PER_LEVEL);
    this.hud.showMessage('SECTOR ' + this.level.id + ' — GO!', { duration: 1.6 });
    this._frameCamera(true);
  }

  pause() {
    if (this.mode === Mode.PLAYING) this.mode = Mode.PAUSED;
  }
  resume() {
    if (this.mode === Mode.PAUSED) { this.mode = Mode.PLAYING; this._resetTiming(); }
  }
  toAttract() {
    this.mode = Mode.ATTRACT;
    this._resetRunState();
    this.effects.reset();
    this.finishX = Infinity;
    this.finishGate.visible = false;
    this.world.setFinish(Infinity);
    this.world.reset(this.player.x, this.level);
    this.player.group.visible = true;
    this._resetTiming();
    this._frameCamera(true);
  }

  _resetTiming() { this._lastNow = null; this._accum = 0; }

  /** Called every animation frame by main.js. Advances sim (if active) + renders. */
  frame(now, input) {
    if (this._lastNow == null) this._lastNow = now;
    let frameMs = now - this._lastNow;
    this._lastNow = now;
    if (frameMs < 0) frameMs = 0;
    if (frameMs > MAX_FRAME_MS) frameMs = MAX_FRAME_MS;

    // Latch the bomb edge across frames so it's never lost on a render frame
    // that runs zero fixed steps (e.g. 120Hz+ displays); a step consumes it.
    if (this.mode === Mode.PLAYING && input && input.bombPressed) this._pendingBomb = true;

    if (this.mode === Mode.PLAYING || this.mode === Mode.ATTRACT) {
      this._accum += frameMs;
      let steps = 0;
      while (this._accum >= STEP_MS && steps < 6) {
        this._step(STEP_MS / 1000, input);
        this._accum -= STEP_MS;
        steps++;
      }
      if (steps === 6) this._accum = 0;   // avoid spiral of death
      if (this.mode === Mode.PLAYING) this._updateHud();
    }

    this._frameCamera(false, frameMs / 1000);
    this.renderer.render(this.scene, this.camera);
  }

  // ---------------------------------------------------------------------------
  // Simulation step (fixed dt)
  // ---------------------------------------------------------------------------
  _step(dt, input) {
    this._time += dt;
    const attract = this.mode === Mode.ATTRACT;
    const ending = this._endingTimer > 0;
    const p = this.player;

    const t = attract ? 0 : Math.min(1, this.elapsed / this.level.duration);
    const fwd = this.level.forwardSpeed(t);

    // ---- Resolve control inputs (bomb edge is latched in frame(), not here) ----
    let mx, my, fire;
    if (attract) {
      mx = Math.sin(this._time * 0.7) * 0.85;
      my = Math.sin(this._time * 0.45 + 1.1) * 0.55;
      fire = false;
    } else if (ending) {
      // During the end flourish the player auto-flies (climb on win).
      mx = this._endingWin ? Math.sin(this._time * 2) * 0.4 : 0;
      my = this._endingWin ? 0.7 : -0.2;
      fire = false;
    } else if (p.alive) {
      mx = input ? input.moveX : 0;
      // Inverted vertical (flight-stick style): pressing up descends, down climbs.
      // Pitch derives from `my`, so the nose still matches the actual motion.
      my = input ? -input.moveY : 0;
      fire = input ? input.fire : false;
    } else {
      mx = 0; my = 0; fire = false;
    }

    // ---- Player forward auto-advance + lateral/vertical control ----
    p.x += fwd * dt;

    const targetVz = mx * GAME.STRAFE_SPEED;
    const targetVy = my * GAME.CLIMB_SPEED;
    const k = 1 - Math.exp(-GAME.STRAFE_ACCEL * dt);
    p.vz += (targetVz - p.vz) * k;
    p.vy += (targetVy - p.vy) * k;
    p.z += p.vz * dt;
    p.y += p.vy * dt;

    if (p.z < GAME.Z_MIN) { p.z = GAME.Z_MIN; p.vz = 0; }
    if (p.z > GAME.Z_MAX) { p.z = GAME.Z_MAX; p.vz = 0; }
    if (p.y < GAME.Y_MIN) { p.y = GAME.Y_MIN; p.vy = 0; }
    if (p.y > GAME.Y_MAX) { p.y = GAME.Y_MAX; p.vy = 0; }

    // visual tilt (smoothed). Bank INTO the turn: pressing right dips the right
    // (+Z) wing. Yaw the nose slightly toward travel for a natural look.
    const targetBank = mx * GAME.MAX_BANK;
    const targetPitch = my * GAME.MAX_PITCH;
    p.bank += (targetBank - p.bank) * Math.min(1, dt * 8);
    p.pitch += (targetPitch - p.pitch) * Math.min(1, dt * 8);
    p.group.position.set(p.x, p.y, p.z);
    p.group.rotation.set(p.bank, -mx * 0.16, p.pitch);

    // blink during invulnerability
    if (p.invuln > 0 && p.alive) {
      p.invuln -= dt;
      p.blink += dt;
      p.group.visible = Math.floor(p.blink * 14) % 2 === 0;
      if (p.invuln <= 0) p.group.visible = true;
    }

    // shadow
    this._updateShadow(p.shadow, p.x, p.y, p.z, p.alive);

    // ---- World streaming ----
    this.world.update(dt, p.x, t, this.level);

    // ---- Enemies ----
    if (!ending) this._updateSpawns(dt, t, attract);
    this._updateEnemies(dt, attract, ending);

    // ---- Player weapon ----
    p.fireCd -= dt;
    if (fire && p.fireCd <= 0 && p.alive && !attract && !ending) {
      this._firePlayerBullet();
      p.fireCd = GAME.FIRE_INTERVAL;
    }

    // ---- Bombs (latched intent; consumed once when conditions allow) ----
    if (this._pendingBomb) {
      if (p.alive && !attract && !ending) { this._pendingBomb = false; this._dropBomb(); }
      else if (attract || ending) { this._pendingBomb = false; }  // discard if not actionable
    }

    // ---- Projectiles ----
    this._updateBullets(dt);
    this._updateBombs(dt);

    // ---- Collisions ----
    if (!attract && !ending) this._collisions(dt);

    // ---- Effects + camera shake decay ----
    this.effects.update(dt);
    if (this._shake > 0) this._shake = Math.max(0, this._shake - dt * 2.2);

    // ---- Timing / win-lose ----
    if (!attract) {
      if (ending) {
        this._endingTimer -= dt;
        if (this._endingTimer <= 0) this._concludeGame();
      } else if (p.alive) {
        this.elapsed += dt;
        // Win when the player reaches the finish gate (coincides with surviving
        // the full duration, since finishX = distance covered over the level).
        if (p.x >= this.finishX) this._triggerWin();
        else this._maybeLowHealthWarning();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Player weapon / bombs
  // ---------------------------------------------------------------------------
  _firePlayerBullet() {
    const b = this._firstInactive(this.playerBullets);
    if (!b) return;
    const p = this.player;
    b.active = true;
    b.x = p.x + 6.5; b.y = p.y; b.z = p.z;
    b.life = GAME.BULLET_LIFETIME;
    b.mesh.position.set(b.x, b.y, b.z);
    b.mesh.visible = true;
    this.effects.spawnMuzzle(b.x, b.y, b.z);
    this.audio.playerShoot();
  }

  /** Launch a smart-bomb: it lobs forward from the jet and arcs down to the
   *  ground (or a short fuse), THEN detonates and clears the area. */
  _dropBomb() {
    const p = this.player;
    if (p.bombs <= 0) return;
    const bm = this._firstInactive(this.bombProjectiles);
    if (!bm) return;
    p.bombs--;
    this.hud.setBombs(p.bombs);
    this.audio.bomb();

    bm.active = true;
    bm.x = p.x + 4; bm.y = p.y - 1; bm.z = p.z;
    bm.vx = GAME.BOMB_LAUNCH_VX;
    bm.vy = GAME.BOMB_LAUNCH_VY;
    bm.vz = 0;
    bm.fuse = GAME.BOMB_MAX_FUSE;
    bm.spin = 0;
    bm.group.position.set(bm.x, bm.y, bm.z);
    bm.group.visible = true;
    bm.shadow.visible = true;
  }

  _updateBombs(dt) {
    for (const bm of this.bombProjectiles) {
      if (!bm.active) continue;
      bm.vy -= GAME.BOMB_GRAVITY * dt;
      bm.x += bm.vx * dt;
      bm.y += bm.vy * dt;
      bm.z += bm.vz * dt;
      bm.fuse -= dt;
      bm.spin += dt * 9;
      bm.group.position.set(bm.x, bm.y, bm.z);
      // tip toward travel: pitch nose-down as it falls (long axis is +Y)
      const pitch = Math.atan2(bm.vy, Math.max(1, bm.vx)) - Math.PI / 2;
      bm.group.rotation.set(0, 0, -pitch);
      bm.group.rotation.y = bm.spin;
      this._updateShadow(bm.shadow, bm.x, Math.max(bm.y, 0), bm.z, true);
      if (bm.y <= 2 || bm.fuse <= 0) {
        bm.active = false;
        bm.group.visible = false;
        bm.shadow.visible = false;
        this._detonateBomb(bm.x, bm.y, bm.z);
      }
    }
  }

  _detonateBomb(cx, cy, cz) {
    this.hud.bombFlash();
    this.audio.explosionBig();
    this._shake = Math.max(this._shake, 1.1);

    // Shockwave reads best on the ground; the fireball renders where the bomb
    // actually detonated (ground impact, or a rare high airburst).
    this.effects.spawnShockwave(cx, 2, cz, GAME.BOMB_RADIUS, PALETTE.bomb);
    this.effects.spawnExplosion(cx, Math.max(cy, 6), cz, { big: true, scale: 2.4 });

    // clear enemies + enemy bullets within radius (XZ distance)
    const r2 = GAME.BOMB_RADIUS * GAME.BOMB_RADIUS;
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = e.x - cx, dz = e.z - cz;
      if (dx * dx + dz * dz <= r2) {
        this.effects.spawnExplosion(e.x, e.y, e.z, { scale: 1.2 });
        this._killEnemy(e, 120);
      }
    }
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      const dx = b.x - cx, dz = b.z - cz;
      if (dx * dx + dz * dz <= r2) { b.active = false; b.mesh.visible = false; }
    }
  }

  // ---------------------------------------------------------------------------
  // Enemies
  // ---------------------------------------------------------------------------
  _countActiveEnemies() {
    let n = 0;
    for (const e of this.enemies) if (e.active) n++;
    return n;
  }

  _updateSpawns(dt, t, attract) {
    this._enemySpawnTimer -= dt;
    if (this._enemySpawnTimer > 0) return;
    const cap = attract ? 4 : this.level.maxEnemies;
    if (this._countActiveEnemies() < cap) this._spawnEnemy();
    const interval = attract ? 1.4 : this.level.enemyInterval(t);
    this._enemySpawnTimer = interval * (0.7 + Math.random() * 0.6);
  }

  _spawnEnemy() {
    const e = this._firstInactive(this.enemies);
    if (!e) return;
    const p = this.player;
    e.active = true;
    e.x = p.x + GAME.SPAWN_AHEAD * (0.85 + Math.random() * 0.25);
    e.z = (Math.random() - 0.5) * 150;
    e.y = GAME.ENEMY_ALT_MIN + Math.random() * (GAME.ENEMY_ALT_MAX - GAME.ENEMY_ALT_MIN);
    e.baseY = e.y;             // preferred cruise altitude; climbs to clear buildings
    e.targetZ = THREE.MathUtils.clamp(p.z + (Math.random() - 0.5) * 60, -80, 80);
    e.vz = 0;
    e.phase = Math.random() * Math.PI * 2;
    e.fireTimer = GAME.ENEMY_FIRE_MIN + Math.random() * (GAME.ENEMY_FIRE_MAX - GAME.ENEMY_FIRE_MIN);
    e.bank = 0;
    e.hp = GAME.ENEMY_HP;
    e.deadFor = 0;
    e.group.visible = true;
    e.group.position.set(e.x, e.y, e.z);
    e.shadow.visible = true;
  }

  _updateEnemies(dt, attract, ending) {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.active) continue;

      // closing motion: fly toward -X (oncoming) on top of player's advance
      e.x -= GAME.ENEMY_SPEED_REL * dt;
      // gentle weave + slow homing toward player's lane
      e.phase += dt * 2.0;
      const homing = (e.targetZ - e.z) * 0.6;
      const weave = Math.sin(e.phase) * 22;
      const desiredVz = homing + Math.cos(e.phase) * weave * 0.04;
      e.vz += (desiredVz - e.vz) * Math.min(1, dt * 3);
      e.z += e.vz * dt;
      e.bank += ((-e.vz * 0.02) - e.bank) * Math.min(1, dt * 6);

      // Building avoidance: climb to clear any building in the flight path, then
      // ease back to the cruise altitude. Prevents flying through buildings.
      let clearTop = e.baseY;
      let overlapping = false;
      const er = e.group.userData.hitRadius || 3;
      const obs = this.world.activeObstacles;
      for (let i = 0; i < obs.length; i++) {
        const o = obs[i];
        if (o.type !== 'building') continue;
        if (Math.abs(e.z - o.z) >= o.halfD + er + 4) continue;
        // Look well ahead in the flight path so there's ample time to climb.
        if (o.x > e.x - 64 && o.x < e.x + 16) {
          const need = o.height + er + 5;
          if (need > clearTop) clearTop = need;
        }
        // Currently inside this building's footprint and below its top: force a
        // hard, fast climb so the enemy never sits inside the tower.
        if (Math.abs(e.x - o.x) < o.halfW + er && e.y < o.height + er + 2) {
          overlapping = true;
          const need = o.height + er + 6;
          if (need > clearTop) clearTop = need;
        }
      }
      const targetY = Math.min(clearTop, GAME.Y_MAX);
      // climb fast on approach, very fast if already overlapping, sink gently
      const climbRate = overlapping ? 16 : (targetY > e.y ? 9 : 2.4);
      e.y += (targetY - e.y) * Math.min(1, dt * climbRate);

      e.group.position.set(e.x, e.y, e.z);
      e.group.rotation.set(e.bank, 0, Math.sin(e.phase) * 0.12);
      this._updateShadow(e.shadow, e.x, e.y, e.z, true);

      // firing
      if (!attract && !ending && p.alive) {
        e.fireTimer -= dt;
        const ahead = e.x - p.x;
        if (e.fireTimer <= 0 && ahead > 12 && ahead < 320) {
          this._enemyFire(e);
          e.fireTimer = GAME.ENEMY_FIRE_MIN + Math.random() * (GAME.ENEMY_FIRE_MAX - GAME.ENEMY_FIRE_MIN);
        }
      }

      // recycle when far behind
      if (e.x < p.x - GAME.DESPAWN_BEHIND) {
        e.active = false; e.group.visible = false; e.shadow.visible = false;
      }
    }
  }

  _enemyFire(e) {
    const b = this._firstInactive(this.enemyBullets);
    if (!b) return;
    const p = this.player;
    // Fire mostly straight forward (toward -X) like a fixed forward gun, with
    // only a mild lead toward the player's altitude/lane (dampened Y/Z).
    _v1.set(p.x - e.x, (p.y - e.y) * 0.3, (p.z - e.z) * 0.28);
    if (_v1.lengthSq() < 1e-4) _v1.set(-1, 0, 0);
    _v1.normalize();

    b.active = true;
    b.x = e.x - 5; b.y = e.y; b.z = e.z;
    b.vx = _v1.x * GAME.ENEMY_BULLET_SPEED;
    b.vy = _v1.y * GAME.ENEMY_BULLET_SPEED;
    b.vz = _v1.z * GAME.ENEMY_BULLET_SPEED;
    b.life = GAME.ENEMY_BULLET_LIFETIME;
    b.mesh.position.set(b.x, b.y, b.z);
    // orient the bolt along its travel (geometry axis is +X)
    b.mesh.quaternion.setFromUnitVectors(_xAxis, _v1);
    b.mesh.visible = true;
    this.audio.enemyShoot();
  }

  _killEnemy(e, score) {
    e.active = false;
    e.group.visible = false;
    e.shadow.visible = false;
    if (!this._endingTimer) this.player.score += score;
  }

  // ---------------------------------------------------------------------------
  // Projectiles
  // ---------------------------------------------------------------------------
  _updateBullets(dt) {
    const px = this.player.x;
    for (const b of this.playerBullets) {
      if (!b.active) continue;
      b.x += GAME.BULLET_SPEED * dt;
      b.life -= dt;
      b.mesh.position.x = b.x;
      if (b.life <= 0 || b.x > px + GAME.SPAWN_AHEAD + 60) {
        b.active = false; b.mesh.visible = false;
      }
    }
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      b.life -= dt;
      b.mesh.position.set(b.x, b.y, b.z);
      if (b.life <= 0 || b.y < 1 || b.x < px - GAME.DESPAWN_BEHIND) {
        b.active = false; b.mesh.visible = false;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Collisions
  // ---------------------------------------------------------------------------
  _collisions(dt) {
    const p = this.player;

    // player bullets vs enemies — forgiving, anisotropic hitbox. The bullet flies
    // along +X, so we allow a wide vertical (Y) and lateral (Z) window so the
    // player doesn't need a pixel-perfect altitude match to score a hit.
    for (const b of this.playerBullets) {
      if (!b.active) continue;
      for (const e of this.enemies) {
        if (!e.active) continue;
        const er = e.group.userData.hitRadius || 3;
        const dx = Math.abs(b.x - e.x);
        const dy = Math.abs(b.y - e.y);
        const dz = Math.abs(b.z - e.z);
        if (dx <= er + GAME.BULLET_HIT_FORWARD &&
            dz <= er + GAME.BULLET_HIT_LATERAL &&
            dy <= er + GAME.BULLET_HIT_VERTICAL) {
          b.active = false; b.mesh.visible = false;
          this.effects.spawnExplosion(e.x, e.y, e.z, { scale: 1.1 });
          this.audio.explosionSmall();
          this._killEnemy(e, 150);
          break;
        }
      }
    }

    if (!p.alive || p.invuln > 0) return;

    // player vs obstacles
    for (const o of this.world.activeObstacles) {
      if (o.type === 'building') {
        if (Math.abs(p.x - o.x) < o.halfW + PLAYER_HIT_R &&
            Math.abs(p.z - o.z) < o.halfD + PLAYER_HIT_R &&
            (p.y - PLAYER_HIT_R) < o.height) {
          this._hitPlayer('building'); return;
        }
      } else { // hill
        const dx = p.x - o.x, dz = p.z - o.z;
        const rad = o.radius * 0.9 + PLAYER_HIT_R;
        if (dx * dx + dz * dz < rad * rad && (p.y - PLAYER_HIT_R) < o.height * 0.95) {
          this._hitPlayer('hill'); return;
        }
      }
    }

    // player vs enemy jets
    for (const e of this.enemies) {
      if (!e.active) continue;
      const dx = p.x - e.x, dy = p.y - e.y, dz = p.z - e.z;
      const rr = PLAYER_HIT_R + (e.group.userData.hitRadius || 3);
      if (dx * dx + dy * dy + dz * dz < rr * rr) {
        this.effects.spawnExplosion(e.x, e.y, e.z, { scale: 1.2 });
        this._killEnemy(e, 80);
        this._hitPlayer('ram'); return;
      }
    }

    // player vs enemy bullets
    for (const b of this.enemyBullets) {
      if (!b.active) continue;
      const dx = p.x - b.x, dy = p.y - b.y, dz = p.z - b.z;
      const rr = PLAYER_HIT_R + 1.6;
      if (dx * dx + dy * dy + dz * dz < rr * rr) {
        b.active = false; b.mesh.visible = false;
        this._hitPlayer('shot'); return;
      }
    }
  }

  _hitPlayer() {
    const p = this.player;
    p.lives--;
    this.hud.setLives(p.lives);
    this.hud.damageFlash();
    this._shake = Math.max(this._shake, 0.8);
    this.audio.playerHit();

    if (p.lives <= 0) {
      // fatal — big explosion, hide the jet, begin lose flourish
      this.effects.spawnExplosion(p.x, p.y, p.z, { big: true, scale: 1.8 });
      this.audio.explosionBig();
      p.alive = false;
      p.group.visible = false;
      p.shadow.visible = false;
      this._triggerLose();
    } else {
      this.effects.spawnExplosion(p.x, p.y, p.z, { scale: 1.0 });
      this.audio.explosionSmall();
      p.invuln = GAME.PLAYER_INVULN_TIME;
      p.blink = 0;
      this.hud.showMessage(p.lives === 1 ? 'LAST JET!' : 'HIT! ' + p.lives + ' LEFT',
        { danger: true, duration: 1.3 });
    }
  }

  _maybeLowHealthWarning() {
    if (!this._lowHealthWarned && this.player.lives === 1) {
      this._lowHealthWarned = true;
      this.audio.lowHealthWarning();
    }
  }

  // ---------------------------------------------------------------------------
  // Win / lose
  // ---------------------------------------------------------------------------
  _clearBombs() {
    for (const bm of this.bombProjectiles) {
      if (bm.active) { bm.active = false; bm.group.visible = false; bm.shadow.visible = false; }
    }
  }

  _triggerWin() {
    if (this._endingTimer > 0) return;
    this._endingWin = true;
    this._endingTimer = 2.4;
    this.hud.showMessage('SECTOR CLEAR!', { duration: 2.2 });
    this.audio.stopMusic();
    this.audio.gameOver(true);
    // clear remaining threats for a clean victory lap
    for (const e of this.enemies) { if (e.active) { e.active = false; e.group.visible = false; e.shadow.visible = false; } }
    for (const b of this.enemyBullets) { if (b.active) { b.active = false; b.mesh.visible = false; } }
    this._clearBombs();
  }

  _triggerLose() {
    if (this._endingTimer > 0) return;
    this._endingWin = false;
    this._endingTimer = 1.8;
    this._shake = 1.4;
    this.hud.showMessage('JET DOWN', { danger: true, duration: 1.6 });
    this.audio.stopMusic();
    this.audio.gameOver(false);
    this._clearBombs();
  }

  _concludeGame() {
    this.mode = Mode.GAMEOVER;
    const stats = {
      win: this._endingWin,
      timeSurvived: this._endingWin ? this.level.duration : this.elapsed,
      score: this.player.score,
      livesLeft: Math.max(0, this.player.lives),
      level: this.level,
    };
    if (this._endingWin) stats.score += stats.livesLeft * 500;
    this._endingTimer = 0;
    this.onGameOver(this._endingWin, stats);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  _firstInactive(pool) {
    for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  _updateShadow(shadow, x, y, z, visible) {
    if (!visible) { shadow.visible = false; return; }
    shadow.visible = true;
    shadow.position.set(x, 0.12, z);
    const alt = THREE.MathUtils.clamp(y / GAME.Y_MAX, 0, 1);
    const s = 0.85 + alt * 0.75;      // higher -> larger blob
    shadow.scale.setScalar(s);
    // High-contrast: stay dark and clearly visible even at altitude so the
    // player can always read their position on the ground.
    shadow.material.opacity = 0.62 * (1 - alt * 0.3);
  }

  _updateHud() {
    const p = this.player;
    this.hud.setScore(p.score);
    this.hud.setTime(this.elapsed);
    const prog = isFinite(this.finishX) && this.finishX > 0
      ? p.x / this.finishX
      : this.elapsed / this.level.duration;
    this.hud.setProgress(prog);
    this.hud.update(STEP_MS / 1000);
  }

  /** Distance the player covers over the level (= where the finish gate sits). */
  _levelDistance(level) {
    const N = 256, dtt = level.duration / N;
    let dist = 0;
    for (let i = 0; i < N; i++) dist += level.forwardSpeed((i + 0.5) / N) * dtt;
    return dist;
  }

  /** A single bright checkered finish line painted across the ground (no
   *  overhead structure), parked at finishX and visible approaching in the haze. */
  _buildFinishGate() {
    const g = new THREE.Group();
    const W = 240;            // span across Z — covers every road + the blocks
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5, fog: false });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x10102a, roughness: 0.6 });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0x6fe9ff, emissive: 0x6fe9ff, emissiveIntensity: 1.2, roughness: 0.3, fog: false });

    // Checkered band: a few rows deep along X.
    const gCols = 32, gsq = W / gCols, rows = 3, cell = 5.1;
    for (let i = 0; i < gCols; i++) {
      for (let r = 0; r < rows; r++) {
        const even = (i + r) % 2 === 0;
        const tile = new THREE.Mesh(new THREE.PlaneGeometry(cell, gsq * 0.98),
          even ? whiteMat : darkMat);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set((r - (rows - 1) / 2) * cell, 0.14, -W / 2 + gsq * (i + 0.5));
        g.add(tile);
      }
    }
    // Bright glowing edge lines front & back so it reads clearly from a distance.
    for (const sgn of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(1.4, W), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(sgn * (rows * cell / 2 + 0.7), 0.16, 0);
      g.add(edge);
    }

    g.visible = false;
    return g;
  }

  _frameCamera(snap, dt = 1 / 60) {
    const p = this.player;
    const o = CAMERA.OFFSET;
    const focusY = FOCUS_BASE_Y + (p.y - FOCUS_BASE_Y) * CAMERA.FOLLOW_ALT;
    const focusZ = p.z * CAMERA.FOLLOW_STRAFE;

    const targetX = p.x + o.x;
    const targetY = focusY + o.y;
    const targetZ = focusZ + o.z;

    const cam = this.camera;
    if (snap) {
      cam.position.set(targetX, targetY, targetZ);
    } else {
      // forward (X) tracks exactly; Y/Z ease for a smoother feel.
      // Frame-rate-independent easing factor.
      cam.position.x = targetX;
      const e = 1 - Math.exp(-CAMERA.FOLLOW_LERP * dt);
      cam.position.y += (targetY - cam.position.y) * e;
      cam.position.z += (targetZ - cam.position.z) * e;
    }

    if (this._shake > 0) {
      const s = this._shake * 3.2;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
    // orientation stays fixed (set once at init) — never call lookAt here.
  }

  dispose() {
    try { this.renderer.dispose(); } catch (_e) {}
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
