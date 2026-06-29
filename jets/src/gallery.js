// =============================================================================
// JETS — Debug Asset Gallery
// =============================================================================
// A no-gameplay "gallery" for critiquing art. Opened from the main menu via the
// debug dialog (Ctrl+D). Shows every asset laid out with labels, a controllable
// (but non-advancing) player jet, enemy jets, projectiles, and on-demand
// explosions, plus a live colour editor that recolours elements in place.
//
// Reuses the game's WebGLRenderer (one canvas/context): main calls
// gallery.frame(now, inputState) instead of game.frame() while in gallery mode.
// =============================================================================

import * as THREE from 'three';
import { PALETTE, CAMERA, GAME } from './config.js';
import { Effects } from './effects.js';
import {
  createPlayerJet, createEnemyJet, createShadow, createBomb,
  createBuilding, createHill, createTree,
  createSpire, createHoodoo, createCactus, createCanyonWall,
  createPlayerBullet, createEnemyBullet, setMatColor, sandTexture, waterTexture,
} from './meshes.js';

// Colour groups shared across themes (jets + projectiles look identical).
const JET_COLORS = { group: 'Player Jet', items: [
  ['jetBody', 'Body'], ['jetBodyDark', 'Body (dark)'], ['jetAccent', 'Accent / tail'],
  ['jetCockpit', 'Cockpit'], ['jetEngine', 'Engine glow'], ['jetIntake', 'Intake'],
] };
const ENEMY_COLORS = { group: 'Enemy Jet', items: [
  ['enemyBody', 'Body'], ['enemyBodyDark', 'Body (dark)'], ['enemyAccent', 'Accent'],
  ['enemyCockpit', 'Cockpit'], ['enemyEngine', 'Engine glow'],
] };
const PROJECTILE_COLORS = { group: 'Projectiles', items: [
  ['playerBullet', 'Player blade'], ['playerBulletCore', 'Player core'],
  ['enemyBullet', 'Enemy blade'], ['enemyBulletCore', 'Enemy core'],
] };

// Colour swatches exposed to the editor UI (built by main.js). City theme.
export const EDITABLE_COLORS = [
  JET_COLORS, ENEMY_COLORS,
  { group: 'Buildings', items: [
    ['buildingA', 'Variant A'], ['buildingB', 'Variant B'], ['buildingC', 'Variant C'],
    ['buildingD', 'Variant D'], ['buildingTop', 'Roofs / details'],
  ] },
  { group: 'Terrain', items: [
    ['hill', 'Hill'], ['hillDark', 'Hill base'], ['treeTrunk', 'Tree trunk'],
    ['treeLeaf', 'Tree leaves'], ['treeLeaf2', 'Tree leaves 2'],
  ] },
  PROJECTILE_COLORS,
  { group: 'Environment', items: [
    ['sky', 'Sky'], ['ground', 'Ground'], ['road', 'Roads'], ['roadLine', 'Road lines'],
    ['roadEdge', 'Road edges / intersection'],
  ] },
];

// Canyon theme swatches.
export const EDITABLE_COLORS_CANYON = [
  JET_COLORS, ENEMY_COLORS,
  { group: 'Canyon Rock', items: [
    ['rock', 'Rock'], ['rockDark', 'Rock (shaded)'], ['rockLight', 'Rock (sunlit)'],
    ['hoodooCap', 'Hoodoo cap'], ['canyonWall', 'Wall'], ['canyonWallDark', 'Wall base'],
  ] },
  { group: 'Flora & Water', items: [
    ['cactus', 'Cactus'], ['cactusDark', 'Cactus (shaded)'], ['cactusFlower', 'Bloom'],
    ['river', 'River'],
  ] },
  PROJECTILE_COLORS,
  { group: 'Environment', items: [
    ['canyonSky', 'Sky'], ['canyonFloor', 'Floor'], ['canyonFloorEdge', 'Floor edge'],
    ['canyonMesa', 'Distant mesa'],
  ] },
];

