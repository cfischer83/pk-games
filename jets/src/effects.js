// =============================================================================
// JETS — effects: explosions, shockwaves, muzzle flashes (pooled)
// =============================================================================
// A single pre-allocated pool of bright additive particles plus a pool of
// expanding ring meshes. Nothing allocates during gameplay after construction.
// Coordinate conventions per config.js (+X forward, +Y up, +Z right).
// =============================================================================

import * as THREE from 'three';
import { PALETTE } from './config.js';

const PARTICLE_COUNT = 280;   // shared spark/shard/smoke pool
const RING_COUNT = 8;         // shockwave rings

const EXPLOSION_COLORS = [
  PALETTE.explosionHot,
  PALETTE.explosionMid,
  PALETTE.explosionLow,
];

export class Effects {
  /** @param {THREE.Scene|THREE.Object3D} parent where effect meshes are added */
  constructor(parent) {
    this.parent = parent;
    this._tmp = new THREE.Vector3();

    // ---- Particle pool ----
    // Shared octahedron geometry (cheap, faceted spark look). Each particle owns
    // its own MeshBasicMaterial so opacity/color can fade independently.
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    this._sharedGeo = geo;
    this.particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(geo, m);
      mesh.visible = false;
      mesh.frustumCulled = false;
      parent.add(mesh);
      this.particles.push({
        mesh, mat: m,
        vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1,
        spin: 0, baseScale: 1,
        gravity: 0, drag: 0.9,
        fadeColor: false,
      });
    }
    this._nextParticle = 0;

