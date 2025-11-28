// Explosion system
function spawnExplosion(x, y) {
    const explosion = {
        x: x,
        y: y,
        frame: 0,
        frameTime: 0,
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'explosion sprite';
    el.style.position = 'absolute';
    el.style.zIndex = '20'; // Above everything else
    
    // Apply initial frame
    applySpriteFrame(el, 'explosion', 'explode', 0);
    
    explosion.element = el;
    document.getElementById('world').appendChild(el);
    game.explosions.push(explosion);
    
    // Position explosion
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    const frameInfo = getFrameInfo('explosion', 'explode', 0);
    el.style.left = (x - game.camera.x - frameInfo.width / 2) + 'px';
    el.style.bottom = (groundHeight + groundY - y - frameInfo.height / 2) + 'px';
}

function updateExplosions(dt) {
    game.explosions = game.explosions.filter(explosion => {
        explosion.frameTime += dt;
        
        if (explosion.frameTime >= GAME_CONFIG.animation.frameDuration) {
            explosion.frameTime = 0;
            explosion.frame++;
            
            const frameCount = getFrameCount('explosion', 'explode');
            if (explosion.frame >= frameCount) {
                // Animation complete, remove explosion
                explosion.element.remove();
                return false;
            }
            
            // Update to next frame
            applySpriteFrame(explosion.element, 'explosion', 'explode', explosion.frame);
            
            // Update size and position as frame size changes
            const frameInfo = getFrameInfo('explosion', 'explode', explosion.frame);
            const groundY = window.innerHeight * 0.9;
            const groundHeight = window.innerHeight * 0.1;
            explosion.element.style.left = (explosion.x - game.camera.x - frameInfo.width / 2) + 'px';
            explosion.element.style.bottom = (groundHeight + groundY - explosion.y - frameInfo.height / 2) + 'px';
        }
        
        return true;
    });
}

// Life pickup system
function spawnLifePickup(x, y, spawnChance = 0.25) {
    // Default 25% chance to spawn, can be overridden
    if (Math.random() >= spawnChance) {
        return;
    }
    
    // Height of dragon1's head when standing on ground
    // Dragon1 is 128px tall, head is approximately 20px from top
    const groundY = window.innerHeight * 0.9;
    const dragon1Height = 128;
    const headOffsetFromTop = 20;
    const lifeY = groundY - dragon1Height + headOffsetFromTop;
    
    const lifePickup = {
        x: x,
        y: lifeY,
        vx: GAME_CONFIG.speed.base / 2,  // Half of dragon1's walking speed
        width: 16,
        height: 30,
        lifetime: 0,
        maxLifetime: 10,  // Disappear after 10 seconds
        frame: 0,
        frameTime: 0,
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'life-pickup sprite';
    el.style.position = 'absolute';
    el.style.zIndex = '15';
    
    // Apply initial frame
    applySpriteFrame(el, 'life', 'float', 0);
    
    lifePickup.element = el;
    document.getElementById('world').appendChild(el);
    game.lifePickups.push(lifePickup);
    
    // Position pickup
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (lifePickup.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - lifePickup.y - lifePickup.height) + 'px';
}

function updateLifePickups(dt) {
    const p = game.player;
    
    game.lifePickups = game.lifePickups.filter(pickup => {
        // Update lifetime
        pickup.lifetime += dt;
        if (pickup.lifetime >= pickup.maxLifetime) {
            pickup.element.remove();
            return false;
        }
        
        // Move right at half walking speed
        pickup.x += pickup.vx * dt;
        
        // Animate frames
        pickup.frameTime += dt;
        if (pickup.frameTime >= GAME_CONFIG.animation.frameDuration) {
            pickup.frameTime = 0;
            const frameCount = getFrameCount('life', 'float');
            pickup.frame = (pickup.frame + 1) % frameCount;
            applySpriteFrame(pickup.element, 'life', 'float', pickup.frame);
        }
        
        // Check collision with player
        const playerBox = {
            x: p.x,
            y: p.y,
            width: p.width,
            height: p.height
        };
        const pickupBox = {
            x: pickup.x,
            y: pickup.y,
            width: pickup.width,
            height: pickup.height
        };
        
        if (aabbIntersects(playerBox, pickupBox)) {
            // Add 2 HP to player
            p.hp = Math.min(p.hp + 2, GAME_CONFIG.hp.player);
            pickup.element.remove();
            return false;
        }
        
        // Position pickup
        const groundY = window.innerHeight * 0.9;
        const groundHeight = window.innerHeight * 0.1;
        pickup.element.style.left = (pickup.x - game.camera.x) + 'px';
        pickup.element.style.bottom = (groundHeight + groundY - pickup.y - pickup.height) + 'px';
        
        return true;
    });
}

const KONAMI_SEQUENCE = [
	'ArrowUp',
	'ArrowUp',
	'ArrowDown',
	'ArrowDown',
	'ArrowLeft',
	'ArrowRight',
	'ArrowLeft',
	'ArrowRight',
	'b',
	'a'
];

let konamiIndex = 0;
let konamiEnabled = false;

function activateKonamiMode() {
	if (konamiEnabled) {
		return;
	}
	konamiEnabled = true;
	document.body.classList.add('konami');
	if (typeof ANCHORS_JSON !== 'undefined' && ANCHORS_JSON?.dragon1?.spriteSheet) {
		console.log('Before:', ANCHORS_JSON.dragon1.spriteSheet.src);
		ANCHORS_JSON.dragon1.spriteSheet.src = '../img/godzilla-dark.png';
		console.log('After:', ANCHORS_JSON.dragon1.spriteSheet.src);
	} else {
		console.log('ANCHORS_JSON.dragon1.spriteSheet not found');
	}
}

window.addEventListener('keydown', event => {
	if (konamiEnabled) {
		return;
	}
	const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
	if (key === KONAMI_SEQUENCE[konamiIndex]) {
		konamiIndex += 1;
		if (konamiIndex === KONAMI_SEQUENCE.length) {
			activateKonamiMode();
		}
	} else {
		konamiIndex = key === KONAMI_SEQUENCE[0] ? 1 : 0;
	}
});

// Xiliens + Rodan-Bubble Flyover Effect
// A cinematic flyover where xiliens ship carries rodan in a bubble across the screen
let xiliensFlyover = null;

function spawnXiliensFlyover() {
    if (xiliensFlyover) return; // Already spawned or completed
    
    const xiliensInfo = ANCHORS_JSON.xiliens;
    const rodanInfo = ANCHORS_JSON['rodan-bubble'];
    
    const xiliensWidth = xiliensInfo.baseFrameSize.w;
    const xiliensHeight = xiliensInfo.baseFrameSize.h;
    const rodanWidth = rodanInfo.baseFrameSize.w;
    const rodanHeight = rodanInfo.baseFrameSize.h;
    
    // Container width is the wider of the two (rodan-bubble)
    const containerWidth = rodanWidth;
    const containerHeight = xiliensHeight + rodanHeight;
    
    // Start off-screen to the right
    const startX = window.innerWidth + 50;
    const topY = 100; // 200px from top of screen
    
    xiliensFlyover = {
        x: startX,
        y: topY,
        vx: -80, // Move left at 80px/s
        containerWidth: containerWidth,
        containerHeight: containerHeight,
        xiliensWidth: xiliensWidth,
        xiliensHeight: xiliensHeight,
        rodanWidth: rodanWidth,
        rodanHeight: rodanHeight,
        xiliensFrame: 0,
        rodanFrame: 0,
        frameTime: 0,
        completed: false,
        element: null
    };
    
    // Create container div
    const container = document.createElement('div');
    container.id = 'xiliens-flyover';
    container.style.position = 'absolute';
    container.style.zIndex = '25'; // Above player (10), enemies (8), obstacles
    container.style.width = containerWidth + 'px';
    container.style.height = containerHeight + 'px';
    container.style.pointerEvents = 'none';
    
    // Create xiliens ship element (centered above rodan-bubble)
    const xiliensEl = document.createElement('div');
    xiliensEl.id = 'xiliens-ship';
    xiliensEl.className = 'sprite';
    xiliensEl.style.position = 'absolute';
    xiliensEl.style.left = ((containerWidth - xiliensWidth) / 2) + 'px';
    xiliensEl.style.top = '0px';
    applySpriteFrame(xiliensEl, 'xiliens', 'fly', 0, 'left');
    
    // Create rodan-bubble element (below xiliens)
    const rodanEl = document.createElement('div');
    rodanEl.id = 'rodan-bubble';
    rodanEl.className = 'sprite';
    rodanEl.style.position = 'absolute';
    rodanEl.style.left = ((containerWidth - rodanWidth) / 2) + 'px';
    rodanEl.style.top = xiliensHeight + 'px';
    applySpriteFrame(rodanEl, 'rodan-bubble', 'carry', 0, 'left');
    
    container.appendChild(xiliensEl);
    container.appendChild(rodanEl);
    document.getElementById('world').appendChild(container);
    
    xiliensFlyover.element = container;
}

function updateXiliensFlyover(dt) {
    if (!xiliensFlyover || xiliensFlyover.completed) return;
    
    const flyover = xiliensFlyover;
    
    // Move left
    flyover.x += flyover.vx * dt;
    
    // Animate frames
    flyover.frameTime += dt;
    if (flyover.frameTime >= GAME_CONFIG.animation.frameDuration) {
        flyover.frameTime = 0;
        
        // Update xiliens frame
        const xiliensFrameCount = getFrameCount('xiliens', 'fly');
        flyover.xiliensFrame = (flyover.xiliensFrame + 1) % xiliensFrameCount;
        
        // Update rodan frame
        const rodanFrameCount = getFrameCount('rodan-bubble', 'carry');
        flyover.rodanFrame = (flyover.rodanFrame + 1) % rodanFrameCount;
        
        // Apply sprite frames
        const xiliensEl = document.getElementById('xiliens-ship');
        const rodanEl = document.getElementById('rodan-bubble');
        if (xiliensEl) applySpriteFrame(xiliensEl, 'xiliens', 'fly', flyover.xiliensFrame, 'left');
        if (rodanEl) applySpriteFrame(rodanEl, 'rodan-bubble', 'carry', flyover.rodanFrame, 'left');
    }
    
    // Update position (relative to viewport, not world/camera)
    if (flyover.element) {
        flyover.element.style.left = flyover.x + 'px';
        flyover.element.style.top = flyover.y + 'px';
    }
    
    // Check if completely off-screen to the left
    if (flyover.x + flyover.containerWidth < 0) {
        // Remove element and mark as completed
        if (flyover.element) {
            flyover.element.remove();
        }
        flyover.completed = true;
    }
}

// Timer for triggering the flyover (called from game loop)
let xiliensTimer = 0;

function checkXiliensFlyoverTrigger(dt) {
    // Check if flyover is enabled in this level's config
    if (!GAME_CONFIG.xiliensFlyover || !GAME_CONFIG.xiliensFlyover.enabled) return;
    if (xiliensFlyover) return; // Already triggered
    
    xiliensTimer += dt;
    if (xiliensTimer >= GAME_CONFIG.xiliensFlyover.triggerTime) {
        spawnXiliensFlyover();
    }
}

// =============================================
// RODAN ALLY SYSTEM
// =============================================
// Rodan appears after xiliens flyover completes AND boss HP < 50%
// Glides from top, dives at 45° toward boss, deals -5hp, retreats

let rodanAlly = null;
let rodanFromLeft = true; // Alternates between left-to-right and right-to-left
let rodanWaitTimer = 0;

function spawnRodanAlly() {
    const viewportWidth = window.innerWidth;
    const startX = rodanFromLeft ? -116 : viewportWidth;
    const startY = 100; // 100px from top
    const facing = rodanFromLeft ? 'right' : 'left';
    
    // Create Rodan element
    const rodanEl = document.createElement('div');
    rodanEl.id = 'rodan-ally';
    rodanEl.style.position = 'fixed';
    rodanEl.style.zIndex = '500';
    rodanEl.style.left = startX + 'px';
    rodanEl.style.top = startY + 'px';
    rodanEl.style.pointerEvents = 'none';
    
    // Apply initial sprite frame (glide state)
    applySpriteFrame(rodanEl, 'rodan', 'glide', 0, facing);
    
    document.body.appendChild(rodanEl);
    
    rodanAlly = {
        element: rodanEl,
        x: startX,
        y: startY,
        width: 116,
        height: 96,
        state: 'glide', // glide, dive, retreat
        facing: facing,
        fromLeft: rodanFromLeft,
        speed: 300, // pixels per second
        hasDealtDamage: false,
        frameTime: 0,
        frame: 0,
        targetAcquired: false,
        targetX: 0,
        targetY: 0,
        diveVx: 0,
        diveVy: 0
    };
    
    // Alternate direction for next spawn
    rodanFromLeft = !rodanFromLeft;
}

function updateRodanAlly(dt) {
    if (!rodanAlly) return;
    
    const rodan = rodanAlly;
    const viewportWidth = window.innerWidth;
    
    // Animate frames
    rodan.frameTime += dt;
    if (rodan.frameTime >= GAME_CONFIG.animation.frameDuration) {
        rodan.frameTime = 0;
        const frameCount = getFrameCount('rodan', rodan.state);
        rodan.frame = (rodan.frame + 1) % frameCount;
        applySpriteFrame(rodan.element, 'rodan', rodan.state, rodan.frame, rodan.facing);
    }
    
    // Get boss reference (use game.boss, not window.boss)
    const boss = game.boss;
    
    // State machine
    if (rodan.state === 'glide') {
        // Move horizontally toward boss area
        if (rodan.fromLeft) {
            rodan.x += rodan.speed * dt;
            // Start dive when roughly above the boss (boss x position adjusted for camera)
            if (boss) {
                const bossScreenX = boss.x - game.camera.x;
                if (rodan.x >= bossScreenX - 50) {
                    startRodanDive(rodan, boss);
                }
            } else if (rodan.x >= viewportWidth * 0.6) {
                // No boss, retreat
                rodan.state = 'retreat';
                rodan.frame = 0;
            }
        } else {
            rodan.x -= rodan.speed * dt;
            // Start dive when roughly above the boss
            if (boss) {
                const bossScreenX = boss.x - game.camera.x;
                if (rodan.x <= bossScreenX + boss.width + 50) {
                    startRodanDive(rodan, boss);
                }
            } else if (rodan.x <= viewportWidth * 0.4) {
                // No boss, retreat
                rodan.state = 'retreat';
                rodan.frame = 0;
            }
        }
    } else if (rodan.state === 'dive') {
        // Track boss dynamically if not yet dealt damage
        if (!rodan.hasDealtDamage && boss) {
            // Boss position in screen space - target the CENTER
            const bossScreenX = boss.x - game.camera.x;
            const targetX = bossScreenX + boss.width / 2;
            const targetY = boss.y + boss.height / 2; // Aim for center (same as collision check)
            
            const dx = targetX - (rodan.x + rodan.width / 2);
            const dy = targetY - (rodan.y + rodan.height / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Always update velocity while tracking (removed dist > 10 check)
            const diveSpeed = 400;
            rodan.diveVx = (dx / dist) * diveSpeed;
            rodan.diveVy = (dy / dist) * diveSpeed;
            
            // Update facing based on direction
            rodan.facing = rodan.diveVx >= 0 ? 'right' : 'left';
            
            // Check collision - within 15px of center
            if (dist <= 15) {
                // Deal damage to boss
                boss.hp -= 5;
                rodan.hasDealtDamage = true;
                
                // Spawn explosion at the impact point
                spawnExplosion(boss.x + boss.width / 2, boss.y + boss.height / 2);
                
                // IMMEDIATELY switch to retreat - no more dive state
                rodan.state = 'retreat';
                rodan.frame = 0;
            }
        }
        
        // Apply velocity (only if still in dive state)
        if (rodan.state === 'dive') {
            rodan.x += rodan.diveVx * dt;
            rodan.y += rodan.diveVy * dt;
        }
        
        // If we've gone too far down or off-screen, start retreat
        if (rodan.y > window.innerHeight * 0.85 || rodan.x < -200 || rodan.x > viewportWidth + 200) {
            rodan.state = 'retreat';
            rodan.frame = 0;
        }
    } else if (rodan.state === 'retreat') {
        // Retreat in the same general direction we approached from, but upward
        const retreatSpeed = 350;
        if (rodan.fromLeft) {
            rodan.x += retreatSpeed * dt;
            rodan.y -= retreatSpeed * 0.5 * dt; // Rise as we retreat
            rodan.facing = 'right';
        } else {
            rodan.x -= retreatSpeed * dt;
            rodan.y -= retreatSpeed * 0.5 * dt;
            rodan.facing = 'left';
        }
        
        // Check if off-screen
        if (rodan.x > viewportWidth + 150 || rodan.x < -150 || rodan.y < -100) {
            // Remove and set up for next pass
            rodan.element.remove();
            rodanAlly = null;
            rodanWaitTimer = 0; // Start waiting for next pass
        }
    }
    
    // Update position
    if (rodan.element) {
        rodan.element.style.left = rodan.x + 'px';
        rodan.element.style.top = rodan.y + 'px';
    }
}

function startRodanDive(rodan, boss) {
    rodan.state = 'dive';
    rodan.frame = 0;
    
    // Calculate initial dive vector toward boss CENTER (in screen space)
    const bossScreenX = boss.x - game.camera.x;
    const targetX = bossScreenX + boss.width / 2;
    const targetY = boss.y + boss.height / 2; // Target center, same as collision
    
    const dx = targetX - (rodan.x + rodan.width / 2);
    const dy = targetY - (rodan.y + rodan.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const diveSpeed = 400;
    rodan.diveVx = (dx / dist) * diveSpeed;
    rodan.diveVy = (dy / dist) * diveSpeed;
    
    // Update facing
    rodan.facing = rodan.diveVx >= 0 ? 'right' : 'left';
}

function checkRodanBossCollision(rodan, boss) {
    // Check if Rodan's center is within 15px of boss's center
    // This makes the attack look more committed before retreating
    const rodanCenterX = rodan.x + rodan.width / 2;
    const rodanCenterY = rodan.y + rodan.height / 2;
    
    // Boss uses world coordinates, convert to screen space
    const bossScreenX = boss.x - game.camera.x;
    const bossCenterX = bossScreenX + boss.width / 2;
    const bossCenterY = boss.y + boss.height / 2;
    
    const dx = rodanCenterX - bossCenterX;
    const dy = rodanCenterY - bossCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= 15;
}

function checkRodanTrigger(dt) {
    // Only in level 4 with xiliens flyover
    if (!GAME_CONFIG.xiliensFlyover || !GAME_CONFIG.xiliensFlyover.enabled) return;
    
    // Must wait for xiliens flyover to complete
    if (!xiliensFlyover || !xiliensFlyover.completed) return;
    
    // Don't spawn if Rodan is already active
    if (rodanAlly) return;
    
    // Check if boss exists and HP < 50% (use game.boss, not window.boss)
    const boss = game.boss;
    if (!boss || boss.dead) return;
    
    const bossMaxHp = GAME_CONFIG.damage?.bossMaxHp || 100;
    if (boss.hp >= bossMaxHp * 0.5) return; // Boss HP must be below 50%
    
    // Wait 5 seconds between Rodan passes
    rodanWaitTimer += dt;
    if (rodanWaitTimer >= 5) {
        spawnRodanAlly();
    }
}

function resetRodanAlly() {
    if (rodanAlly && rodanAlly.element) {
        rodanAlly.element.remove();
    }
    rodanAlly = null;
    rodanFromLeft = true;
    rodanWaitTimer = 5; // Ready to spawn immediately once conditions are met
}

// =============================================
// P-1 ROCKET SYSTEM
// =============================================
// Rocket appears at level start, sits on ground, launches upward with acceleration

let p1Rocket = null;
let p1Timer = 0;
let p1RocketSpawned = false; // Only spawn once per page load

function spawnP1Rocket() {
    if (p1Rocket || p1RocketSpawned) return;
    p1RocketSpawned = true;
    
    // Rocket dimensions (scaled 50%)
    const width = 31;  // 62 * 0.5
    const height = 96; // 192 * 0.5
    
    // Position: 200px from right edge of initial viewport, at ground level
    const groundY = window.innerHeight * 0.9 + 29; // 29 for rocket fire
    const startX = game.camera.x + window.innerWidth - 200;
    const startY = groundY - height; // Bottom of rocket at ground level
    
    // Create rocket element
    const rocketEl = document.createElement('div');
    rocketEl.id = 'p1-rocket';
    rocketEl.className = 'sprite';
    rocketEl.style.position = 'absolute';
    rocketEl.style.zIndex = '99'; // Below ground (100+) but above everything else
    rocketEl.style.width = width + 'px';
    rocketEl.style.height = height + 'px';
    rocketEl.style.pointerEvents = 'none';
    
    // Apply initial sprite frame with 50% scale
    applyP1SpriteFrame(rocketEl, 0);
    
    document.getElementById('world').appendChild(rocketEl);
    
    p1Rocket = {
        element: rocketEl,
        x: startX,          // World X position
        y: startY,          // World Y position (top of sprite, from top of screen)
        width: width,
        height: height,
        vy: 0,              // Start stationary
        minVy: -20,         // Starting speed once launched
        maxVy: -100,        // Max speed at top
        startY: startY,     // Remember starting Y for acceleration calc
        frame: 0,
        frameTime: 0,
        launchDelay: GAME_CONFIG.p1Rocket.launchDelay || 2,  // Use config or default 2 seconds
        launched: false
    };
}

function applyP1SpriteFrame(element, frameIndex) {
    const spriteInfo = ANCHORS_JSON['p-1'];
    const frameSize = spriteInfo.baseFrameSize;
    const frame = spriteInfo.states.launch.frames[frameIndex];
    
    element.style.backgroundImage = `url('${spriteInfo.spriteSheet.src}')`;
    // Scale the background size to 50%
    element.style.backgroundSize = `${spriteInfo.spriteSheet.w * 0.5}px ${spriteInfo.spriteSheet.h * 0.5}px`;
    // Scale the background position to 50%
    element.style.backgroundPosition = `-${frame.spriteOffset.x * 0.5}px -${frame.spriteOffset.y * 0.5}px`;
}

function updateP1Rocket(dt) {
    if (!p1Rocket) return;
    
    const rocket = p1Rocket;
    
    // Wait for launch delay before starting
    if (!rocket.launched) {
        rocket.launchDelay -= dt;
        if (rocket.launchDelay <= 0) {
            rocket.launched = true;
            rocket.vy = rocket.minVy; // Start moving
        } else {
            // Still waiting - just update position for camera movement
            const groundY = window.innerHeight * 0.9;
            const groundHeight = window.innerHeight * 0.1;
            rocket.element.style.left = (rocket.x - game.camera.x) + 'px';
            rocket.element.style.bottom = (groundHeight + groundY - rocket.y - rocket.height) + 'px';
            return;
        }
    }
    
    // Animate frames (only after launched)
    rocket.frameTime += dt;
    if (rocket.frameTime >= GAME_CONFIG.animation.frameDuration) {
        rocket.frameTime = 0;
        rocket.frame = (rocket.frame + 1) % 3; // 3 frames
        applyP1SpriteFrame(rocket.element, rocket.frame);
    }
    
    // Calculate acceleration based on how far we've traveled
    // Linearly interpolate speed from minVy to maxVy based on distance traveled
    const distanceTraveled = rocket.startY - rocket.y;
    const totalDistance = rocket.startY + 200; // From ground to 200px above viewport
    const progress = Math.min(distanceTraveled / totalDistance, 1);
    
    // Interpolate velocity (both are negative, so this works correctly)
    rocket.vy = rocket.minVy + (rocket.maxVy - rocket.minVy) * progress;
    
    // Apply velocity
    rocket.y += rocket.vy * dt;
    
    // Update position (world space, adjusted for camera)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    rocket.element.style.left = (rocket.x - game.camera.x) + 'px';
    rocket.element.style.bottom = (groundHeight + groundY - rocket.y - rocket.height) + 'px';
    
    // Check if off-screen above viewport
    if (rocket.y + rocket.height < 0) {
        rocket.element.remove();
        p1Rocket = null;
    }
}

function checkP1RocketTrigger(dt) {
    // Only in level 4 with p1Rocket enabled
    if (!GAME_CONFIG.p1Rocket || !GAME_CONFIG.p1Rocket.enabled) return;
    if (p1Rocket || p1RocketSpawned) return; // Already spawned or completed
    
    // Spawn immediately on level load
    spawnP1Rocket();
}

function resetP1Rocket() {
    if (p1Rocket && p1Rocket.element) {
        p1Rocket.element.remove();
    }
    p1Rocket = null;
    p1Timer = 0;
}
