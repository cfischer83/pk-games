// =============================================================================
// JETS — procedural mesh builders
// =============================================================================
// Pure geometry, no textures, no external models. Vibrant low-poly-but-detailed
// "modern Zaxxon" look. Materials use MeshStandardMaterial; glowing parts use
// emissive + emissiveIntensity so they pop under the scene's lights.
//
// Coordinate conventions (see config.js):
//   +X = FORWARD (nose direction for player jet)
//   +Y = UP (ground at y = 0)
//   +Z = RIGHT (strafe)
//
// Every builder returns a FRESH Group/Mesh each call (the game spawns many),
// but SHARED material instances are cached at module scope where the look is
// identical across instances (cheaper, fewer GPU programs).
// =============================================================================

import * as THREE from 'three';
import { PALETTE } from './config.js';

// -----------------------------------------------------------------------------
// Material factory helpers + module-scope cache
// -----------------------------------------------------------------------------

/**
 * Build a standard surface material (matte-ish painted metal look).
 * @param {number} color   hex
 * @param {object} [opts]  { roughness, metalness, emissive, emissiveIntensity,
 *                           transparent, opacity, flatShading }
 */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.6,
    // Low metalness by default: there is no environment map, so metallic surfaces
    // would reflect a black void and read as dark/muddy. Matte = colors show true.
    metalness: opts.metalness ?? 0.05,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 1.0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    flatShading: opts.flatShading ?? true,
    depthWrite: opts.depthWrite ?? true,
    side: opts.side ?? THREE.FrontSide,
  });
}

// ---- Shared materials (reused across all instances) ------------------------
// Player jet
const M = {
  jetBody:      mat(PALETTE.jetBody,     { roughness: 0.5, metalness: 0.05 }),
  jetBodyDark:  mat(PALETTE.jetBodyDark, { roughness: 0.55, metalness: 0.08 }),
  jetAccent:    mat(PALETTE.jetAccent,   { roughness: 0.5, metalness: 0.05,
                                           emissive: PALETTE.jetAccent, emissiveIntensity: 0.18 }),
  jetCockpit:   mat(PALETTE.jetCockpit,  { roughness: 0.2, metalness: 0.1,
                                           emissive: PALETTE.jetCockpit, emissiveIntensity: 0.55 }),
  jetEngine:    mat(PALETTE.jetEngine,   { roughness: 0.3, metalness: 0.05,
                                           emissive: PALETTE.jetEngine, emissiveIntensity: 1.7 }),
  jetIntake:    mat(PALETTE.jetIntake,   { roughness: 0.75, metalness: 0.08 }),

  // Enemy jet
  enemyBody:     mat(PALETTE.enemyBody,     { roughness: 0.5, metalness: 0.05 }),
  enemyBodyDark: mat(PALETTE.enemyBodyDark, { roughness: 0.6, metalness: 0.08 }),
  enemyAccent:   mat(PALETTE.enemyAccent,   { roughness: 0.65, metalness: 0.06 }),
  enemyCockpit:  mat(PALETTE.enemyCockpit,  { roughness: 0.25, metalness: 0.1,
                                              emissive: PALETTE.enemyCockpit, emissiveIntensity: 0.7 }),
  enemyEngine:   mat(PALETTE.jetEngine,     { roughness: 0.3, metalness: 0.05,
                                              emissive: PALETTE.enemyBody, emissiveIntensity: 1.4 }),

  // Buildings
  buildingTop:  mat(PALETTE.buildingTop, { roughness: 0.85, metalness: 0.05 }),
  roofDetail:   mat(PALETTE.buildingTop, { roughness: 0.75, metalness: 0.08 }),

  // Hill
  hill:     mat(PALETTE.hill,     { roughness: 0.9, metalness: 0.0 }),
  hillDark: mat(PALETTE.hillDark, { roughness: 0.95, metalness: 0.0 }),

  // Tree
  treeTrunk: mat(PALETTE.treeTrunk, { roughness: 0.9, metalness: 0.0 }),
  treeLeaf:  mat(PALETTE.treeLeaf,  { roughness: 0.85, metalness: 0.0 }),
  treeLeaf2: mat(PALETTE.treeLeaf2, { roughness: 0.85, metalness: 0.0 }),

  // Window materials (3 looks, reused for every building's window quads)
  windowLit:  new THREE.MeshStandardMaterial({
    color: PALETTE.windowLit, roughness: 0.3, metalness: 0.1,
    emissive: PALETTE.windowLit, emissiveIntensity: 0.9, side: THREE.DoubleSide,
  }),
  windowLit2: new THREE.MeshStandardMaterial({
    color: PALETTE.windowLit2, roughness: 0.3, metalness: 0.1,
    emissive: PALETTE.windowLit2, emissiveIntensity: 0.8, side: THREE.DoubleSide,
  }),
  windowDark: new THREE.MeshStandardMaterial({
    color: PALETTE.windowDark, roughness: 0.6, metalness: 0.2,
    emissive: PALETTE.windowDark, emissiveIntensity: 0.25, side: THREE.DoubleSide,
  }),

  // Projectiles
  playerBullet: new THREE.MeshStandardMaterial({
    color: PALETTE.playerBulletCore, roughness: 0.2, metalness: 0.0,
    emissive: PALETTE.playerBullet, emissiveIntensity: 2.4,
  }),
  enemyBullet: new THREE.MeshStandardMaterial({
    color: PALETTE.enemyBulletCore, roughness: 0.2, metalness: 0.0,
    emissive: PALETTE.enemyBullet, emissiveIntensity: 2.6,
  }),

  // Bomb
  bombBody:  mat(PALETTE.bomb,  { roughness: 0.45, metalness: 0.1 }),
  bombFin:   mat(PALETTE.enemyAccent, { roughness: 0.65, metalness: 0.08 }),
  bombTip:   new THREE.MeshStandardMaterial({
    color: PALETTE.bombFlash, roughness: 0.2, metalness: 0.0,
    emissive: PALETTE.bombFlash, emissiveIntensity: 2.0,
  }),

  // Shadow
  shadow: new THREE.MeshBasicMaterial({
    color: PALETTE.shadow, transparent: true, opacity: 0.32,
    depthWrite: false, side: THREE.DoubleSide,
  }),
};

