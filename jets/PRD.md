# JETS — Product Requirements & Design Doc

> A 2.5D isometric arcade flight shooter for **Planet Kodiak Games**, in the
> spirit of **Zaxxon** and **Captain Skyhawk** — vibrant, fast, and original.
> Built with **three.js** (r160), runs in any modern browser, desktop + mobile.

---

## 1. Concept

You pilot an F‑16‑style jet over a neon city. The world scrolls diagonally up‑and‑to‑the‑right (classic Zaxxon angle) while the camera stays anchored to you. Dodge buildings and hills, weave through enemy laser fire, and blast the oncoming red jets. Survive **90 seconds** to clear Sector 1.

Original high‑resolution low‑poly graphics, bright saturated colors, an orthographic 3/4 isometric view, and a synthesized chiptune soundtrack.

---

## 2. Status — ✅ Implemented (Level 1)

All v1 requirements are built and playable.

| Requirement | Status |
|---|---|
| Zaxxon/Captain‑Skyhawk isometric view, world scrolls under the player | ✅ Orthographic fixed‑angle camera; world streams along +X |
| F‑16 player jet, banks on strafe, pitches on climb | ✅ |
| Ground shadow shows altitude | ✅ Per‑jet shadow, scales/fades with height |
| Can't crash into the ground; can hit buildings/hills/jets/projectiles | ✅ Altitude floor + AABB/cylinder collisions |
| Projectiles can't pass through solid objects | ✅ Player & enemy bolts (and bombs) burst on buildings/trees/hills; pass over if high enough |
| 3‑hit life meter, i‑frames, explosions | ✅ |
| Per‑level high score | ✅ Saved in `localStorage` (`jets.hiscore.<levelId>`); shown on menu + game‑over |
| Enemy jets that shoot bright lasers | ✅ Green saber bolts fired mostly forward; enemies climb over buildings |
| City with roads, windowed buildings, hills | ✅ Streaming neon grid; cross‑streets recede endlessly into the fog |
| ~90‑second level | ✅ Difficulty ramps; a glowing checkered **finish line** on the ground marks the end |
| WASD + arrow keys, plane tilts | ✅ |
| Space = fire, hold for continuous, never runs out | ✅ |
| 3 smart bombs (Enter) that clear a large area | ✅ Lobbed projectile → lands → area wipe + shockwave + flash |
| P pauses | ✅ |
| Gamepad support | ✅ Standard mapping (stick/d‑pad, A/RT fire, B/X bomb, Start pause) |
| Sound effects + music, music toggle in menu | ✅ Web Audio synth; Music + SFX toggles (persisted) |
| Mobile touch controls | ✅ Virtual joystick + FIRE/BOMB/pause, landscape prompt |
| Built for more levels later | ✅ Data‑driven `levels.js` |

---

## 3. Controls

| Action | Keyboard | Gamepad | Touch |
|---|---|---|---|
| Fly / change altitude | Arrows or WASD | Left stick / D‑pad | Left joystick |
| Fire (hold for auto) | Space | A or RT | FIRE button |
| Smart bomb (×3) | Enter | B or X | BOMB button |
| Pause | P | Start | ❚❚ button |
| Confirm menus | Enter / Space | A / Start | tap |

- **Left/Right** strafes horizontally (jet banks into the turn).
- **Up/Down** changes altitude (jet pitches). **Vertical is inverted, flight‑stick style: press _down_ to climb and _up_ to dive.** Your high‑contrast **shadow** on the ground shows how low you are — tall buildings can only be cleared by flying high.
- Forward motion is automatic and speeds up slightly through the run.
- **Fire** is a steady, readable cadence (not a machine‑gun); **smart bombs** lob forward from the jet, arc down, and detonate where they land, clearing a wide area.

---

## 4. Visual / art direction

- **Palette** (`config.js → PALETTE`): deep indigo sky, a brighter night ground (so the high‑contrast shadow reads), bright blue roads with yellow dashes and glowing edges, steel/teal/purple buildings with emissive cyan & amber windows, white/red F‑16, crimson enemy jets, white→orange→red explosions. Bright and high‑contrast — a colorful modern take on Zaxxon.
- **Projectiles** are light‑saber bolts: an opaque white‑hot core, an additive hard‑edged colored blade (red player / green enemy), and a soft additive glow halo. The jet exhausts glow with the same additive‑sprite technique (fake bloom — no post‑processing, mobile‑friendly).
- **Projection**: `OrthographicCamera` at a fixed iso angle (offset behind/above/right of the player). The camera **never rotates** during play — it only translates — so the world scrolls true‑Zaxxon style. World **+X (forward)** reads as up‑and‑right, **+Y** as up, **+Z (strafe)** as right‑and‑down.
- **Lighting**: hemisphere + directional key + warm fill + ambient; emissive materials for glow. Fog hides spawn/recycle pop‑in.
- **Coordinate convention** (shared across all modules): `+X` forward, `+Y` up (ground at y=0), `+Z` strafe‑right.

---

## 5. Architecture

