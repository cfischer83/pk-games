# Godzilla Refactor Plan

This document describes how to clean up and modularize the current codebase **without changing behavior**, and how to evolve it into a small reusable engine plus configurable levels.

The current implementation for "Level 1" lives almost entirely in `index.html` and uses data from `dragon-sprites.js`.

## Goals

- Keep the game behaving exactly as it does now.
- Split responsibilities into clear modules (engine vs gameplay vs level config).
- Support **multiple levels** via a `LEVELS` config object.
- Separate **player**, **bosses**, **enemies**, **obstacles**, **projectiles/effects**, and **UI/shell** logic.
- Introduce a light-weight entity/engine structure that can be reused by future levels.

---

## Target File / Module Layout

Proposed new JS files (all globals, loaded via `<script>` tags in `index.html`):

- `engine-core.js`
  - Game loop, global `game` state skeleton, camera update, input wiring.
- `engine-physics.js`
  - Physics helpers: gravity/jump calculations, AABB & swept AABB.
- `engine-sprites.js` (may live inside `dragon-sprites.js`)
  - Generic sprite/animation helpers wrapping `ANCHORS_JSON`.
- `engine-entities.js` (optional / later phase)
  - Light-weight entity system: shared update/render and removal logic.
- `engine-collisions.js`
  - Collision detection and resolution across players/enemies/obstacles/boss/projectiles.
- `engine-debug.js`
  - Debug flag, toggling, on-screen debug info, debug logging helper.

- `player-dragon.js`
  - Main player (dragon1) state, update, rendering, fire beam and tail spin.
- `boss-dragon2.js`
  - Flying lightning boss logic and rendering.
  - Later, a `boss-dragon.js` base if needed for more bosses.

- `enemies.js`
  - Birds, tanks, and future enemy types.
- `obstacles.js`
  - Rocks and future static/breakable obstacles.
- `projectiles.js`
  - Bullets and lightning projectiles.
- `effects.js`
  - Explosions and life pickups.

- `level-configs.js`
  - `LEVELS` object; current Level 1 is `LEVELS.level1`.
- `level-runtime.js`
  - Instantiates a level from config and owns spawn/boss-gate/win-loss logic for that level.

- `game-shell.js`
  - Menus, HUD updates, starting/restarting a level, win/lose screens, analytics.

`index.html` becomes a thin HTML+CSS file that includes all scripts in a sensible order and calls a single bootstrap function (e.g., `initGame()` / `startLevel('level1')`).

---

## Phase 1: Extract Physics & Collision Helpers

**Source:** `index.html`

1. Create `engine-physics.js` and move:

   - `GAME_CONFIG.physics` **shape** into a documented config interface (will be provided by `LEVELS.level1.physicsConfig` later).
   - `function calculatePhysics()` and `const physics = calculatePhysics();`
   - `function aabbIntersects(a, b)`
   - `function sweptAABB(box, vel, obstacle, dt)`

2. In `index.html`, keep using these as globals:

   - `physics` remains a global object (gravity, jumpVel, targetApex).
   - Calls to `aabbIntersects` and `sweptAABB` continue to work unchanged.

3. Mark for later refactor (but **do not change yet**):

   - The gravity/jump/coyote/jump-buffer logic inside `updatePlayer(dt)` should later call helpers like:
     - `applyVerticalPhysics(player, dt, physics)`
     - `handleJump(player, game.keys, dt, GAME_CONFIG.physics, physics)`

Behavior remains identical; this step is purely a move.

---

## Phase 2: Extract Sprite / Animation Helpers

**Source:** `dragon-sprites.js` + scattered animation code in `index.html`.

1. In `dragon-sprites.js`:

   - Keep `ANCHORS_JSON` as-is.
   - Treat these as **engine sprite helpers** (can be re-exported from `engine-sprites.js` if you prefer):
     - `getFrameInfo(actor, state, frameIndex)`
     - `getFrameCount(actor, state)`
     - `applySpriteFrame(element, actor, state, frameIndex, facing)`

2. Create `engine-sprites.js` (or just clearly mark a section in `dragon-sprites.js`) with a planned helper:

   - `advanceFrame(entity, actorKey, stateKey, dt, frameDuration)` (planned for later):
     - Uses `entity.frameTime`, `entity.frame`, and `getFrameCount(actorKey, stateKey)` to step animation.

3. Identify current animation stepping code to later replace with `advanceFrame` (no behavior change yet):

   - In `updatePlayer(dt)`: the `p.frameTime` / `p.frame` update block.
   - In `updateEnemies(dt)`: bird `frameTime` and `frame` handling.
   - In `updateProjectiles(dt)`: bullet and lightning `frameTime` and `frame` handling.
   - In `updateExplosions(dt)`: explosion `frameTime`, `frame`, and `frameCount` usage.
   - In `updateLifePickups(dt)`: life `frameTime` and `frame` handling.