// Building body materials keyed by variant (cached; reused across buildings).
const BUILDING_BODY = [
  mat(PALETTE.buildingA, { roughness: 0.75, metalness: 0.06 }),
  mat(PALETTE.buildingB, { roughness: 0.75, metalness: 0.06 }),
  mat(PALETTE.buildingC, { roughness: 0.75, metalness: 0.06 }),
  mat(PALETTE.buildingD, { roughness: 0.75, metalness: 0.06 }),
];

// Shared instanced-window resources. Every building renders ALL of its windows
// as a single InstancedMesh (one draw call) instead of hundreds of meshes.
// MeshBasicMaterial = full-bright "glowing window" look; per-instance color
// varies lit/warm/dark. Geometry + material are shared across all buildings.
const WINDOW_GEO = new THREE.PlaneGeometry(1.6, 1.6);
const WINDOW_MAT = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false });
const _winDummy = new THREE.Object3D();
const _winColor = new THREE.Color();

// -----------------------------------------------------------------------------
// Glow sprites (fake bloom) — a soft additive billboard halo for bullets and
// engine exhaust so they read as glowing without full-scene post-processing.
// -----------------------------------------------------------------------------
let _glowTexture = null;
function glowTexture() {
  if (_glowTexture) return _glowTexture;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.30)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _glowTexture = new THREE.CanvasTexture(c);
  _glowTexture.colorSpace = THREE.SRGBColorSpace;
  return _glowTexture;
}

/** A camera-facing additive glow halo of the given color and world size. */
function glowSprite(color, size) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(), color,
    blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, depthTest: true, fog: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

// Shared engine-exhaust glow materials. Shared (not per-jet) so the gallery's
// colour editor can recolour every jet's exhaust glow live.
const ENGINE_GLOW = {
  player: new THREE.SpriteMaterial({
    map: glowTexture(), color: PALETTE.jetEngine,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }),
  enemy: new THREE.SpriteMaterial({
    map: glowTexture(), color: PALETTE.enemyEngine,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false }),
};

