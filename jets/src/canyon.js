// =============================================================================
// JETS — Level 2 world: RED CANYON (streaming)
// =============================================================================
// Drop-in alternative to the city World (same interface the engine uses):
//   reset(playerX, level) · update(dt, playerX, t, level) · setFinish(x)
//   setVisible(v) · corridorAt(x) -> {center, half} · activeObstacles[]
//
// Instead of a flat grid of buildings, the player threads a winding rock
// corridor. Two streamed walls (left/right) define a passage whose CENTRE and
// HALF-WIDTH vary along X — narrow squeezes and open chambers. Free-standing
// SPIRES and HOODOOS dot the floor as collidable hazards; a winding RIVER and
// small CACTUS add life. Walls/spires/hoodoos collide via the engine's existing
// obstacle code ('wall' = AABB like a building but excluded from enemy climb;
// spires/hoodoos = 'building' AABB; cactus = low 'tree' cylinder).
//
// Coordinate convention matches the rest of the game: +X forward, +Y up,
// +Z strafe-right. Everything lives under `root` so the engine can hide it.
// =============================================================================

import * as THREE from 'three';
import { PALETTE, GAME } from './config.js';
import { createSpire, createHoodoo, createCactus, createCanyonWall, sandTexture, waterTexture } from './meshes.js';

const SEG = 26;                  // streaming pitch along X (one wall chunk each)
const WALL_LEN = SEG + 4;        // chunk length so neighbours overlap (continuous)
const WALL_DEPTH = 18;
const WALL_HALF_D = WALL_DEPTH / 2;

const FLOOR_W = 520;             // red floor width (Z)
const FLOOR_L = 1500;            // floor length (X) — scrolls with the player

const RIVER_W = 20;              // nominal river width (wavy banks vary it)

// Pool sizes — live span = (SPAWN_AHEAD + DESPAWN_BEHIND)/SEG ≈ 19 segments.
const WALL_POOL = 50;            // ~19 per side at once
const SPIRE_POOL = 28;           // denser hazards: up to ~2 tall rocks/segment
const HOODOO_POOL = 20;
const CACTUS_POOL = 18;

// --- Corridor shape (deterministic, smooth). center ±~20, half 52..82. -------
// Wide and roomy: even the narrow spots leave an ~104-wide lane; the centre only
// drifts ±20 so both walls stay near/within the player's ±78 strafe box.
export function corridorCenter(x) {
  return 14 * Math.sin(x * 0.0055) + 6 * Math.sin(x * 0.0131 + 1.3);
}
export function corridorHalf(x) {
  const w = 66 + 14 * Math.sin(x * 0.0088 + 0.4) + 5 * Math.sin(x * 0.02);
  return Math.max(52, Math.min(82, w));
}
// The river meanders on its own, crossing the corridor here and there.
function riverCenter(x) {
  return 18 * Math.sin(x * 0.0052 + 0.8) + 10 * Math.sin(x * 0.0125);
}
// Small per-bank wobble so the shoreline is irregular, not a straight line.
// Each bank passes a different phase → the two edges wander independently.
function bankWave(x, phase) {
  return 2.0 + 2.2 * Math.sin(x * 0.05 + phase) + 1.1 * Math.sin(x * 0.123 + phase * 1.7);
}

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: opts.roughness ?? 0.95, metalness: 0.0,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 0,
  });
}

export class CanyonWorld {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.finishX = Infinity;

    this.root = new THREE.Group();
    this.root.visible = false;            // hidden until the engine selects it
    scene.add(this.root);

    this.follow = new THREE.Group();      // floor + distant rims scroll with player
    this.root.add(this.follow);
    this._buildFloor();

    this.wallPool = [];
    this.spirePool = [];
    this.hoodooPool = [];
    this.cactusPool = [];
    this._buildPools();
    this._buildRiver();                   // one continuous ribbon (not tiles)