Pure ES modules, no build step. `index.html` uses an import map (`three → ./vendor/three.module.js`). Serve over http (modules can't load from `file://`).

```
jets/
  index.html            shell: menu / HUD / overlays / touch controls + import map
  style.css             core UI, HUD, overlays (retro Press Start 2P)
  mobile.css            on‑screen touch controls + rotate prompt
  vendor/three.module.js  three.js r160 (vendored for offline/PWA reliability)
  src/
    config.js   single source of truth: PALETTE, SCALE, CAMERA, GAME tuning, AUDIO, storage keys
    levels.js   data‑driven level table (LEVELS[] + getLevel) — add entries for new sectors
    audio.js    AudioEngine — Web Audio synthesis: chiptune loop + all SFX (no audio files)
    meshes.js   procedural three.js builders (jets, buildings w/ instanced windows, hills, bullets, shadow, bomb)
    input.js    InputManager — merges keyboard + gamepad + touch into one normalized snapshot
    effects.js  pooled explosions, shockwaves, muzzle flashes
    world.js    streaming city: ground/roads/dashes + recycled building/hill pools (collision data)
    hud.js      DOM HUD (lives, bombs, time, score, progress, messages, flashes)
    game.js     engine: scene/camera/lights, fixed‑timestep loop, player/enemies/bombs/collisions, win/lose, attract mode
    main.js     bootstrap: single rAF loop, audio lifecycle, menus, state machine, touch wiring
```

**Key design points**

- **Single loop, single input poll.** `main.js` owns the only `requestAnimationFrame` loop and is the only caller of `input.update()` (once/frame). It dispatches by app state and calls `game.frame(now, inputState)`.
- **Fixed‑timestep simulation** (60 Hz accumulator, clamped, spiral‑guarded) for deterministic feel; rendering each frame.
- **Streaming world**: the player advances forever along +X; ground/roads follow continuously, periodic decor snaps to a pitch, and buildings/hills are pre‑built once into pools and recycled (spawn ahead, despawn behind) — no per‑frame allocation.
- **Pooling everywhere**: bullets, enemies, particles, and obstacles are pre‑allocated and reused. Building windows and road dashes are single `InstancedMesh`es (one draw call each) for mobile performance.
- **Attract mode**: the menu renders the live game as a scrolling backdrop (auto‑piloted jet, no fire/collisions/SFX).

---

## 6. Audio

Everything is **synthesized at runtime** with the Web Audio API (no audio assets):
- Looping ~8‑bar driving chiptune (A‑minor, 132 BPM): square sub‑bass, detuned pulse lead, noise percussion, lookahead scheduler for seamless looping.
- SFX: player/enemy lasers, small/big explosions, bomb boom, player hit, low‑health warning, UI blips, win/lose jingles.
- Browser autoplay policy respected: the `AudioContext` is created/resumed on the first user gesture (START). **Music** and **SFX** toggles live in the menu and pause screen and persist via `localStorage`.

---

## 7. Adding more levels (future)

Append a descriptor to `LEVELS` in `src/levels.js`:

```js
{
  id: 2, name: 'CANYON RUN', duration: 100,
  forwardSpeed: (t) => 70 + 12 * t,
  enemyInterval: (t) => Math.max(0.5, 2.2 - 1.6 * t),
  obstacleDensity: (t) => 0.35 + 0.4 * t,
  maxEnemies: 11, hills: true,
}
```

The engine already accepts a level index (`game.start(levelIndex)`). Per‑level theming (palette swaps, new obstacle types, bosses) can hang off the same descriptor.

---

## 8. Debug / Asset Gallery (`src/gallery.js`)

A no‑gameplay art‑review mode. On the **main menu press `Ctrl+D`** to open the debug dialog, then **Asset Gallery**.

- Every asset laid out with labels: the player jet, enemy jets, building variants A–D, hill, **trees**, bomb, road + intersection sample, and static player/enemy bolts.
- The **player jet is controllable but does not advance** — move it within a box (WASD/arrows, inverted vertical like gameplay) to inspect banking, pitch, and the shadow; hold **Space** to fire.
- A side panel of **actions**: fire player/enemy bolts, muzzle flash, and play each explosion (small / big / bomb blast).
- A **live colour editor**: pick colours for jet, enemy, building, terrain, projectile, and environment elements — `meshes.setMatColor()` mutates the shared cached materials so already‑placed meshes recolour instantly (and `PALETTE` updates so future meshes match).
- Reuses the game's single `WebGLRenderer`/canvas — the gallery has its own scene/camera/effects and renders while the game is paused; exiting returns to the menu attract backdrop.

> Trees (`createTree()`) now also scatter through the streamed city — they fill otherwise‑empty lots **between** the roads (never on a road or building) and act as low obstacles you fly over.

---

## 9. Running / installing

- Local: from the repo root run `python3 -m http.server` and open `/jets/`. (ES modules require http, not `file://`.)
- The game is a standalone folder; to feature it on the Planet Kodiak homepage, add a card linking to `jets/` in the root `index.html` (left to the site owner — this build only touches the `jets/` directory).

---

## 10. Quality notes / verification

- Built with a parallel module workflow (audio/meshes/input) against fixed interface contracts, then an integrator, then an adversarial multi‑pass code review.
- Verified: module import graph resolves, no syntax imbalances, all DOM ids present, camera projection derived correct (forward→up‑right), no per‑frame allocations in the hot path, draw calls bounded via instancing.
- Tunables live in `config.js` (`CAMERA`, `GAME`) — camera zoom/framing, speeds, fire rate, enemy pacing, and collision sizes are all adjustable in one place.

### Possible future polish
- Per‑level palettes / a second and third sector; a boss.
- Pickups (extra bomb, shield), score multipliers, combo meter.
- Haptics on gamepad hit; richer engine‑sound layer.
- Optionally instance enemy/bullet pools further for very low‑end devices.
