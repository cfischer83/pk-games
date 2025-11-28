// Game state
let game = {
    running: false,
    won: false,
    lost: false,
    time: 0,
    lastTime: 0,
    accumulator: 0,
    fixedDeltaMs: 1000 / 60,
    
    player: {
        x: 100,
        y: 0,
        vx: 0,
        vy: 0,
        width: 142,
        height: 128,
        facing: 'right',
        grounded: false,
        hp: GAME_CONFIG.hp.player,
        maxHp: GAME_CONFIG.hp.player,
        
        state: 'stand',
        stateTime: 0,
        frame: 0,
        frameTime: 0,
        
        jumping: false,
        jumpHeld: false,
        coyoteTime: 0,
        jumpBufferTime: 0,
        
        attacking: false,
        attackType: null,
        attackFrame: 0,
        attackTime: 0,
        attackHits: [], // Track enemies hit by current attack
        
        fireState: null,
        fireTime: 0,
        fireCooldown: 0,
        fireTickTime: 0,
        fireDamageCount: 0,
        
        tailActive: false,
        tailTime: 0,
        
        hurtTime: 0,
        invulnerable: 0,
        
        dying: false,
        deathTimer: 0,
        explosionTimer: 0
    },
    
    boss: null,
    enemies: [],
    projectiles: [],
    obstacles: [],
    explosions: [],  // Track active explosions
    lifePickups: [],  // Track active life pickups
    
    camera: {
        x: 0,
        y: 0
    },
    
    spawn: {
        timers: {},
        obstacleTimer: 0,
        gateReached: false,
        enemiesFinished: false,
        obstaclesFinished: false,
        lastEnemyClearedX: 0  // Track where player was when last enemy left screen
    },
    
    keys: {
        left: false,
        right: false,
        up: false,
        down: false,
        z: false,
        x: false,
        space: false,
        spacePressed: false  // Track if space was just pressed (not held)
    },
    
    debug: false
};

// Check for debug mode in querystring
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('debug') === 'true') {
    game.debug = true;
    document.body.classList.add('debug-mode');
}

const physics = calculatePhysics();

// Input handling
document.addEventListener('keydown', (e) => {
    switch(e.key.toLowerCase()) {
        case 'arrowleft': game.keys.left = true; e.preventDefault(); break;
        case 'arrowright': game.keys.right = true; e.preventDefault(); break;
        case 'arrowup': game.keys.up = true; e.preventDefault(); break;
        case 'arrowdown': game.keys.down = true; e.preventDefault(); break;
        case 'c': game.keys.down = true; e.preventDefault(); break; // 'c' also ducks
        case 'z': game.keys.z = true; e.preventDefault(); break;
        case 'x': game.keys.x = true; e.preventDefault(); break;
        case ' ': 
            if (!game.keys.space) {  // Only set spacePressed on initial press
                game.keys.spacePressed = true;
            }
            game.keys.space = true; 
            e.preventDefault(); 
            break;
        case 'd': game.debug = !game.debug; toggleDebug(); break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key.toLowerCase()) {
        case 'arrowleft': game.keys.left = false; break;
        case 'arrowright': game.keys.right = false; break;
        case 'arrowup': game.keys.up = false; break;
        case 'arrowdown': game.keys.down = false; break;
        case 'c': game.keys.down = false; break; // Release duck when 'c' is released
        case 'z': game.keys.z = false; break;
        case 'x': game.keys.x = false; break;
        case ' ': 
            game.keys.space = false; 
            game.keys.spacePressed = false;
            break;
    }
});

// Camera update
function updateCamera() {
    const p = game.player;
    const targetX = Math.max(0, p.x - window.innerWidth/2 + GAME_CONFIG.camera.lookAheadPx);
    
    game.camera.x = targetX;
}