// -----------------------------------------------------------------------------
// Light-saber bolt: an opaque white-hot CORE, an additive colored BLADE sheath
// (hard-edged, bright) around it, and a soft additive GLOW halo. Shared geometry
// + materials (bolts are pooled, so per-instance allocation is avoided).
// -----------------------------------------------------------------------------
const _coreGeo = new THREE.CylinderGeometry(0.30, 0.30, 2.7, 10); _coreGeo.rotateZ(Math.PI / 2);
const _bladeGeo = new THREE.CylinderGeometry(0.52, 0.52, 2.5, 14); _bladeGeo.rotateZ(Math.PI / 2);
const _capGeo = new THREE.SphereGeometry(0.52, 12, 8);

function makeBolt(coreColor, bladeColor, glowColor, glowSize) {
  const g = new THREE.Group();
  // white-hot core (opaque, full-bright). fog:false so the whole bolt glows
  // consistently with its halo instead of tinting toward the sky at distance.
  const core = new THREE.Mesh(_coreGeo, new THREE.MeshBasicMaterial({ color: coreColor, toneMapped: false, fog: false }));
  g.add(core);
  // colored blade sheath (additive: white core shows through the middle, blade
  // color saturates toward the crisp geometric edge)
  const bladeMat = new THREE.MeshBasicMaterial({
    color: bladeColor, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  });
  const blade = new THREE.Mesh(_bladeGeo, bladeMat);
  g.add(blade);
  // rounded glowing tips
  for (const sx of [-1.25, 1.25]) {
    const cap = new THREE.Mesh(_capGeo, bladeMat);
    cap.position.x = sx;
    g.add(cap);
  }
  // soft outer aura
  g.add(glowSprite(glowColor, glowSize));
  return g;
}

// -----------------------------------------------------------------------------
// Small geometry helpers
// -----------------------------------------------------------------------------

/** Make a box mesh and place its center. */
function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