Document in comments (`TODO: use advanceFrame()`) where these replacements will eventually happen.

---

## Phase 3: Structure Global Game State in Engine Core

**Source:** `let game = { ... }` in `index.html`.

1. Create `engine-core.js` and define the base `game` object shape there:

   - Top-level flags: `running`, `won`, `lost`.
   - Time stepping: `time`, `lastTime`, `accumulator`, `fixedDeltaMs`.
   - Collections: `player`, `boss`, `enemies`, `projectiles`, `obstacles`, `explosions`, `lifePickups`.
   - `camera` (x, y).
   - `spawn` (timers, obstacleTimer, gateReached, enemiesFinished, obstaclesFinished, lastEnemyClearedX).
   - `keys` (left, right, up, down, z, x, space, spacePressed).
   - `debug`.

2. For now, keep initialization values the same as in `index.html`.

3. Add a placeholder for multi-level support:

   - `game.currentLevel = null;` (will point to a level runtime object in Phase 7).

4. Remove the `let game = { ... }` definition from `index.html` once the new file is loaded before other scripts.

Behavior remains the same: everything still refers to the global `game` object.

---

## Phase 4: Move Input Handling to Engine Core

**Source:** Two `document.addEventListener` blocks in `index.html`.

1. Move these blocks to `engine-core.js`:

   - `document.addEventListener('keydown', ...)`
   - `document.addEventListener('keyup', ...)`

2. Keep all behavior identical:

   - `spacePressed` edge detection logic.
   - `'c'` mapping to `down`.
   - `'d'` toggling `game.debug` and calling `toggleDebug()`.

3. Later, change `'d'` handling to call `engine-debug.toggleDebug(game)` rather than a function defined in `index.html`.

---

## Phase 5: Extract Player Module (`player-dragon.js`)

**Source:** `updatePlayer(dt)` and related player-specific code in `index.html`.

1. Create `player-dragon.js` and move:

   - `function updatePlayer(dt)` (unchanged logic for now).
   - `function createFireBeam()`
   - `function removeFireBeam()`
   - `function updateFireBeamFrame(beam)`
   - `function applyFireDamage()`

2. Add a constructor-style helper:

   - `function createPlayer(initialConfig)` that returns a player object structured exactly like the current `game.player`. For now, `startGame()` can still directly mutate `game.player` using this function.

3. Mark for later extraction the player-specific render logic inside `render()`:

   - Single vs split upper/lower body logic for punching.
   - Duck/kick offsets using `getFrameInfo`.
   - Positioning of `#dragon1` and `#dragon1-upper`.

   This will become a `renderPlayer(game)` function inside `player-dragon.js` later.

---

## Phase 6: Extract Enemies & Obstacles

**Source:** `spawnEnemy`, `updateEnemies`, `spawnObstacle`, `updateObstacles`, `shootBullet` in `index.html`.

1. Create `enemies.js`:

   - Move `function spawnEnemy(type)`.
   - Move `function updateEnemies(dt)`.
   - Move `function shootBullet(tank)` (or re-export from `projectiles.js` later).

   Keep all logic intact:

   - Bird vs tank differentiation.
   - Bird spawn Y based on physics target apex.
   - Tank shooting cooldown.
   - DOM element setup and sprite usage via `applySpriteFrame`.

2. Create `obstacles.js`:

   - Move `function spawnObstacle()`.
   - Move `function updateObstacles(dt)`.

   Keep behavior:

   - `maxObstacles` enforcement.
   - Spacing checks vs other obstacles and enemies.
   - Breaking rocks + `.broken` class.

3. After moving, the main loop (`gameLoop`) still calls `updateEnemies(dt)` and `updateObstacles(dt)` as globals.

4. Note in comments that eventually:

   - Enemies will be pure entities with `update`/`render` methods.
   - Obstacles will sit in their own `game.obstacles` array managed by `engine-entities`.

---

## Phase 7: Extract Projectiles & Effects

**Source:** `updateProjectiles`, `spawnExplosion`, `updateExplosions`, `spawnLifePickup`, `updateLifePickups`.

1. Create `projectiles.js`:

   - Move `function updateProjectiles(dt)`.
   - Optionally move `shootBullet(tank)` from `enemies.js` to here.
   - Keep bullet and lightning frame logic and positioning exactly as-is.