// Render
function render() {
    const p = game.player;
    const cam = game.camera;
    
    // Update parallax
    document.getElementById('far-mountains').style.transform = `translateX(${-cam.x * 0.3}px)`;
    document.getElementById('near-mountains').style.transform = `translateX(${-cam.x * 0.6}px)`;
    document.getElementById('ground').style.transform = `translateX(${-cam.x}px)`;
    
    // Update player sprite with frame offsets
    const dragon1 = document.getElementById('dragon1');
    const dragon1Upper = document.getElementById('dragon1-upper');
    
    // Check if we're punching - if so, render split upper/lower body
    const isPunching = p.attacking && p.attackType === 'punch';
    
    if (isPunching) {
        // Render lower body (walking state or stand)
        const lowerState = Math.abs(p.vx) > 0 ? 'walk' : 'stand';
        applySpriteFrame(dragon1, 'dragon1', lowerState, p.frame, p.facing);
        
        // Clip the top 64px of dragon1 to only show lower body
        dragon1.style.height = '64px';
        dragon1.style.overflow = 'hidden';
        
        // Get the current background position and adjust it to shift the sprite up by 64px
        // This makes the bottom 64px of the sprite visible in the 64px tall div
        const currentBgPos = dragon1.style.backgroundPosition;
        const bgPosMatch = currentBgPos.match(/-?[\d.]+px/g);
        if (bgPosMatch && bgPosMatch.length >= 2) {
            const bgX = bgPosMatch[0];
            const bgY = parseFloat(bgPosMatch[1]);
            dragon1.style.backgroundPosition = `${bgX} ${bgY - 64}px`;
        }
        
        // Render upper body (punch)
        applySpriteFrame(dragon1Upper, 'dragon1', 'punch_upper', p.attackFrame, p.facing);
        
        // Make upper body visible and position it
        dragon1Upper.style.display = 'block';
        dragon1Upper.style.width = '108px';
        dragon1Upper.style.height = '64px';
    } else {
        // Normal single-sprite rendering
        applySpriteFrame(dragon1, 'dragon1', p.state, p.frame, p.facing);
        
        // Reset dragon1 to full size based on current state
        const currentFrameInfo = getFrameInfo('dragon1', p.state, p.frame);
        if (currentFrameInfo) {
            dragon1.style.height = currentFrameInfo.height + 'px';
            dragon1.style.width = currentFrameInfo.width + 'px';
        }
        dragon1.style.overflow = 'visible';
        
        // Hide upper body
        dragon1Upper.style.display = 'none';
    }
    
    // Get duck/kick offset from frame info
    const frameInfo = getFrameInfo('dragon1', p.state, p.frame);
    let leftOffset = 0;
    
    // Apply duck offset when ducking
    if (p.state === 'duck_spin' && frameInfo && frameInfo.duckOffset) {
		if (p.facing == "right") {
			leftOffset = frameInfo.duckOffset;
		} else {
			leftOffset = frameInfo.duckOffsetLeft;
		}
    }
    
    // Apply kick offset when kicking and facing left
    if (p.state === 'kick' && p.facing === 'left' && frameInfo && frameInfo.kickOffset) {
        leftOffset = frameInfo.kickOffset;
    }
    
    // Position the player
    // groundY is at 90% of window height. Ground div is bottom 10%.
    // CSS bottom is measured from viewport bottom, so: bottom = groundHeight + (groundY - p.y - p.height)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    dragon1.style.left = (p.x - cam.x + leftOffset) + 'px';
    dragon1.style.bottom = (groundHeight + groundY - p.y - p.height) + 'px';
    
    // Position upper body if punching (on top of lower body)
    if (isPunching) {
		let upperBodyLeftOffset = -24;
		if (p.facing == "right") {
			upperBodyLeftOffset = 58; // Push upper to the right because tail isn't a part of it.
		}
        dragon1Upper.style.left = (p.x - cam.x + leftOffset) + upperBodyLeftOffset + 'px';
        dragon1Upper.style.bottom = (groundHeight + groundY - p.y - 64) + 'px'; // 64px from bottom of sprite
    }
    
    // Update boss sprite if exists
    if (game.boss) {
        const dragon2 = document.getElementById('dragon2');
        if (dragon2) {
            applySpriteFrame(dragon2, 'dragon2', game.boss.state, game.boss.frame, game.boss.facing);
            dragon2.style.left = (game.boss.x - cam.x) + 'px';
            // Boss uses top-based positioning now
            dragon2.style.top = game.boss.y + 'px';
        }
    }
    
    // Update fire beam position if active - follows player movement
    const fireBeam = document.getElementById('player-fire-beam');
    if (fireBeam) {
        // Recalculate position based on current player position using shared logic
        const beamWidth = 216;
        const beamHeight = 102;
        const groundY = window.innerHeight * 0.9;
        
        const position = calculateFireBeamPosition(
            p,
            beamWidth,
            beamHeight,
            cam.x,
            groundY,
            window.innerHeight
        );
        
        fireBeam.style.left = position.left;
        fireBeam.style.bottom = position.bottom;
        fireBeam.style.transform = position.transform;
        
        // Update world position for collision detection
        // Calculate mouth position for collision
        const mouthY = p.y + 55; // mouthOffsetFromTop
        let mouthX;
        if (p.facing === 'right') {
            mouthX = p.x + p.width + 20; // mouthOffsetFromRight
        } else {
            mouthX = p.x;
        }
        fireBeam._worldX = p.facing === 'right' ? mouthX : mouthX - beamWidth;
        fireBeam._worldY = mouthY - beamHeight/2;
        
        // Animate fire beam frames
        const dt = game.fixedDeltaMs / 1000;
        fireBeam._frameTime += dt;
        if (fireBeam._frameTime >= GAME_CONFIG.animation.frameDuration) {
            fireBeam._frameTime = 0;
            fireBeam._frame = (fireBeam._frame + 1) % fireBeam._totalFrames;
            updateFireBeamFrame(fireBeam);
        }
    }
    
    // Update HUD
    const healthPct = Math.max(0, p.hp / p.maxHp * 100);
    document.getElementById('player-health').style.width = healthPct + '%';
    
    const cooldownPct = Math.max(0, (1 - p.fireCooldown / (GAME_CONFIG.fire.cooldownMs/1000)) * 100);
    document.getElementById('fire-cooldown').style.width = cooldownPct + '%';
}