/** Editor colour groups for a theme ('city' | 'canyon'). */
export function getEditableColors(theme) {
  return theme === 'canyon' ? EDITABLE_COLORS_CANYON : EDITABLE_COLORS;
}

const STRAFE = 52, CLIMB = 42;

export class Gallery {
  /** @param {{renderer: THREE.WebGLRenderer, audio: object, theme?: string}} opts */
  constructor({ renderer, audio, theme = 'city' }) {
    this.renderer = renderer;
    this.audio = audio;
    this.theme = theme;
    this.active = false;
    this._lastNow = null;
    this._time = 0;
    this._fireCd = 0;

    this._initScene();
    this._build();
    this.effects = new Effects(this.scene);

    this.playerBolts = [];
    this.enemyBolts = [];
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.sky);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
    this._lookAt = new THREE.Vector3(16, 14, 6);
    const dir = new THREE.Vector3(CAMERA.OFFSET.x, CAMERA.OFFSET.y, CAMERA.OFFSET.z).normalize();
    this.camera.position.copy(dir).multiplyScalar(560).add(this._lookAt);
    this.camera.lookAt(this._lookAt);
    this.camera.updateMatrixWorld();
    this.scene.add(this.camera);

    // Camera basis (fixed) for the inverse-projection layout helper below.
    this._camR = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0); // screen-right
    this._camU = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1); // screen-up
    this._camF = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 2).negate(); // into scene

    this.scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x18183a, 0.85));
    const sun = new THREE.DirectionalLight(0xffffff, 1.05); sun.position.set(-0.4, 1, 0.5);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xff8a5a, 0.25); fill.position.set(0.6, 0.3, -0.5);
    this.scene.add(fill);
    this.scene.add(new THREE.AmbientLight(0x404a66, 0.5));
  }

  /**
   * Place a point at a desired SCREEN position (orthographic world-units from the
   * look-at: +sR = right, +sU = up) at a given world height `y`. Returns world
   * {x, z}. Lets the layout be authored in intuitive screen space instead of
   * guessing iso world coordinates. (Depth along the view axis is free, so we
   * solve it to land the point at height y.)
   */
  _worldAt(sR, sU, y = 0) {
    const L = this._lookAt, R = this._camR, U = this._camU, F = this._camF;
    const baseY = L.y + sR * R.y + sU * U.y;
    const g = Math.abs(F.y) > 1e-5 ? (y - baseY) / F.y : 0;
    return {
      x: L.x + sR * R.x + sU * U.x + g * F.x,
      z: L.z + sR * R.z + sU * U.z + g * F.z,
    };
  }

  // ---- Layout --------------------------------------------------------------
  _build() {
    // Per-theme sky behind the assets.
    this.scene.background.setHex(this.theme === 'canyon' ? PALETTE.canyonSky : PALETTE.sky);
    this._buildCommon();
    if (this.theme === 'canyon') this._buildCanyonEnv();
    else this._buildCityEnv();
  }

  // Assets shared by every theme: the controllable jet, enemy jets, bomb, bolts.
  // Authored in SCREEN space via _worldAt(sR, sU, y): sR = screen-right,
  // sU = screen-up (world-ortho units from the look-at).
  _buildCommon() {
    // Player jet — controllable (see _updatePlayer). Has a shadow.
    const jp = this._worldAt(-84, -8, 22);
    this.jet = createPlayerJet();
    this.jetState = { x: jp.x, y: 22, z: jp.z, vz: 0, vy: 0, bank: 0, pitch: 0 };
    this.scene.add(this.jet);
    this.jetShadow = createShadow(); this.scene.add(this.jetShadow);
    this._labelAt('', -84, 12);

    // Enemy jets (each with a ground shadow)
    const ea = this._worldAt(-56, 32, 24);
    this.enemyA = createEnemyJet(); this.enemyA.position.set(ea.x, 24, ea.z); this.scene.add(this.enemyA);
    this.enemyAShadow = createShadow(); this.scene.add(this.enemyAShadow);
    const eb = this._worldAt(-34, 50, 30);
    this.enemyB = createEnemyJet(); this.enemyB.position.set(eb.x, 30, eb.z); this.scene.add(this.enemyB);
    this.enemyBShadow = createShadow(); this.scene.add(this.enemyBShadow);
    this._labelAt('ENEMY JET', -56, 46);

    // Bomb (spins in place)
    const bp = this._worldAt(-116, -44, 16);
    this.bomb = createBomb(); this.bomb.position.set(bp.x, 16, bp.z); this.bomb.scale.setScalar(2.0);
    this.scene.add(this.bomb);
    this._labelAt('BOMB', -116, -28);

    // Static bullet samples — small and stationary, at the bolts' true size.
    this._samplePlayer = null; this._sampleEnemy = null;
    this._rebuildSampleBolts();
    this._labelAt('BOLTS', -116, 24);
  }

  // City env: ground, roads, buildings A–D, hill, trees.
  _buildCityEnv() {
    // Large ground so its edges never show on screen ("ground start").
    this._groundMat = new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 0.95, metalness: 0.0 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1300), this._groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(20, 0, 10);
    this.scene.add(ground);

    this._roadMat = new THREE.MeshStandardMaterial({
      color: PALETTE.road, roughness: 0.7, emissive: PALETTE.road, emissiveIntensity: 0.2 });
    this._dashMat = new THREE.MeshStandardMaterial({
      color: PALETTE.roadLine, roughness: 0.5, emissive: PALETTE.roadLine, emissiveIntensity: 0.6 });
    this._edgeMat = new THREE.MeshStandardMaterial({
      color: PALETTE.roadEdge, roughness: 0.4, emissive: PALETTE.roadEdge, emissiveIntensity: 0.55 });

    // Roads: a long crossroads low on screen that runs off all edges.
    const ri = this._worldAt(6, -72, 0);    // intersection world position (low/front)
    const lroad = new THREE.Mesh(new THREE.PlaneGeometry(720, 16), this._roadMat);
    lroad.rotation.x = -Math.PI / 2; lroad.position.set(ri.x, 0.04, ri.z); this.scene.add(lroad);
    const croad = new THREE.Mesh(new THREE.PlaneGeometry(16, 560), this._roadMat);
    croad.rotation.x = -Math.PI / 2; croad.position.set(ri.x, 0.035, ri.z); this.scene.add(croad);
    const inter = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), this._edgeMat);
    inter.rotation.x = -Math.PI / 2; inter.position.set(ri.x, 0.08, ri.z); this.scene.add(inter);
    for (let i = 0; i < 30; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.1), this._dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(ri.x - 188 + i * 13, 0.07, ri.z); this.scene.add(d);
    }
    this._labelAt('ROADS + INTERSECTION', -34, -58);

    // Buildings A..D — a level LEFT-TO-RIGHT row (vary screen-right, same base),
    // well spaced so each reads fully without overlap.
    const heights = [26, 38, 18, 44];
    this._buildings = [];
    [0, 1, 2, 3].forEach((v, i) => {
      const b = createBuilding({ width: 15, depth: 15, height: heights[i], variant: v });
      const sR = -22 + i * 20;     // -22,-2,18,38 — fully left of the panel (~58)
      const p = this._worldAt(sR, 4, 0);
      b.position.set(p.x, 0, p.z);
      this.scene.add(b);
      this._buildings.push(b);
      this._labelAt('BLDG ' + 'ABCD'[i], sR, 4 + heights[i] * 0.84 + 7);
    });

    // Hill + trees — a lower row, clearly below the buildings and above the road.
    const hp = this._worldAt(-6, -40, 0);
    const hill = createHill({ radius: 12, height: 9 }); hill.position.set(hp.x, 0, hp.z); this.scene.add(hill);
    this._labelAt('HILL', -6, -24);
    const tp1 = this._worldAt(18, -42, 0);
    const t1 = createTree({ height: 14 }); t1.position.set(tp1.x, 0, tp1.z); this.scene.add(t1);
    const tp2 = this._worldAt(40, -22, 0);
    const t2 = createTree({ height: 10 }); t2.position.set(tp2.x, 0, tp2.z); this.scene.add(t2);
    this._labelAt('TREE', 18, -26);
  }

  // Canyon env: red floor, winding river, a wall chunk, spires, hoodoos, cactus.
  _buildCanyonEnv() {
    this._canyonFloorMat = new THREE.MeshStandardMaterial({ color: PALETTE.canyonFloor, map: sandTexture(), roughness: 0.97, metalness: 0.0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1300), this._canyonFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(20, 0, 10);
    this.scene.add(floor);

    this._canyonEdgeMat = new THREE.MeshStandardMaterial({ color: PALETTE.canyonFloorEdge, roughness: 0.98 });
    this._mesaMat = new THREE.MeshStandardMaterial({ color: PALETTE.canyonMesa, roughness: 0.98 });

    // River sample — textured rippling water ribbon low on screen.
    this._riverMat = new THREE.MeshStandardMaterial({
      color: PALETTE.river, map: waterTexture(), bumpMap: waterTexture(), bumpScale: 0.25,
      emissive: PALETTE.river, emissiveIntensity: 0.16, roughness: 0.25, metalness: 0.0,
      transparent: true, depthWrite: false });
    const rv = this._worldAt(2, -70, 0);
    const river = new THREE.Mesh(new THREE.PlaneGeometry(360, 18), this._riverMat);
    river.rotation.x = -Math.PI / 2; river.position.set(rv.x, 0.04, rv.z); this.scene.add(river);
    this._labelAt('RIVER', -28, -58);

    // Canyon wall chunk (kept shorter than in-game so it fits the frame).
    const wp = this._worldAt(-26, 6, 0);
    const wall = createCanyonWall({ length: 30, depth: 16, height: 42, seed: 99 });
    wall.position.set(wp.x, 0, wp.z); this.scene.add(wall);
    this._labelAt('CANYON WALL', -26, 44);

    // Spires — two of differing height.
    const spireH = [40, 52];
    [2, 22].forEach((sR, i) => {
      const sp = this._worldAt(sR, 4, 0);
      const s = createSpire({ height: spireH[i], radius: 5, seed: (i + 1) * 313 });
      s.position.set(sp.x, 0, sp.z); this.scene.add(s);
    });
    this._labelAt('SPIRE', 12, 4 + 52 * 0.84 + 6);

    // Hoodoo.
    const hp = this._worldAt(42, 4, 0);
    const hoodoo = createHoodoo({ height: 28, seed: 7 });
    hoodoo.position.set(hp.x, 0, hp.z); this.scene.add(hoodoo);
    this._labelAt('HOODOO', 42, 4 + 28 * 0.9 + 6);

    // Cactus — a lower row.
    [16, 36].forEach((sR, i) => {
      const cp = this._worldAt(sR, -40, 0);
      const c = createCactus({ height: i === 0 ? 11 : 8, seed: (i + 3) * 101 });
      c.position.set(cp.x, 0, cp.z); this.scene.add(c);
    });
    this._labelAt('CACTUS', 26, -24);
  }

  _rebuildSampleBolts() {
    if (this._samplePlayer) this.scene.remove(this._samplePlayer);
    if (this._sampleEnemy) this.scene.remove(this._sampleEnemy);
    const pp = this._worldAt(-116, 8, 22);
    this._samplePlayer = createPlayerBullet();
    this._samplePlayer.position.set(pp.x, 22, pp.z); this._samplePlayer.scale.setScalar(1.3);
    const ep = this._worldAt(-116, -4, 22);
    this._sampleEnemy = createEnemyBullet();
    this._sampleEnemy.position.set(ep.x, 22, ep.z); this._sampleEnemy.scale.setScalar(1.3);
    this.scene.add(this._samplePlayer, this._sampleEnemy);
  }

  /** Place a name label at a screen position (above the asset). */
  _labelAt(text, sR, sU) {
    const p = this._worldAt(sR, sU, 0);
    this._label(text, p.x, 0, p.z);
  }

  _label(text, x, y, z) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.strokeText(text, 256, 34);
    ctx.fillStyle = '#9fe8ff'; ctx.fillText(text, 256, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
    s.scale.set(44, 5.5, 1);
    s.position.set(x, y, z);
    this.scene.add(s);
    return s;
  }

  // ---- Lifecycle -----------------------------------------------------------
  start() {
    this.active = true;
    this._lastNow = null;
    Object.assign(this.jetState, { x: 0, y: 22, z: -18, vz: 0, vy: 0, bank: 0, pitch: 0 });
    this.effects.reset();
    // hide (but keep) pooled bolts so they're reused, not orphaned in the scene
    for (const b of this.playerBolts) b.mesh.visible = false;
    for (const b of this.enemyBolts) b.mesh.visible = false;
    this._fireCd = 0;
    this.resize();
  }
  stop() { this.active = false; }

  resize() {
    const el = this.renderer.domElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    const halfH = 84, halfW = halfH * (w / Math.max(1, h));
    const c = this.camera;
    c.left = -halfW; c.right = halfW; c.top = halfH; c.bottom = -halfH;
    c.updateProjectionMatrix();
  }

  frame(now, input) {
    if (this._lastNow == null) this._lastNow = now;
    let dt = (now - this._lastNow) / 1000;
    this._lastNow = now;
    if (dt < 0) dt = 0; if (dt > 0.05) dt = 0.05;
    this._time += dt;

    this._updatePlayer(dt, input);
    this._updateBolts(dt);
    this.effects.update(dt);

    // idle motion: only the bomb rotates; bolt samples stay still. Gently bob
    // enemy A; keep their shadows under them.
    this.bomb.rotation.y += dt * 1.5;
    this.enemyA.position.y = 22 + Math.sin(this._time * 1.4) * 1.5;
    this.enemyB.rotation.y = Math.PI + Math.sin(this._time) * 0.2;
    this._enemyShadow(this.enemyAShadow, this.enemyA.position);
    this._enemyShadow(this.enemyBShadow, this.enemyB.position);

    this.renderer.render(this.scene, this.camera);
  }

  _enemyShadow(shadow, pos) {
    shadow.visible = true;
    shadow.position.set(pos.x, 0.12, pos.z);
    const alt = THREE.MathUtils.clamp(pos.y / 60, 0, 1);
    shadow.scale.setScalar(0.9 + alt * 0.8);
    shadow.material.opacity = 0.6 * (1 - alt * 0.3);
  }

  _updatePlayer(dt, input) {
    const s = this.jetState;
    const mx = input ? input.moveX : 0;
    const my = input ? -input.moveY : 0;   // inverted, matching gameplay
    // move within a box; never advances in X (does not "fly")
    s.vz += (mx * STRAFE - s.vz) * Math.min(1, dt * 9);
    s.vy += (my * CLIMB - s.vy) * Math.min(1, dt * 9);
    s.z = THREE.MathUtils.clamp(s.z + s.vz * dt, -46, 46);
    s.y = THREE.MathUtils.clamp(s.y + s.vy * dt, 9, 50);
    s.bank += (mx * GAME.MAX_BANK - s.bank) * Math.min(1, dt * 8);
    s.pitch += (my * GAME.MAX_PITCH - s.pitch) * Math.min(1, dt * 8);
    this.jet.position.set(s.x, s.y, s.z);
    this.jet.rotation.set(s.bank, -mx * 0.16, s.pitch);

    // shadow
    this.jetShadow.visible = true;
    this.jetShadow.position.set(s.x, 0.12, s.z);
    const alt = THREE.MathUtils.clamp(s.y / 60, 0, 1);
    this.jetShadow.scale.setScalar(0.9 + alt * 0.8);
    this.jetShadow.material.opacity = 0.6 * (1 - alt * 0.3);

    // hold-to-fire
    this._fireCd -= dt;
    if (input && input.fire && this._fireCd <= 0) { this.firePlayer(); this._fireCd = 0.16; }
  }

  _updateBolts(dt) {
    for (const b of this.playerBolts) {
      if (!b.mesh.visible) continue;
      b.x += 150 * dt; b.life -= dt; b.mesh.position.x = b.x;
      if (b.life <= 0 || b.x > 120) b.mesh.visible = false;
    }
    for (const b of this.enemyBolts) {
      if (!b.mesh.visible) continue;
      b.x -= 130 * dt; b.life -= dt; b.mesh.position.x = b.x;
      if (b.life <= 0 || b.x < -120) b.mesh.visible = false;
    }
  }

  _getBolt(list, factory) {
    for (const b of list) if (!b.mesh.visible) return b;
    const mesh = factory(); this.scene.add(mesh);
    const b = { mesh, x: 0, life: 0 };
    list.push(b);
    return b;
  }

  // ---- Debug actions -------------------------------------------------------
  firePlayer() {
    const s = this.jetState;
    const b = this._getBolt(this.playerBolts, createPlayerBullet);
    b.x = s.x + 7; b.life = 1.6;
    b.mesh.position.set(b.x, s.y, s.z); b.mesh.rotation.set(0, 0, 0); b.mesh.visible = true;
    this.effects.spawnMuzzle(b.x, s.y, s.z);
    if (this.audio) this.audio.playerShoot();
  }
  fireEnemy() {
    const b = this._getBolt(this.enemyBolts, createEnemyBullet);
    b.x = this.enemyA.position.x - 6; b.life = 2.0;
    b.mesh.position.set(b.x, this.enemyA.position.y, this.enemyA.position.z);
    b.mesh.visible = true;
    if (this.audio) this.audio.enemyShoot();
  }
  explode(kind) {
    const x = 6, y = 22, z = -4;
    if (kind === 'small') { this.effects.spawnExplosion(x, y, z, { scale: 1.1 }); this.audio && this.audio.explosionSmall(); }
    else if (kind === 'big') { this.effects.spawnExplosion(x, y, z, { big: true, scale: 1.8 }); this.audio && this.audio.explosionBig(); }
    else if (kind === 'bomb') {
      this.effects.spawnShockwave(x, 2, z, GAME.BOMB_RADIUS * 0.5, PALETTE.bomb);
      this.effects.spawnExplosion(x, 14, z, { big: true, scale: 2.4 });
      this.audio && this.audio.bomb();
    } else if (kind === 'muzzle') { this.effects.spawnMuzzle(x, y, z); }
  }

  /** Recolour an element live (PALETTE + cached materials + local env/bolts). */
  setColor(key, hex) {
    setMatColor(key, hex);
    // city env
    if (key === 'sky') this.scene.background.setHex(hex);
    else if (key === 'ground') this._groundMat && this._groundMat.color.setHex(hex);
    else if (key === 'road') { if (this._roadMat) { this._roadMat.color.setHex(hex); this._roadMat.emissive.setHex(hex); } }
    else if (key === 'roadLine') { if (this._dashMat) { this._dashMat.color.setHex(hex); this._dashMat.emissive.setHex(hex); } }
    else if (key === 'roadEdge') { if (this._edgeMat) { this._edgeMat.color.setHex(hex); this._edgeMat.emissive.setHex(hex); } }
    // canyon env
    else if (key === 'canyonSky') this.scene.background.setHex(hex);
    else if (key === 'canyonFloor') this._canyonFloorMat && this._canyonFloorMat.color.setHex(hex);
    else if (key === 'canyonFloorEdge') this._canyonEdgeMat && this._canyonEdgeMat.color.setHex(hex);
    else if (key === 'canyonMesa') this._mesaMat && this._mesaMat.color.setHex(hex);
    else if (key === 'river') { if (this._riverMat) { this._riverMat.color.setHex(hex); this._riverMat.emissive.setHex(hex); } }
    else if (key === 'riverEdge') { if (this._riverEdgeMat) { this._riverEdgeMat.color.setHex(hex); this._riverEdgeMat.emissive.setHex(hex); } }
    // bolts read PALETTE at build time, so rebuild the static samples (blade or core)
    else if (key.startsWith('playerBullet') || key.startsWith('enemyBullet')) this._rebuildSampleBolts();
  }
}