2. Create `effects.js`:

   - Move `function spawnExplosion(x, y)`.
   - Move `function updateExplosions(dt)`.
   - Move `function spawnLifePickup(x, y)`.
   - Move `function updateLifePickups(dt)`.

3. Ensure that other modules call these as globals:

   - `spawnExplosion` is used in collisions and boss logic.
   - `spawnLifePickup` is used when rocks are destroyed.

---

## Phase 8: Extract Boss Module (`boss-dragon2.js`)

**Source:** `spawnBoss`, `updateBoss`, `shootLightning`.

1. Create `boss-dragon2.js` and move:

   - `function spawnBoss()`
   - `function updateBoss(dt)`
   - `function shootLightning()`

2. Wrap `spawnBoss()` as a level-agnostic constructor for boss entities:

   - `function createDragon2Boss(config)` that:
     - Initializes a boss object with hp, state, movement pattern, facing, cooldowns.
     - Creates and injects the `#dragon2` element.

3. Keep all current behavior the same:

   - Hover / swoop / retreat state machine.
   - Lightning cooldown and velocity.
   - Boss hp bar updates.
   - Debug logging.

4. Note for later:

   - Boss hp bar updates should be moved out to HUD (game shell) so boss logic doesnt manipulate UI directly.

---

## Phase 9: Extract Collision Module

**Source:** `checkCollisions()` in `index.html`.

1. Create `engine-collisions.js` and move `function checkCollisions()` there.

2. Keep all logic intact, including:

   - Ducking hitbox adjustments using `getFrameInfo`.
   - Punch hitbox and `attackHits` tracking.
   - Tail spin and duck-spin behavior vs enemies/obstacles.
   - Fire beam vs enemies/obstacles/boss using `_worldX`/`_worldY` and `GAME_CONFIG.damage.fire`.
   - Projectile vs player damage.
   - Boss vs player contact damage and invulnerability handling.
   - Player death check calling `gameLose()`.

3. Document clearly in comments where logic mixes **enemies and rocks** and where that will eventually split:

   - Enemy loop contains `enemy.type === 'rock'` checks.
   - Fire beam damage applies to both `game.enemies` and `game.obstacles`.

4. Planned future split (no behavior change yet):

   - `resolvePlayerEnemyCollision(player, enemy, context)`.
   - `resolvePlayerObstacleCollision(player, obstacle, context)`.
   - `resolvePlayerBossCollision(player, boss, context)`.
   - `resolveProjectileHit(proj, target, context)`.

---

## Phase 10: Camera & Rendering

**Source:** `updateCamera()`, `render()` in `index.html`.

1. Move `function updateCamera()` into `engine-core.js` or a dedicated `engine-camera.js`.

   - No behavior changes; still uses `game.player` and `GAME_CONFIG.camera.lookAheadPx`.

2. Move `function render()` into `engine-core.js` for now.

3. Inside `render()`, mark logical sub-parts for later extraction:

   - `renderBackground(game)`: parallax and ground transforms.
   - `renderPlayer(game)`: dragon1/dragon1-upper logic and positioning.
   - `renderBoss(game)`: dragon2 sprite and top-based positioning.
   - `renderFireBeam(game)`: follow player, animate fire beam frames.
   - `renderHUD(game)`: player hp bar, fire cooldown, boss hp bar.

4. In a later pass, move each of these into:

   - `player-dragon.js` for `renderPlayer` and `renderFireBeam`.
   - `boss-dragon2.js` for `renderBoss`.
   - `game-shell.js` or a small `hud.js` for `renderHUD`.

---

## Phase 11: Spawner & Boss Gate to Level Runtime

**Source:** `updateSpawner(dt)` and boss gate logic inside `gameLoop`.

1. Create `level-configs.js` and move the **data** from `GAME_CONFIG` into `LEVELS.level1`:

   - `level` (e.g., `gateX`, `groundBandPct`).
   - `speed`.
   - `physics`.
   - `animation`.
   - `fire`.
   - `tail`.
   - `hp`.
   - `damage`.
   - `spawn` (including `schedule`, `obstacleSchedule`, `maxEnemies`, `maxObstacles`).
   - `camera`.
   - `TESTING_BOSS`.

2. Create `level-runtime.js` with:

   - `function createLevel(levelId)` that:
     - Looks up `const config = LEVELS[levelId];`.
     - Sets up `GAME_CONFIG` or separate config objects using `config`.
     - Initializes `game.player`, `game.boss = null`, `game.spawn`, etc.
     - Returns a `level` object with:
       - `update(dt, game)`
       - `hasWon()` / `hasLost()` or `getStatus()`

   - Move `function updateSpawner(dt)` into `level.update(dt, game)`.

