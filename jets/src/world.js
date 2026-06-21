// =============================================================================
// JETS — streaming world / city environment (grid-based)
// =============================================================================
// The player advances along +X forever; the world streams under it.
//   * Ground + longitudinal roads follow the player continuously (uniform along
//     X, so repositioning is invisible).
//   * Cross-streets, road dashes and intersection tiles live in a "snap" group
//     repositioned to the cross-street pitch, so the periodic grid scrolls
//     seamlessly with zero per-frame allocation.
//   * Buildings + hills are pre-built ONCE into pools and streamed by
//     repositioning them onto a CITY GRID: they sit axis-aligned in the blocks
//     BETWEEN the roads (never on a road) and line up parallel to the grid.
// =============================================================================

import * as THREE from 'three';
import { PALETTE, GAME } from './config.js';
import { createBuilding, createHill } from './meshes.js';

const GROUND_W = 1040;           // ground width (Z) — wide enough that long cross-streets stay on ground
const GROUND_L = 1500;           // ground length (X)

// Longitudinal roads (run along X). Centers in Z; each ROAD_W wide.
const ROAD_Z = [-78, -26, 26, 78];
const ROAD_W = 16;
const HALF_ROAD = ROAD_W / 2;

// Cross-streets (run along Z), spaced every SEG_PITCH along X.
const SEG_PITCH = 120;
const SEG_RANGE = [-2, 7];       // snap-pattern segments laid around the player
const CROSS_HALF_Z = 480;        // long cross-streets that recede into the fog (appear endless)

// City blocks: building columns sit at these Z centers — the midpoints between
// roads, plus two outer scenery columns. Axis-aligned, so they parallel the grid.
const BLOCK_COLUMNS = [-104, -52, 0, 52, 104];
const BLOCK_HALF_Z = 15;         // max building half-depth so it stays off the roads

// Building "lots" within a segment (fractions of SEG_PITCH between cross-streets).
const LOT_OFFSETS = [0.32, 0.68];

const DASH_PITCH = 12;           // 120/12 = 10 dashes/segment -> seamless, even spacing

const BUILDING_POOL = 52;   // >= peak demand (5 segments x 2 lots x 5 columns)
const HILL_POOL = 10;

function std(color, emissive, ei = 0) {
  return new THREE.MeshStandardMaterial({
    color, roughness: 0.7, metalness: 0.05,
    emissive: emissive ?? 0x000000, emissiveIntensity: ei,
  });
}

export class World {
  /** @param {THREE.Scene} scene */
  constructor(scene) {
    this.scene = scene;
    this.finishX = Infinity;     // set per-level; obstacles clear around it

    this.follow = new THREE.Group();
    scene.add(this.follow);
    this._buildGround();

    this.snap = new THREE.Group();
    scene.add(this.snap);
    this._buildDecor();

    this.buildingPool = [];
    this.hillPool = [];
    this._buildObstaclePools();

    this.activeObstacles = [];
    this._nextSegX = 0;
    this._rng = mulberry32(0x9e3779b9);
  }

  /** Tell the world where the finish gate is, so it leaves that span clear. */
  setFinish(x) { this.finishX = x; }