// =============================================================================
// PLAYER JET — F-16 style. NOSE points +X. Length ~10 (X), wingspan ~7 (Z).
// White/silver fuselage, swept delta wings, single tailfin, red accents,
// blue glass canopy, glowing rear exhaust. Mid-body centered at origin.
// =============================================================================
export function createPlayerJet() {
  const g = new THREE.Group();

  // --- Fuselage: a long tapered body. Built from a few stacked boxes so the
  // silhouette reads as a slender F-16 tube from the iso angle.
  // Main body runs roughly X = -5 (tail) to +3 (where nose cone starts).
  const body = box(7.2, 1.1, 1.5, M.jetBody, -0.6, 0, 0);
  g.add(body);

  // Slightly raised spine/dorsal hump behind the cockpit.
  const spine = box(3.4, 0.8, 1.1, M.jetBody, -1.6, 0.55, 0);
  g.add(spine);

  // --- Nose: cone tapering forward (+X). ConeGeometry points +Y by default;
  // rotate so the tip points +X.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.78, 3.0, 12), M.jetBody);
  nose.rotation.z = -Math.PI / 2;   // tip toward +X
  nose.position.set(4.4, 0, 0);
  g.add(nose);

  // Red nose-tip accent ring (pitot/radome cap).
  const noseCap = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.0, 10), M.jetAccent);
  noseCap.rotation.z = -Math.PI / 2;
  noseCap.position.set(5.7, 0, 0);
  g.add(noseCap);

  // --- Cockpit canopy: blue glass bubble just ahead of mid-body.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 10), M.jetCockpit);
  canopy.scale.set(2.1, 0.85, 0.92);   // stretch along X into a teardrop
  canopy.position.set(1.7, 0.7, 0);
  g.add(canopy);

  // --- Main wings: swept delta. Use a thin box rotated/sheared via a trapezoid
  // shape extrude for a clean swept-back look. Wingspan ~7 (Z = -3.5..3.5).
  const wing = buildSweptWing(M.jetBody, 3.5, 0.18);
  wing.position.set(-1.2, -0.05, 0);
  g.add(wing);

  // Red leading-edge stripe on each wing root for accent.
  const wingStripeR = box(2.2, 0.22, 0.9, M.jetAccent, -0.4, 0.02, 1.4);
  const wingStripeL = box(2.2, 0.22, 0.9, M.jetAccent, -0.4, 0.02, -1.4);
  g.add(wingStripeR, wingStripeL);

  // --- Horizontal tail stabilizers (small swept) near the rear.
  const htail = buildSweptWing(M.jetBodyDark, 1.7, 0.16, 0.9);
  htail.position.set(-4.2, 0.05, 0);
  htail.scale.set(0.7, 1, 1);
  g.add(htail);

  // --- Vertical tail fin (single), red. Triangular, leaning slightly back.
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(2.4, 0);
  finShape.lineTo(1.0, 2.2);
  finShape.lineTo(-0.2, 2.2);
  finShape.lineTo(0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.16, bevelEnabled: false });
  finGeo.translate(0, 0, -0.08);
  const fin = new THREE.Mesh(finGeo, M.jetAccent);
  // Shape lives in XY; we want fin standing in the X-Y plane at z=0 with the
  // wide base toward the tail. Map shape-X -> world -X (toward tail) and keep Y up.
  fin.rotation.y = 0;
  fin.position.set(-4.4, 0.45, 0);
  fin.rotation.z = 0;
  // Shape currently has its long edge along +X; flip so it sweeps toward the tail.
  fin.scale.x = -1;
  g.add(fin);

  // --- Engine nozzle + glowing afterburner at the rear (-X).
  const nozzle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.7, 0.9, 14), M.jetIntake);
  nozzle.rotation.z = Math.PI / 2;     // axis along X
  nozzle.position.set(-4.4, 0, 0);
  g.add(nozzle);

  const burner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.32, 1.4, 14), M.jetEngine);
  burner.rotation.z = Math.PI / 2;
  burner.position.set(-5.3, 0, 0);
  g.add(burner);

  // Glowing exhaust plume (shared additive halo material, recolourable).
  const exhaust = new THREE.Sprite(ENGINE_GLOW.player);
  exhaust.scale.set(6.5, 6.5, 1);
  exhaust.position.set(-6.4, 0, 0);
  g.add(exhaust);

  // Twin underbelly intake hint (dark) under the cockpit.
  const intake = box(2.0, 0.5, 1.2, M.jetIntake, 0.9, -0.6, 0);
  g.add(intake);

  g.userData = { hitRadius: 3.2 };
  return g;
}

// =============================================================================
// ENEMY JET — meaner delta-wing (MiG-ish). NOSE points -X (faces oncoming
// player). Crimson body, dark accents, glowing yellow cockpit, small engine
// glow. Wingspan ~6.5 (Z), length ~8 (X).
// =============================================================================
export function createEnemyJet() {
  const g = new THREE.Group();

  // Build the jet facing +X first, then rotate 180° about Y so the nose
  // ends up pointing -X (toward the player).
  const inner = new THREE.Group();

  // --- Fuselage: shorter, fatter, more aggressive than the player.
  const body = box(5.4, 1.2, 1.7, M.enemyBody, 0.0, 0, 0);
  inner.add(body);

  // Sharp pointed nose (longer, meaner spike).
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.4, 10), M.enemyBody);
  nose.rotation.z = -Math.PI / 2;     // tip toward +X (becomes -X after flip)
  nose.position.set(4.0, 0, 0);
  inner.add(nose);

  // Dark spike tip.
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.0, 8), M.enemyAccent);
  tip.rotation.z = -Math.PI / 2;
  tip.position.set(5.4, 0, 0);
  inner.add(tip);

  // --- Yellow cockpit (low, angular).
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), M.enemyCockpit);
  canopy.scale.set(1.7, 0.7, 0.85);
  canopy.position.set(1.6, 0.65, 0);
  inner.add(canopy);

  // --- Big aggressive delta wings (sharply swept). Wingspan ~6.5.
  const wing = buildSweptWing(M.enemyBodyDark, 3.25, 0.18, 1.35);
  wing.position.set(-0.4, -0.1, 0);
  inner.add(wing);

  // Dark wingtip missiles/canards for a hostile look.
  const tipR = box(1.6, 0.25, 0.3, M.enemyAccent, -0.2, -0.05, 3.1);
  const tipL = box(1.6, 0.25, 0.3, M.enemyAccent, -0.2, -0.05, -3.1);
  inner.add(tipR, tipL);

  // --- Twin canted vertical tail fins (mean MiG silhouette).
  for (const sign of [1, -1]) {
    const finShape = new THREE.Shape();
    finShape.moveTo(0, 0);
    finShape.lineTo(1.9, 0);
    finShape.lineTo(0.7, 1.7);
    finShape.lineTo(-0.2, 1.7);
    finShape.lineTo(0, 0);
    const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.14, bevelEnabled: false });
    finGeo.translate(0, 0, -0.07);
    const fin = new THREE.Mesh(finGeo, M.enemyAccent);
    fin.scale.x = -1;                 // sweep toward tail
    fin.position.set(-2.8, 0.35, sign * 0.7);
    fin.rotation.x = sign * 0.32;     // cant outward
    inner.add(fin);
  }

  // --- Engine glow at the rear (-X of inner -> +X after flip... actually rear).
  const burner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.3, 1.2, 12), M.enemyEngine);
  burner.rotation.z = Math.PI / 2;
  burner.position.set(-3.4, 0, 0);
  inner.add(burner);

  // Glowing engine plume (shared additive halo material, recolourable).
  const exhaust = new THREE.Sprite(ENGINE_GLOW.enemy);
  exhaust.scale.set(4.6, 4.6, 1);
  exhaust.position.set(-4.2, 0, 0);
  inner.add(exhaust);

  // Flip so the nose faces -X.
  inner.rotation.y = Math.PI;
  g.add(inner);

  g.userData = { hitRadius: 3.0 };
  return g;
}