3. Move boss spawn logic from `gameLoop` into the level runtime:

   - The block that checks `!game.boss && !game.spawn.gateReached`, testing mode, `enemiesFinished`, `allEnemiesGone`, buffer distance, and then calls `spawnBoss()`.

4. Mark in `LEVELS.level1`:

   - `winCondition: 'killBoss'`.
   - `lossCondition: 'playerDead'`.

   The level runtime will later use these to call into the shell when win/loss happens.

---

## Phase 12: Game Shell (Menu, HUD, Win/Lose)

**Source:** `startGame`, `gameWin`, `gameLose`, `showGameOverMenu`, HUD updates, `pkAnalytics`.

1. Create `game-shell.js` and move:

   - `function startGame()`.
   - `function gameWin()`.
   - `function gameLose()`.
   - `function showGameOverMenu(won)`.

2. Adapt `startGame()` into level-based startup:

   - `function startLevel(levelId)`:
     - Reset `game` generic state (time, flags, arrays).
     - Create a new level runtime via `game.currentLevel = createLevel(levelId);`.
     - Call `requestAnimationFrame(gameLoop);`.
     - Call `pkAnalytics('start')` with `levelId`.

3. Move HUD updates from `render()` into a separate helper:

   - `function updateHUD(game)` inside `game-shell.js` (or `hud.js`):
     - Sets `#player-health` width.
     - Sets `#fire-cooldown` width.
     - Sets boss health bar width.

4. In the main loop (`gameLoop` now in `engine-core.js`):

   - After `render()`, call `updateHUD(game)`.

5. Keep analytics behavior the same, but parameterize level:

   - In `pkAnalytics(action)`, use current level ID instead of hard-coded `"1"` when available.

---

## Phase 13: Debug Utilities

**Source:** `toggleDebug`, `updateDebug`, scattered `if (game.debug) console.log(...)`.

1. Create `engine-debug.js` and move:

   - `function toggleDebug()`.
   - `function updateDebug()`.

2. Change them to accept `game` (and `physics`, `config`) as parameters:

   - `function toggleDebug(game)`.
   - `function updateDebug(game, physics, GAME_CONFIG)`.

3. Add a helper:

   - `function debugLog(...args)` that logs only when `game.debug` is truthy.

4. Replace direct `console.log` debug calls in gameplay modules with `debugLog(...)` calls where useful.

5. Ensure `'d'` key handler in `engine-core.js` calls `toggleDebug(game)` instead of a function in `index.html`.

---

## Phase 14: Entity System (Optional Later Step)

After all the above extractions, you can introduce a simple entity system in `engine-entities.js` to unify behavior across players, bosses, enemies, obstacles, projectiles, and effects.

1. Define an informal entity contract:

   - `entity.type` (e.g., 'player', 'boss', 'enemy', 'obstacle', 'projectile', 'effect').
   - `entity.x`, `entity.y`, `entity.vx`, `entity.vy`, `entity.width`, `entity.height`.
   - Optional:
     - `entity.update(dt, game)`.
     - `entity.render(game)`.
     - `entity.isDead()` or `entity.dead` flag.

2. Provide helpers in `engine-entities.js`:

   - `registerEntity(entity)`.
   - `updateEntities(dt, game)`.
   - `renderEntities(game)`.
   - `removeDeadEntities()`.

3. Gradually migrate:

   - Player, boss, enemies, obstacles, projectiles, and effects to follow this pattern.
   - Replace direct `updateX(dt)` loops with a generic entity update pass, plus level-specific logic in `level-runtime`.

This step is entirely optional and can be done after all behavior has been safely modularized.

---

## Phase 15: Multi-Level Support

With `LEVELS` and `createLevel(levelId)` in place, adding more levels becomes mostly data work:

1. In `level-configs.js`, define `LEVELS.level2`, `LEVELS.level3`, etc. with:

   - Different `spawnConfig` entries.
   - Different `bossConfig` (e.g., different boss type or hp).
   - Different `physicsConfig`, `speedConfig`, etc., if you want levels to feel different.
   - Different `winCondition` / `lossCondition` descriptors (e.g., 'reachGate', 'surviveTime', 'allyDies').

2. In `game-shell.js`, add UI or debug controls to start different levels:

   - Example: `startLevel('level2')`.

3. In `level-runtime.js`, interpret `winCondition`/`lossCondition` descriptors to decide when to:

   - Call into `gameWin()` / `gameLose()`.
   - Mark `level.status` to be read by the shell.

---

This plan keeps behavior identical while giving you clear seams for future cleanup. You can follow the phases in order, committing after each phase so you can easily bisect if needed.