    // ---- Ring (shockwave) pool ----
    const ringGeo = new THREE.RingGeometry(0.7, 1.0, 40);
    ringGeo.rotateX(-Math.PI / 2);   // lie flat-ish; rings are oriented per use
    this._ringGeo = ringGeo;
    this.rings = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: PALETTE.bombFlash,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(ringGeo, m);
      mesh.visible = false;
      mesh.frustumCulled = false;
      parent.add(mesh);
      this.rings.push({ mesh, mat: m, life: 0, maxLife: 1, maxRadius: 10, axis: 'y' });
    }
    this._nextRing = 0;
  }

  _getParticle() {
    const p = this.particles[this._nextParticle];
    this._nextParticle = (this._nextParticle + 1) % this.particles.length;
    // Reset to a clean default so a slot recycled from an as-yet-unfinished
    // smoke puff doesn't inherit NormalBlending / the smoke update branch.
    p._smoke = false;
    p.mat.blending = THREE.AdditiveBlending;
    p.mesh.rotation.set(0, 0, 0);
    return p;
  }

  _getRing() {
    const r = this.rings[this._nextRing];
    this._nextRing = (this._nextRing + 1) % this.rings.length;
    return r;
  }

  /**
   * Spawn an explosion at a world position.
   * @param {number} x @param {number} y @param {number} z
   * @param {{big?:boolean, scale?:number}} [opts]
   */
  spawnExplosion(x, y, z, opts = {}) {
    const big = !!opts.big;
    const scale = opts.scale ?? (big ? 1.6 : 1);
    const shardCount = big ? 26 : 14;
    const smokeCount = big ? 8 : 4;

    // Flash core: a couple of bright fast-fading spheres.
    for (let i = 0; i < (big ? 3 : 2); i++) {
      const p = this._getParticle();
      p.mesh.position.set(x, y, z);
      p.vx = p.vy = p.vz = 0;
      p.life = p.maxLife = (big ? 0.28 : 0.2);
      p.baseScale = (big ? 5.5 : 3.2) * scale * (1 + i * 0.4);
      p.spin = 0;
      p.gravity = 0;
      p.drag = 1;
      p.fadeColor = false;
      p.mat.color.setHex(PALETTE.explosionHot);
      p.mat.opacity = 1;
      p.mesh.scale.setScalar(p.baseScale * 0.35);
      p.mesh.visible = true;
    }

    // Shards: bright faceted bits flung outward with a little gravity.
    for (let i = 0; i < shardCount; i++) {
      const p = this._getParticle();
      p.mesh.position.set(x, y, z);
      const speed = (18 + Math.random() * 30) * scale;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.cos(phi) * speed * 0.8 + 6;
      p.vz = Math.sin(phi) * Math.sin(theta) * speed;
      p.life = p.maxLife = 0.45 + Math.random() * (big ? 0.6 : 0.4);
      p.baseScale = (0.9 + Math.random() * 1.6) * scale;
      p.spin = (Math.random() - 0.5) * 12;
      p.gravity = -34;
      p.drag = 0.86;
      p.fadeColor = true;
      const c = EXPLOSION_COLORS[(Math.random() * EXPLOSION_COLORS.length) | 0];
      p.mat.color.setHex(c);
      p.mat.opacity = 1;
      p.mesh.scale.setScalar(p.baseScale);
      p.mesh.visible = true;
    }

    // Smoke: slow dark puffs that rise and expand.
    for (let i = 0; i < smokeCount; i++) {
      const p = this._getParticle();
      p.mesh.position.set(
        x + (Math.random() - 0.5) * 3,
        y + (Math.random() - 0.5) * 3,
        z + (Math.random() - 0.5) * 3
      );
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = 6 + Math.random() * 8;
      p.vz = (Math.random() - 0.5) * 8;
      p.life = p.maxLife = 0.8 + Math.random() * 0.7;
      p.baseScale = (2 + Math.random() * 3) * scale;
      p.spin = (Math.random() - 0.5) * 3;
      p.gravity = 2;
      p.drag = 0.9;
      p.fadeColor = false;
      p.mat.color.setHex(PALETTE.smoke);
      p.mat.opacity = 0.7;
      p.mat.blending = THREE.NormalBlending;
      p.mesh.scale.setScalar(p.baseScale * 0.5);
      p.mesh.visible = true;
      // restore additive for the next reuse handled at spawn time of sparks
      p._smoke = true;
    }
  }

  /** Expanding flat shockwave ring (used by the smart bomb). */
  spawnShockwave(x, y, z, maxRadius = 60, color = PALETTE.bombFlash) {
    const r = this._getRing();
    r.mesh.position.set(x, y, z);
    r.mesh.scale.setScalar(0.5);
    r.life = r.maxLife = 0.7;
    r.maxRadius = maxRadius;
    r.mat.color.setHex(color);
    r.mat.opacity = 0.9;
    r.mesh.visible = true;
  }

  /** Small bright muzzle flash at the gun position. */
  spawnMuzzle(x, y, z) {
    const p = this._getParticle();
    p.mesh.position.set(x, y, z);
    p.vx = p.vy = p.vz = 0;
    p.life = p.maxLife = 0.09;
    p.baseScale = 2.0;
    p.spin = 0;
    p.gravity = 0;
    p.drag = 1;
    p.fadeColor = false;
    p.mat.color.setHex(PALETTE.playerBullet);
    p.mat.blending = THREE.AdditiveBlending;
    p.mat.opacity = 1;
    p.mesh.scale.setScalar(p.baseScale);
    p.mesh.visible = true;
    p._smoke = false;
  }

  update(dt) {
    // Particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.mesh.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mat.opacity = 0;
        // reset blending to additive default for next reuse
        if (p._smoke) { p.mat.blending = THREE.AdditiveBlending; p._smoke = false; }
        continue;
      }
      const k = p.life / p.maxLife;     // 1 -> 0
      // integrate
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vz *= p.drag;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.spin) p.mesh.rotation.y += p.spin * dt;
      if (p.spin) p.mesh.rotation.x += p.spin * 0.6 * dt;

      if (p._smoke) {
        // grow and fade
        const s = p.baseScale * (1.4 - 0.9 * k);
        p.mesh.scale.setScalar(s);
        p.mat.opacity = 0.7 * k;
      } else if (p.gravity === 0 && p.drag === 1) {
        // flash / muzzle: shrink and fade fast
        p.mesh.scale.setScalar(p.baseScale * (0.4 + 0.6 * (1 - k)));
        p.mat.opacity = k;
      } else {
        // shard: gentle shrink, fade, optional color cool-down
        p.mesh.scale.setScalar(p.baseScale * (0.4 + 0.6 * k));
        p.mat.opacity = Math.min(1, k * 1.6);
        if (p.fadeColor && k < 0.5) p.mat.color.setHex(PALETTE.explosionLow);
      }
    }

    // Rings
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (!r.mesh.visible) continue;
      r.life -= dt;
      if (r.life <= 0) { r.mesh.visible = false; r.mat.opacity = 0; continue; }
      const k = r.life / r.maxLife;     // 1 -> 0
      const radius = r.maxRadius * (1 - k);
      r.mesh.scale.setScalar(Math.max(0.5, radius));
      r.mat.opacity = 0.9 * k;
    }
  }

  /** Hide everything (level reset). */
  reset() {
    for (const p of this.particles) { p.mesh.visible = false; p.mat.opacity = 0; }
    for (const r of this.rings) { r.mesh.visible = false; r.mat.opacity = 0; }
    this._nextParticle = 0;
    this._nextRing = 0;
  }
}