// -----------------------------------------------------------------------------
// Swept-wing helper — a single thin swept delta plate spanning ±span in Z,
// built as an extruded trapezoid lying flat in the XZ plane.
//   material : surface material
//   span     : half-wingspan (Z extent each side)
//   thick    : plate thickness (Y)
//   sweep    : how far the tip trails behind the root (X); default 1.1
// Returns a Group centered at its own origin (root at X≈+, tip at X≈-).
// -----------------------------------------------------------------------------
function buildSweptWing(material, span, thick, sweep = 1.1) {
  const grp = new THREE.Group();
  // Define one wing as a 2D shape in the XZ-style plane (we extrude along Y then
  // lay it flat). Easier: build the shape in X (chord) vs Z (span) by treating
  // shape's X as world X and shape's Y as world Z, then extrude along world Y.
  const s = new THREE.Shape();
  // root leading edge forward, trailing edge back; tip swept back by `sweep`.
  s.moveTo(1.0, 0);            // root leading edge (forward)
  s.lineTo(-1.8, 0);           // root trailing edge (back)
  s.lineTo(-1.8 - sweep, span);// tip trailing
  s.lineTo(-0.2 - sweep, span);// tip leading
  s.lineTo(1.0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  // Shape is in XY plane, extruded along +Z. We want: shape-X -> world X,
  // shape-Y (span) -> world Z, extrude (Z) -> world Y (thickness).
  geo.rotateX(-Math.PI / 2);   // shape-Y becomes world -Z; extrude becomes world Y
  // After rotateX(-90): shape Y(+span) -> world Z(-), extrude -> world Y(+). Good enough.
  const right = new THREE.Mesh(geo, material);
  const left = new THREE.Mesh(geo.clone(), material);
  left.scale.z = -1;           // mirror across Z for the other wing
  // Center thickness vertically.
  right.position.y = -thick / 2;
  left.position.y = -thick / 2;
  grp.add(right, left);
  return grp;
}

// =============================================================================
// BUILDING — block/skyscraper on the ground. base y=0, top y=height.
// Footprint width(X) x depth(Z). Emissive window grid on all 4 vertical faces.
// userData = { halfW, halfD, height } for AABB collision.
// =============================================================================
export function createBuilding(opts = {}) {
  const width = opts.width ?? 12;
  const depth = opts.depth ?? 12;
  const height = opts.height ?? 24;
  const variant = ((opts.variant | 0) % 4 + 4) % 4;
  const bodyMat = BUILDING_BODY[variant];

  const g = new THREE.Group();

  // --- Main tower body (centered so base at y=0).
  const tower = box(width, height, depth, bodyMat, 0, height / 2, 0);
  g.add(tower);

  // --- Roof slab (darker, slightly inset, sits on top).
  const roofH = 0.8;
  const roof = box(width * 0.98, roofH, depth * 0.98, M.buildingTop,
                   0, height + roofH / 2, 0);
  g.add(roof);

  // --- Rooftop detail: pick one based on variant for variety.
  addRoofDetail(g, variant, width, depth, height);

  // --- Window grid on all four vertical faces.
  // Window cell ~1.6u with ~1.0u gap => pitch ~2.6u. Cap rows/cols for budget.
  buildWindows(g, width, depth, height);

  g.userData = { halfW: width / 2, halfD: depth / 2, height };
  return g;
}

/** Rooftop antenna / tank / AC box. */
function addRoofDetail(g, variant, width, depth, height) {
  const topY = height + 0.8;
  if (variant === 0) {
    // Tall antenna mast + tip light.
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, height * 0.28, 8), M.roofDetail);
    mast.position.set(0, topY + height * 0.14, 0);
    g.add(mast);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), M.windowLit2);
    light.position.set(0, topY + height * 0.28, 0);
    g.add(light);
  } else if (variant === 1) {
    // Water tank (cylinder) on short legs.
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(Math.min(width, depth) * 0.22,
                                 Math.min(width, depth) * 0.22, 2.4, 12), M.roofDetail);
    tank.position.set(0, topY + 1.6, 0);
    g.add(tank);
  } else if (variant === 2) {
    // Two AC boxes.
    const a = box(width * 0.28, 1.4, depth * 0.28, M.roofDetail,
                  -width * 0.18, topY + 0.7, depth * 0.16);
    const b = box(width * 0.22, 1.0, depth * 0.22, M.roofDetail,
                  width * 0.2, topY + 0.5, -depth * 0.18);
    g.add(a, b);
  } else {
    // Stepped penthouse cap.
    const pent = box(width * 0.55, 2.6, depth * 0.55, M.roofDetail,
                     0, topY + 1.3, 0);
    g.add(pent);
  }
}