  // ---- Static ground + longitudinal roads ----------------------------------
  _buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_L, GROUND_W),
      std(PALETTE.ground, 0x000000, 0));
    ground.rotation.x = -Math.PI / 2;
    this.follow.add(ground);

    const edgeMat = std(PALETTE.groundEdge, PALETTE.grid, 0.12);
    for (const sgn of [-1, 1]) {
      const edge = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_L, 70), edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(0, 0.02, sgn * (GROUND_W / 2 - 45));
      this.follow.add(edge);
    }

    const roadMat = std(PALETTE.road, PALETTE.road, 0.2);
    const roadEdgeMat = std(PALETTE.roadEdge, PALETTE.roadEdge, 0.55);
    for (const z of ROAD_Z) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_L, ROAD_W), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.04, z);
      this.follow.add(road);
      for (const sgn of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_L, 0.7), roadEdgeMat);
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.06, z + sgn * (HALF_ROAD - 0.5));
        this.follow.add(line);
      }
    }
  }

  // ---- Periodic grid decor: cross-streets, dashes, intersections -----------
  _buildDecor() {
    const [segLo, segHi] = SEG_RANGE;
    const segCount = segHi - segLo + 1;

    const roadMat = std(PALETTE.road, PALETTE.road, 0.2);
    const dashMat = std(PALETTE.roadLine, PALETTE.roadLine, 0.6);
    const interMat = std(PALETTE.roadEdge, PALETTE.roadEdge, 0.45);

    // Cross-streets (one band per segment; cheap).
    const crossGeo = new THREE.PlaneGeometry(ROAD_W, CROSS_HALF_Z * 2);
    for (let s = segLo; s <= segHi; s++) {
      const cross = new THREE.Mesh(crossGeo, roadMat);
      cross.rotation.x = -Math.PI / 2;
      cross.position.set(s * SEG_PITCH, 0.035, 0);
      this.snap.add(cross);
      // glowing edges of the cross-street
      for (const sgn of [-1, 1]) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.7, CROSS_HALF_Z * 2),
          std(PALETTE.roadEdge, PALETTE.roadEdge, 0.55));
        line.rotation.x = -Math.PI / 2;
        line.position.set(s * SEG_PITCH + sgn * (HALF_ROAD - 0.5), 0.055, 0);
        this.snap.add(line);
      }
    }

    const dashPerSeg = Math.round(SEG_PITCH / DASH_PITCH);   // 10

    // Longitudinal centre-line dashes (along X). Skip the dash that sits in the
    // intersection (offset 0) so crossings stay clean.
    const longGeo = new THREE.PlaneGeometry(5.5, 1.1);
    const longPos = [];
    for (let s = segLo; s <= segHi; s++) {
      for (const z of ROAD_Z) {
        for (let d = 1; d < dashPerSeg; d++) {
          longPos.push([s * SEG_PITCH + d * DASH_PITCH, z]);
        }
      }
    }
    this._addDashInstanced(longGeo, dashMat, longPos);

    // Cross-street centre-line dashes (along Z). Skip those that fall in an
    // intersection (near a longitudinal road).
    const crossDashGeo = new THREE.PlaneGeometry(1.1, 5.5);
    const crossPos = [];
    const jMax = Math.floor(CROSS_HALF_Z / DASH_PITCH);
    for (let s = segLo; s <= segHi; s++) {
      const x = s * SEG_PITCH;
      for (let j = -jMax; j <= jMax; j++) {
        const z = j * DASH_PITCH;
        let inIntersection = false;
        for (const rz of ROAD_Z) {
          if (Math.abs(z - rz) < HALF_ROAD + 2) { inIntersection = true; break; }
        }
        if (!inIntersection) crossPos.push([x, z]);
      }
    }
    this._addDashInstanced(crossDashGeo, dashMat, crossPos);

    // Intersection tiles: a brighter square where each road crosses a street,
    // laid on top so crossings read clearly.
    const interGeo = new THREE.PlaneGeometry(ROAD_W, ROAD_W);
    const interMesh = new THREE.InstancedMesh(interGeo, interMat, segCount * ROAD_Z.length);
    const dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;
    let ii = 0;
    for (let s = segLo; s <= segHi; s++) {
      for (const z of ROAD_Z) {
        dummy.position.set(s * SEG_PITCH, 0.09, z);
        dummy.updateMatrix();
        interMesh.setMatrixAt(ii++, dummy.matrix);
      }
    }
    interMesh.instanceMatrix.needsUpdate = true;
    interMesh.computeBoundingSphere();
    this.snap.add(interMesh);
  }

  /** Build one InstancedMesh of flat ground dashes from [x,z] positions. */
  _addDashInstanced(geo, mat, positions) {
    if (!positions.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, positions.length);
    const dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;
    for (let i = 0; i < positions.length; i++) {
      dummy.position.set(positions[i][0], 0.07, positions[i][1]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    this.snap.add(mesh);
  }

  // ---- Obstacle pools (built once, streamed by repositioning) --------------
  _buildObstaclePools() {
    const rng = mulberry32(1234567);
    for (let i = 0; i < BUILDING_POOL; i++) {
      const width = 9 + rng() * 12;            // X (along road)  9..21
      const depth = 10 + rng() * 16;           // Z (across block) 10..26 -> halfD <= 15
      const height = 11 + rng() * 36;          // 11..47
      const g = createBuilding({ width, depth, height, variant: i % 4 });
      g.visible = false;
      this.scene.add(g);
      this.buildingPool.push({
        group: g, type: 'building', active: false, x: 0, z: 0,
        halfW: g.userData.halfW, halfD: g.userData.halfD, height: g.userData.height,
      });
    }
    for (let i = 0; i < HILL_POOL; i++) {
      const radius = 8 + rng() * 5;            // 8..13 -> stays inside a block
      const height = 5 + rng() * 6;
      const g = createHill({ radius, height });
      g.visible = false;
      this.scene.add(g);
      this.hillPool.push({
        group: g, type: 'hill', active: false, x: 0, z: 0, radius, height,
      });
    }
  }

  _firstInactive(pool) {
    for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  // ---- Lifecycle -----------------------------------------------------------
  reset(playerX = 0, level = null) {
    for (const b of this.buildingPool) { b.active = false; b.group.visible = false; }
    for (const h of this.hillPool) { h.active = false; h.group.visible = false; }
    this.activeObstacles.length = 0;
    // Start populating one segment ahead so the immediate launch area is open.
    this._nextSegX = Math.floor(playerX / SEG_PITCH) * SEG_PITCH + SEG_PITCH;
    this._rng = mulberry32(0x51ed2701);
    this._stream(playerX, 0, level);
  }

  update(dt, playerX, t, level) {
    this.follow.position.x = playerX;
    this.snap.position.x = Math.floor(playerX / SEG_PITCH) * SEG_PITCH;
    this._stream(playerX, t, level);
    this._recycle(playerX);
  }

  _stream(playerX, t, level) {
    const ahead = playerX + GAME.SPAWN_AHEAD;
    const density = level ? level.obstacleDensity(t) : 0.5;
    let guard = 0;
    while (this._nextSegX < ahead && guard++ < 32) {
      this._populateSegment(this._nextSegX, density, level);
      this._nextSegX += SEG_PITCH;
    }
  }

  _populateSegment(segStartX, density, level) {
    const rng = this._rng;
    for (const frac of LOT_OFFSETS) {
      const lotX = segStartX + frac * SEG_PITCH;
      for (let c = 0; c < BLOCK_COLUMNS.length; c++) {
        const blockZ = BLOCK_COLUMNS[c];
        const scenery = blockZ <= -100 || blockZ >= 100;
        const fill = scenery ? 0.6 : density;
        if (rng() > fill) continue;
        const wantHill = level && level.hills && !scenery && rng() < 0.15;
        // jitter along X within the lot (Z stays exactly on the block centre so
        // columns line up crisply parallel to the roads). Compute it first so the
        // finish-gate clear test reflects the building's actual position.
        const x = lotX + (rng() - 0.5) * 16;
        if (Math.abs(x - this.finishX) < 80) continue;
        const rec = this._firstInactive(wantHill ? this.hillPool : this.buildingPool)
          || this._firstInactive(this.buildingPool);
        if (!rec) continue;
        rec.active = true;
        rec.x = x;
        rec.z = blockZ;
        rec.group.position.set(rec.x, 0, rec.z);
        rec.group.rotation.y = 0;            // axis-aligned to the grid
        rec.group.visible = true;
        this.activeObstacles.push(rec);
      }
    }
  }

  _recycle(playerX) {
    const behind = playerX - GAME.DESPAWN_BEHIND;
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const rec = this.activeObstacles[i];
      if (rec.x < behind) {
        rec.active = false;
        rec.group.visible = false;
        const last = this.activeObstacles.pop();
        if (i < this.activeObstacles.length) this.activeObstacles[i] = last;
      }
    }
  }
}

// Deterministic PRNG so the city layout is varied but reproducible.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