// Main game loop
function gameLoop(timestamp) {
    // Stop if game is not running
    if (!game.running) {
        return;
    }
    
    const deltaTime = timestamp - game.lastTime;
    game.lastTime = timestamp;
    game.accumulator += deltaTime;
    
    // Fixed timestep
    while (game.accumulator >= game.fixedDeltaMs) {
        const dt = game.fixedDeltaMs / 1000;
        game.time += dt;
        
        updatePlayer(dt);
        updateEnemies(dt);
        updateObstacles(dt);
        updateProjectiles(dt);
        updateExplosions(dt);
        updateLifePickups(dt);
        updateSpawner(dt);
        
        // Xiliens flyover effect (level 4)
        checkXiliensFlyoverTrigger(dt);
        updateXiliensFlyover(dt);
        
        // Rodan ally (level 4)
        checkRodanTrigger(dt);
        updateRodanAlly(dt);
        
        // P-1 Rocket (level 4)
        checkP1RocketTrigger(dt);
        updateP1Rocket(dt);
        
        // Check boss spawn - hybrid approach
        if (!game.boss && !game.spawn.gateReached) {
            // *** TESTING MODE: Spawn boss immediately ***
            if (GAME_CONFIG.TESTING_BOSS) {
                game.spawn.gateReached = true;
                spawnBoss();
                if (game.debug) {
                    console.log('TESTING MODE: Boss spawned immediately');
                }
            }
            // *** NORMAL MODE: Wait for enemies to clear and buffer distance ***
            else if (game.spawn.enemiesFinished) {
                // Check if all enemies are off-screen (left side)
                const allEnemiesGone = game.enemies.length === 0 || 
                    game.enemies.every(e => e.x < game.camera.x - 100);
                
                if (allEnemiesGone) {
                    // Record where player was when last enemy cleared
                    if (game.spawn.lastEnemyClearedX === 0) {
                        game.spawn.lastEnemyClearedX = game.player.x;
                        if (game.debug) {
                            console.log('All enemies cleared at player x:', game.spawn.lastEnemyClearedX);
                        }
                    }
                    
                    // Calculate buffer distance (window width or 1000px, whichever is smaller)
                    const bufferDistance = Math.min(window.innerWidth, 1000);
                    const distanceTraveled = game.player.x - game.spawn.lastEnemyClearedX;
                    
                    // Spawn boss after buffer distance
                    if (distanceTraveled >= bufferDistance) {
                        game.spawn.gateReached = true;
                        if (game.debug) {
                            console.log('Spawning boss after buffer distance:', bufferDistance, 'traveled:', distanceTraveled);
                        }
                        spawnBoss();
                    }
                }
            }
        }
        
        if (game.boss) {
            updateBoss(dt);
        }
        
        checkCollisions();
        
        // Handle death animations
        if (game.player.dying) {
            game.player.deathTimer -= dt;
            game.player.explosionTimer -= dt;
            
            // Sink downward
            game.player.y += 50 * dt;  // Slow downward movement
            
            // Spawn random explosions
            if (game.player.explosionTimer <= 0) {
                const randomX = game.player.x + Math.random() * game.player.width;
                const randomY = game.player.y + Math.random() * game.player.height;
                spawnExplosion(randomX, randomY);
                game.player.explosionTimer = 0.1 + Math.random() * 0.2;  // Every 0.1-0.3 seconds
            }
            
            // Show game over menu after 5 seconds
            if (game.player.deathTimer <= 0) {
                game.player.dying = false;
                showGameOverMenu(false);
            }
        }
        
        if (game.boss && game.boss.dying) {
            game.boss.deathTimer -= dt;
            game.boss.explosionTimer -= dt;
            
            // Sink downward
            game.boss.y += 50 * dt;  // Slow downward movement
            
            // Spawn random explosions
            if (game.boss.explosionTimer <= 0) {
                const randomX = game.boss.x + Math.random() * game.boss.width;
                const randomY = game.boss.y + Math.random() * game.boss.height;
                spawnExplosion(randomX, randomY);
                game.boss.explosionTimer = 0.1 + Math.random() * 0.2;  // Every 0.1-0.3 seconds
            }
            
            // Show game over menu after 5 seconds
            if (game.boss.deathTimer <= 0) {
                game.boss.dying = false;
                showGameOverMenu(true);
            }
        }
        
        updateCamera();
        
        game.accumulator -= game.fixedDeltaMs;
    }
    
    render();
    
    if (game.debug) {
        updateDebug();
    }
    
    requestAnimationFrame(gameLoop);
}