/**
 * Build emissive window quads on the four vertical faces of a building.
 * Deterministic-ish lit/unlit pattern (uses a per-building hashed seed so the
 * "city lights" look is varied but not flickering between frames — each call
 * gets a fixed pattern derived from its dimensions).
 */
function buildWindows(g, width, depth, height) {
  const winSize = 1.6;     // window quad size
  const gap = 1.0;         // gap between windows
  const pitch = winSize + gap;
  const margin = 1.4;      // keep windows off the very edges
  const topMargin = 2.0;   // leave roof clear

  // Deterministic seed from dimensions so the same building shape lights the
  // same way (cheap LCG; avoids module-init Math.random and frame flicker).
  let seed = (((width * 73856093) | 0) ^ ((depth * 19349663) | 0) ^ ((height * 83492791) | 0)) >>> 0;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const eps = 0.06;        // push slightly off the face to avoid z-fighting
  const hw = width / 2, hd = depth / 2;

  // Collect every window's transform + color first, then build one InstancedMesh.
  const inst = [];   // { x, y, z, ry, color }

  // faceW: usable horizontal span; mapPos(u,v)->{x,y,z}; ry: face rotation.
  function layFace(faceW, mapPos, ry) {
    const cols = Math.max(0, Math.floor((faceW - margin * 2) / pitch));
    const rows = Math.max(0, Math.floor((height - topMargin - margin) / pitch));
    const maxCols = Math.min(cols, 10);
    const maxRows = Math.min(rows, 14);
    if (maxCols <= 0 || maxRows <= 0) return;
    const usedW = (maxCols - 1) * pitch;
    const startU = -usedW / 2;
    const startV = margin + winSize / 2;
    for (let c = 0; c < maxCols; c++) {
      for (let r = 0; r < maxRows; r++) {
        const u = startU + c * pitch;
        const v = startV + r * pitch;
        const roll = rand();
        const color = roll < 0.42 ? PALETTE.windowLit
                    : roll < 0.62 ? PALETTE.windowLit2
                    : PALETTE.windowDark;
        const p = mapPos(u, v);
        inst.push({ x: p.x, y: p.y, z: p.z, ry, color });
      }
    }
  }

  layFace(width, (u, v) => ({ x: u, y: v, z: hd + eps }), 0);                 // +Z (right)
  layFace(width, (u, v) => ({ x: u, y: v, z: -hd - eps }), Math.PI);          // -Z (left)
  layFace(depth, (u, v) => ({ x: hw + eps, y: v, z: u }), Math.PI / 2);       // +X (forward)
  layFace(depth, (u, v) => ({ x: -hw - eps, y: v, z: u }), -Math.PI / 2);     // -X (back)

  if (inst.length === 0) return;

  const mesh = new THREE.InstancedMesh(WINDOW_GEO, WINDOW_MAT, inst.length);
  for (let i = 0; i < inst.length; i++) {
    const w = inst[i];
    _winDummy.position.set(w.x, w.y, w.z);
    _winDummy.rotation.set(0, w.ry, 0);
    _winDummy.scale.set(1, 1, 1);
    _winDummy.updateMatrix();
    mesh.setMatrixAt(i, _winDummy.matrix);
    mesh.setColorAt(i, _winColor.setHex(w.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();   // so frustum culling works as the group streams
  g.add(mesh);
}

// =============================================================================
// HILL — low rounded green dome on the ground (base y=0).
// userData = { radius, height }.
// =============================================================================
export function createHill(opts = {}) {
  const radius = opts.radius ?? 14;
  const height = opts.height ?? 7;

  const g = new THREE.Group();

  // Flattened upper hemisphere. Sphere of `radius`, scaled in Y so the dome
  // rises to `height`, with the lower half clipped by sitting it so its
  // equator is at y=0 (we only see the top half).
  const geo = new THREE.SphereGeometry(radius, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(geo, M.hill);
  dome.scale.y = height / radius;   // flatten/scale to desired height
  dome.position.y = 0;
  g.add(dome);

  // A darker skirt ring at the base for contrast/grounding.
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.99, radius * 1.05, height * 0.18, 18),
    M.hillDark);
  skirt.position.y = height * 0.09;
  g.add(skirt);

  g.userData = { radius, height };
  return g;
}

// =============================================================================
// TREE — a simple low-poly tree (tapered trunk + stacked conical foliage).
// opts = { height }. Base at y=0. userData = { radius, height }.
// =============================================================================
export function createTree(opts = {}) {
  const height = opts.height ?? 12;
  const g = new THREE.Group();

  const trunkH = height * 0.4;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(height * 0.06, height * 0.1, trunkH, 7), M.treeTrunk);
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  // Two/three stacked cones of foliage.
  const tiers = 3;
  for (let i = 0; i < tiers; i++) {
    const r = height * (0.30 - i * 0.07);
    const h = height * 0.30;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8),
      i % 2 === 0 ? M.treeLeaf : M.treeLeaf2);
    cone.position.y = trunkH + i * (h * 0.55) + h * 0.2;
    g.add(cone);
  }

  g.userData = { radius: height * 0.3, height };
  return g;
}