    this.activeObstacles = [];            // collidable (walls/spires/hoodoos/cactus)
    this._nextSegX = 0;
    this._rng = mulberry32(0xC0FFEE);
    this._corr = { center: 0, half: 0 };  // reused by corridorAt() (no alloc)
  }

  // ---- interface (matches city World) --------------------------------------
  setFinish(x) { this.finishX = x; }
  setVisible(v) { this.root.visible = v; }
  /** Returns a REUSED object (read it immediately) — no per-frame allocation. */
  corridorAt(x) { this._corr.center = corridorCenter(x); this._corr.half = corridorHalf(x); return this._corr; }

  // ---- Floor + distant canyon rims (uniform along X → scrolls invisibly) ---
  _buildFloor() {
    // Own clone of the sand texture so we can scroll its UVs without disturbing
    // the gallery's floor. The floor mesh rides the follow group (locked to the
    // player in X), so we offset the texture by playerX to keep the pattern
    // world-locked — it then streams beneath the player as they advance.
    this.floorTex = sandTexture().clone();
    this.floorTex.needsUpdate = true;
    this._floorTileX = FLOOR_L / this.floorTex.repeat.x;
    const floorMat = new THREE.MeshStandardMaterial({
      color: PALETTE.canyonFloor, map: this.floorTex, roughness: 1.0, metalness: 0.0 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_L, FLOOR_W), floorMat);
    floor.rotation.x = -Math.PI / 2;
    this.follow.add(floor);

    // darker scrub bands toward the edges for grounding/contrast
    const edgeMat = std(PALETTE.canyonFloorEdge);
    for (const sgn of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_L, 120), edgeMat);
      band.rotation.x = -Math.PI / 2;
      band.position.set(0, 0.02, sgn * (FLOOR_W / 2 - 70));
      this.follow.add(band);
    }

    // Distant mesa rims: tall dark planes far out on each side, fogged into the
    // haze for depth behind the playable walls.
    const mesaMat = std(PALETTE.canyonMesa);
    for (const sgn of [-1, 1]) {
      const mesa = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR_L, 150), mesaMat);
      mesa.position.set(0, 60, sgn * 230);
      mesa.rotation.y = sgn > 0 ? Math.PI : 0;   // face inward
      this.follow.add(mesa);
    }
  }

  // ---- Pools (built once; streamed by repositioning) -----------------------
  _buildPools() {
    const rng = mulberry32(20240628);
    for (let i = 0; i < WALL_POOL; i++) {
      const height = 84 + rng() * 18;
      const g = createCanyonWall({ length: WALL_LEN, depth: WALL_DEPTH, height, seed: (i + 1) * 2654435761 });
      g.visible = false;
      this.root.add(g);
      this.wallPool.push({
        group: g, type: 'wall', active: false, x: 0, z: 0,
        halfW: g.userData.halfW, halfD: g.userData.halfD, height: g.userData.height,
      });
    }
    for (let i = 0; i < SPIRE_POOL; i++) {
      const height = 30 + rng() * 30;       // 30..60
      const radius = 4 + rng() * 3;
      const g = createSpire({ height, radius, seed: (i + 7) * 40503 });
      g.visible = false;
      this.root.add(g);
      this.spirePool.push({
        group: g, type: 'building', active: false, x: 0, z: 0,
        halfW: radius * 0.85, halfD: radius * 0.85, height,
      });
    }
    for (let i = 0; i < HOODOO_POOL; i++) {
      const height = 18 + rng() * 16;       // 18..34
      const g = createHoodoo({ height, radius: 3 + rng() * 1.5, seed: (i + 3) * 19937 });
      g.visible = false;
      this.root.add(g);
      const capR = g.userData.radius;
      this.hoodooPool.push({
        group: g, type: 'building', active: false, x: 0, z: 0,
        halfW: capR * 0.7, halfD: capR * 0.7, height,
      });
    }
    for (let i = 0; i < CACTUS_POOL; i++) {
      const height = 7 + rng() * 6;         // 7..13
      const g = createCactus({ height, seed: (i + 11) * 6151 });
      g.visible = false;
      this.root.add(g);
      this.cactusPool.push({
        group: g, type: 'tree', active: false, x: 0, z: 0,
        radius: g.userData.radius, height,
      });
    }
  }

  // ---- River: ONE continuous, world-anchored ribbon with wavy soft banks. ---
  // A strip of cross-sections whose vertices are recomputed each frame to the
  // world span around the player (so it scrolls under you and follows the
  // meander). No tiles → no rectangular seams or overlap double-blending; the
  // banks are wavy (bankWave) and the texture feathers them softly into the floor.
  _buildRiver() {
    const SECTIONS = 81;
    this._riverSections = SECTIONS;
    // Own texture clone (repeat 1): the ribbon bakes tiling into its UVs and we
    // scroll the clone's offset for flow, without disturbing the gallery texture.
    this._riverTex = waterTexture().clone();
    this._riverTex.repeat.set(1, 1);
    this._riverTex.needsUpdate = true;
    this._flow = 0;
    this.riverMat = new THREE.MeshStandardMaterial({
      color: PALETTE.river, map: this._riverTex, bumpMap: this._riverTex, bumpScale: 0.25,
      emissive: PALETTE.river, emissiveIntensity: 0.16, roughness: 0.25, metalness: 0.0,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
    });
    const pos = new Float32Array(SECTIONS * 2 * 3);
    const uv = new Float32Array(SECTIONS * 2 * 2);
    const index = [];
    for (let i = 0; i < SECTIONS - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      index.push(a, c, b, b, c, d);
    }
    // The ribbon is a flat horizontal sheet (every vertex y=0.05), so all normals
    // point straight up. A hand-built BufferGeometry has NO normals unless we set
    // them — without this the MeshStandardMaterial lighting (and the bumpMap)
    // collapse and the water renders unlit. Set once; it never tilts.
    const nor = new Float32Array(SECTIONS * 2 * 3);
    for (let i = 0; i < SECTIONS * 2; i++) nor[i * 3 + 1] = 1;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    this._riverGeo = geo;
    const mesh = new THREE.Mesh(geo, this.riverMat);
    mesh.frustumCulled = false;           // vertices move every frame
    mesh.renderOrder = 1;                 // drawn over the floor
    this.root.add(mesh);
  }

  /** Reposition the ribbon to the world span around the player (continuous,
   *  world-anchored so it streams under you, with irregular wavy banks). */
  _updateRiver(playerX) {
    const S = this._riverSections;
    const span = GAME.SPAWN_AHEAD + GAME.DESPAWN_BEHIND;
    const step = span / (S - 1);
    const halfW = RIVER_W / 2;
    const texLen = 9;                     // world units per texture repeat (flow)
    const pos = this._riverGeo.attributes.position;
    const uv = this._riverGeo.attributes.uv;
    const startX = playerX - GAME.DESPAWN_BEHIND;
    for (let i = 0; i < S; i++) {
      const wx = startX + i * step;
      const cz = riverCenter(wx);
      const lz = cz - halfW - bankWave(wx, 0.0);
      const rz = cz + halfW + bankWave(wx, 2.3);
      pos.setXYZ(i * 2, wx, 0.05, lz);
      pos.setXYZ(i * 2 + 1, wx, 0.05, rz);
      const u = wx / texLen;
      uv.setXY(i * 2, u, 0);
      uv.setXY(i * 2 + 1, u, 1);
    }
    pos.needsUpdate = true;
    uv.needsUpdate = true;
  }

  _firstInactive(pool) {
    for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  // ---- Lifecycle -----------------------------------------------------------
  reset(playerX = 0, level = null) {
    for (const p of [this.wallPool, this.spirePool, this.hoodooPool, this.cactusPool]) {
      for (const r of p) { r.active = false; r.group.visible = false; }
    }
    this.activeObstacles.length = 0;
    this._nextSegX = Math.floor(playerX / SEG) * SEG;
    this._rng = mulberry32(0x1234C0DE);
    this._stream(playerX, 0, level);
    this._updateRiver(playerX);          // position the ribbon for the first frame
  }

  update(dt, playerX, t, level) {
    this.follow.position.x = playerX;
    // Ground rides the follow group, so offset its texture by playerX to keep
    // the pattern world-locked — it then streams under the player as they fly.
    if (this.floorTex) this.floorTex.offset.x = (playerX / this._floorTileX) % 1;
    // Re-fit the continuous river ribbon to the player's span, then scroll its
    // UVs a touch so the surface appears to flow downstream.
    this._updateRiver(playerX);
    if (this._riverTex) { this._flow = (this._flow + dt * 0.15) % 1; this._riverTex.offset.x = this._flow; }
    this._stream(playerX, t, level);
    this._recycle(playerX);
  }

  _stream(playerX, t, level) {
    const ahead = playerX + GAME.SPAWN_AHEAD;
    const density = level ? level.obstacleDensity(t) : 0.6;
    let guard = 0;
    while (this._nextSegX < ahead && guard++ < 64) {
      this._populateSegment(this._nextSegX, density);
      this._nextSegX += SEG;
    }
  }

  _populateSegment(segStartX, density) {
    const rng = this._rng;
    const midX = segStartX + SEG / 2;
    const center = corridorCenter(midX);
    const half = corridorHalf(midX);

    // --- Left + right walls (always) ---
    this._placeWall(midX, center - half, -1);
    this._placeWall(midX, center + half, +1);
    // (The river is a single continuous ribbon updated in _updateRiver(), not
    //  streamed per segment.)

    // Leave a clear span around the finish line (walls still flank it).
    const nearFinish = Math.abs(midX - this.finishX) < 80;
    if (nearFinish) return;

    const innerPad = 8;                       // keep hazards off the walls
    const usable = Math.max(0, half - innerPad);

    // --- Tall hazards (spires + hoodoos): one most segments, a second in the
    // wider stretches, so the canyon feels populated without clogging. ---
    const placeTall = () => {
      const wantHoodoo = rng() < 0.45;
      const rec = this._firstInactive(wantHoodoo ? this.hoodooPool : this.spirePool)
                || this._firstInactive(this.spirePool) || this._firstInactive(this.hoodooPool);
      if (!rec) return;
      const z = center + (rng() - 0.5) * 2 * usable;
      this._place(rec, midX + (rng() - 0.5) * (SEG * 0.6), z, rng() * Math.PI * 2);
    };
    if (rng() < 0.6 + density * 0.35) placeTall();
    if (half > 62 && rng() < 0.45 + density * 0.3) placeTall();   // a second in wide chambers

    // --- A low cactus (cheap, decorative; only matters if you fly very low) ---
    if (rng() < 0.45) {
      const rec = this._firstInactive(this.cactusPool);
      if (rec) {
        const z = center + (rng() - 0.5) * 2 * Math.max(0, half - 5);
        this._place(rec, midX + (rng() - 0.5) * (SEG * 0.6), z, rng() * Math.PI * 2);
      }
    }
  }

  _placeWall(midX, edgeZ, side) {
    const rec = this._firstInactive(this.wallPool);
    if (!rec) return;
    // Push the chunk OUTWARD by its half-depth so its inner face sits on edgeZ.
    rec.active = true;
    rec.x = midX;
    rec.z = edgeZ + side * WALL_HALF_D;
    rec.group.position.set(rec.x, 0, rec.z);
    rec.group.visible = true;
    this.activeObstacles.push(rec);
  }

  _place(rec, x, z, ry) {
    rec.active = true;
    rec.x = x; rec.z = z;
    rec.group.position.set(x, 0, z);
    rec.group.rotation.y = ry;
    rec.group.visible = true;
    this.activeObstacles.push(rec);
  }

  _recycle(playerX) {
    const behind = playerX - GAME.DESPAWN_BEHIND;
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const rec = this.activeObstacles[i];
      if (rec.x < behind) {
        rec.active = false; rec.group.visible = false;
        const last = this.activeObstacles.pop();
        if (i < this.activeObstacles.length) this.activeObstacles[i] = last;
      }
    }
  }
}

// Deterministic PRNG (matches world.js) so the canyon layout is varied but stable.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