// =============================================================================
// SHADOW — flat dark disc on the XZ plane. Game places at (x, 0.05, z) and
// scales by altitude. renderOrder = -1, depthWrite off, semi-transparent.
// =============================================================================
export function createShadow() {
  const geo = new THREE.CircleGeometry(4, 24);   // base radius ~4
  // Clone the material per shadow: the game animates each shadow's opacity by
  // altitude, so instances must NOT share one material.
  const m = new THREE.Mesh(geo, M.shadow.clone());
  m.rotation.x = -Math.PI / 2;   // lay flat on the ground (normal -> +Y)
  m.renderOrder = -1;
  m.userData = { baseRadius: 4 };
  return m;
}

// =============================================================================
// PLAYER BULLET — bright glowing tracer elongated along X (forward).
// userData = { hitRadius: 1.4 }.
// =============================================================================
export function createPlayerBullet() {
  // Saber bolt: white-hot core + red blade + soft red glow.
  const g = makeBolt(PALETTE.playerBulletCore, PALETTE.playerBullet, PALETTE.playerBullet, 4.4);
  g.userData = { hitRadius: 1.4 };
  return g;
}

// =============================================================================
// ENEMY BULLET — bright green laser bolt, elongated along travel (X axis;
// the game orients/moves it). Strong emissive. userData = { hitRadius: 1.6 }.
// =============================================================================
export function createEnemyBullet() {
  // Saber bolt: white-green core + green blade + soft green glow.
  const g = makeBolt(PALETTE.enemyBulletCore, PALETTE.enemyBullet, PALETTE.enemyBullet, 4.4);
  g.userData = { hitRadius: 1.6 };
  return g;
}

// =============================================================================
// BOMB — chunky ordnance with fins and a flashing emissive tip.
// Used for the smart-bomb deploy visual. userData = { hitRadius: 2 }.
// The tip mesh is exposed via userData.tip so the game may pulse its
// emissiveIntensity if desired (it's a shared material, so clone it per-bomb).
// =============================================================================
export function createBomb() {
  const g = new THREE.Group();

  // Body: capsule-like (cylinder + rounded nose) oriented along -Y (falls down),
  // but we keep it neutral/upright; the game can orient it. Default long axis Y.
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.0, 2.6, 12), M.bombBody);
  g.add(body);

  // Rounded nose (bottom).
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), M.bombBody);
  nose.scale.y = 0.8;
  nose.position.y = -1.3;
  g.add(nose);

  // Tail fins (4) around the top. Each fin sits on a pivot rotated around Y so
  // the four fins splay out evenly.
  for (let i = 0; i < 4; i++) {
    const finPivot = new THREE.Group();
    finPivot.rotation.y = (i / 4) * Math.PI * 2;
    const fin = box(0.12, 1.1, 1.0, M.bombFin, 0, 1.2, 0.6);
    finPivot.add(fin);
    g.add(finPivot);
  }

  // Flashing tip light (per-bomb material clone so pulsing one doesn't affect all).
  const tipMat = M.bombTip.clone();
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), tipMat);
  tip.position.y = 1.5;
  g.add(tip);

  g.userData = { hitRadius: 2, tip, tipMaterial: tipMat };
  return g;
}

// =============================================================================
// Live recolor (used by the debug gallery). Updates the shared PALETTE entry so
// newly-built meshes pick it up, AND mutates the cached material(s) for that key
// so already-built meshes recolor instantly.
// =============================================================================
const COLOR_MAT_MAP = {
  jetBody: [M.jetBody], jetBodyDark: [M.jetBodyDark], jetAccent: [M.jetAccent],
  jetCockpit: [M.jetCockpit], jetEngine: [M.jetEngine, ENGINE_GLOW.player], jetIntake: [M.jetIntake],
  enemyBody: [M.enemyBody], enemyBodyDark: [M.enemyBodyDark],
  enemyAccent: [M.enemyAccent], enemyCockpit: [M.enemyCockpit],
  enemyEngine: [M.enemyEngine, ENGINE_GLOW.enemy],
  buildingTop: [M.buildingTop, M.roofDetail],
  hill: [M.hill], hillDark: [M.hillDark],
  treeTrunk: [M.treeTrunk], treeLeaf: [M.treeLeaf], treeLeaf2: [M.treeLeaf2],
  buildingA: [BUILDING_BODY[0]], buildingB: [BUILDING_BODY[1]],
  buildingC: [BUILDING_BODY[2]], buildingD: [BUILDING_BODY[3]],
};

/**
 * Recolor a palette element by key. Returns true if a cached material updated.
 * @param {string} key  a PALETTE key
 * @param {number} hex  0xRRGGBB
 */
export function setMatColor(key, hex) {
  if (key in PALETTE) PALETTE[key] = hex;
  const mats = COLOR_MAT_MAP[key];
  if (!mats) return false;
  for (const m of mats) {
    if (m.color) m.color.setHex(hex);
    // keep any glow in sync with the surface color
    if (m.emissive && m.emissive.getHex() !== 0x000000) m.emissive.setHex(hex);
  }
  return true;
}
