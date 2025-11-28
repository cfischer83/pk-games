// Boss logic
function spawnBoss() {
    game.boss = {
        x: game.camera.x + window.innerWidth - 200,
        y: 100,  // Y is now screen-top-based, same as player
        vx: 0,
        vy: 0,
        width: 240,
        height: 220,
        hp: GAME_CONFIG.hp.boss,
        maxHp: GAME_CONFIG.hp.boss,
        state: 'fly',
        frame: 0,
        frameTime: 0,
        lightningCooldown: 0,
        swoopCooldown: Math.random() * 5 + 5,  // 5-10 seconds until first swoop
        hurtTime: 0,
        invulnerable: 0,  // Invulnerability timer to prevent multi-hit
        dead: false,
        facing: 'left',  // Dragon2 sprite naturally faces left
        pattern: 'hover',  // 'hover', 'swooping', 'retreating'
        swoopTargetY: 100,  // Target Y position for swoop
        hoverY: 200  // Home hover position
    };
    
    const el = document.createElement('div');
    el.id = 'dragon2';
    el.className = 'sprite';
    el.style.width = game.boss.width + 'px';
    el.style.height = game.boss.height + 'px';
    el.setAttribute('data-state', 'fly');
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-attack', 'none');
    
    document.getElementById('world').appendChild(el);
    document.getElementById('boss-health').style.display = 'block';
}

function updateBoss(dt) {
    if (!game.boss || game.boss.dead) return;
    
    const b = game.boss;
    b.frameTime += dt;
    
    // Decrement invulnerability timer
    if (b.invulnerable > 0) {
        b.invulnerable -= dt;
    }
    
    if (b.hurtTime > 0) {
        b.hurtTime -= dt;
        b.state = 'hurt';
    } else {
        b.state = 'fly';
    }
    
    // Face the player with hysteresis (only when hovering, not during swoop/retreat)
    if (b.pattern === 'hover') {
        const centerX = b.x + b.width / 2;
        const quarterWidth = b.width / 4;
        
        if (b.facing === 'left') {
            // Currently facing left, switch to right when player goes past 75% point
            if (game.player.x > centerX + quarterWidth) {
                b.facing = 'right';
            }
        } else {
            // Currently facing right, switch to left when player goes before 25% point
            if (game.player.x < centerX - quarterWidth) {
                b.facing = 'left';
            }
        }
    }
    
    // Swoop attack pattern
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    const maxSwoopY = groundHeight + groundY - b.height - 20;  // Just above ground level
    
    b.swoopCooldown -= dt;
    
    if (b.pattern === 'hover') {
        // Hovering movement (figure-8 pattern)
        b.y = b.hoverY + Math.sin(game.time * 2) * 30;
        b.x += Math.cos(game.time * 1.5) * 20 * dt;
        
        // Check if it's time to swoop
        if (b.swoopCooldown <= 0) {
            b.pattern = 'swooping';
            // Random swoop depth: 30% chance to go to ground level, otherwise mid-height
            const goToGround = true; // Math.random() < 0.5;
            b.swoopTargetY = goToGround ? maxSwoopY : (b.hoverY + maxSwoopY) / 2;
            
            // 70% chance to swoop towards player horizontally, otherwise go straight down
            b.swoopTowardsPlayer = Math.random() < 0.7;
            if (b.swoopTowardsPlayer) {
                b.swoopTargetX = game.player.x;
                // Face the direction we're swooping
                if (b.x < game.player.x) {
                    b.facing = 'right';
                } else {
                    b.facing = 'left';
                }
            }
        }
    } else if (b.pattern === 'swooping') {
        // Swoop down AND towards player
        const swoopSpeed = 200;  // pixels per second
        const horizontalSpeed = 250;  // horizontal swoop speed - needs to be fast to reach player before hitting target Y
        
        // Move down towards target Y
        if (b.y < b.swoopTargetY) {
            b.y += swoopSpeed * dt;
            if (b.y >= b.swoopTargetY) {
                b.y = b.swoopTargetY;
                // When swoop complete, start retreating
                b.pattern = 'retreating';
                
                // Determine retreat direction - go to farthest edge of screen
                const screenLeft = game.camera.x;
                const screenRight = game.camera.x + window.innerWidth;
                const distToLeft = b.x - screenLeft;
                const distToRight = screenRight - b.x;
                
                // Go to the farthest side (away from player)
                if (distToLeft > distToRight) {
                    b.retreatTargetX = screenLeft + 100;  // Left edge
                    b.facing = 'left';  // Face direction of retreat
                } else {
                    b.retreatTargetX = screenRight - 100;  // Right edge
                    b.facing = 'right';  // Face direction of retreat
                }
            }
        }
        
        // Move horizontally towards player during swoop (continuously track player position)
        if (b.swoopTowardsPlayer) {
            const playerCenterX = game.player.x + game.player.width / 2;
            const bossCenterX = b.x + b.width / 2;
            const distanceToPlayer = Math.abs(bossCenterX - playerCenterX);
            
            // Only move horizontally if not already aligned with player
            if (distanceToPlayer > 20) {  // 20px dead zone to avoid jittering
                if (bossCenterX < playerCenterX) {
                    b.x += horizontalSpeed * dt;
                    b.facing = 'right';  // Face direction of swoop
                } else {
                    b.x -= horizontalSpeed * dt;
                    b.facing = 'left';  // Face direction of swoop
                }
            }
        } else if (!b.swoopTowardsPlayer) {
            // Straight down - just continue figure-8 drift
            b.x += Math.cos(game.time * 1.5) * 20 * dt;
        }
    } else if (b.pattern === 'retreating') {
        // Retreat UP and AWAY (to farthest screen edge)
        const retreatSpeed = 150;  // vertical retreat speed
        const horizontalRetreatSpeed = 120;  // horizontal retreat speed
        
        // Move vertically back to hover Y
        if (b.y > b.hoverY) {
            b.y -= retreatSpeed * dt;
            if (b.y <= b.hoverY) {
                b.y = b.hoverY;
            }
        }
        
        // Move horizontally to farthest edge
        const reachedX = Math.abs(b.x - b.retreatTargetX) < 50;
        const reachedY = b.y <= b.hoverY;
        
        if (!reachedX) {
            if (b.x < b.retreatTargetX) {
                b.x += horizontalRetreatSpeed * dt;
                b.facing = 'right';  // Face direction of retreat
            } else {
                b.x -= horizontalRetreatSpeed * dt;
                b.facing = 'left';  // Face direction of retreat
            }
        }
        
        // When both X and Y reached, switch back to hover
        if (reachedX && reachedY) {
            b.pattern = 'hover';
            // Set next swoop cooldown (5-10 seconds)
            b.swoopCooldown = Math.random() * 5 + 5;
            // Will resume facing player in hover mode
        }
    }
    
    // Lightning attack
    b.lightningCooldown -= dt;
    if (b.lightningCooldown <= 0) {
        shootLightning();
        b.lightningCooldown = ANCHORS_JSON.dragon2.lightning.cooldownMs / 1000;
    }
    
    // Animation
    if (b.frameTime > GAME_CONFIG.animation.frameDuration) {
        b.frameTime = 0;
        b.frame = (b.frame + 1) % 12;
    }
    
    // Check death
    if (b.hp <= 0 && !b.dead) {
        b.dead = true;
        b.state = 'dead';
        gameWin();
    }
    
    // Update element
    const el = document.getElementById('dragon2');
    if (el) {
        applySpriteFrame(el, 'dragon2', b.state, b.frame, b.facing);
        el.style.left = (b.x - game.camera.x) + 'px';
        el.style.top = b.y + 'px';  // Now using top-based positioning like player
        el.setAttribute('data-state', b.state);
        el.setAttribute('data-frame', b.frame);
        
        // Debug: check transform
        if (game.debug && game.time % 1 < 0.1) {
            console.log('Dragon2 facing:', b.facing, 'Transform:', el.style.transform);
        }
    }
    
    // Update health bar
    const healthPct = Math.max(0, b.hp / b.maxHp * 100);
    document.getElementById('boss-health-fill').style.width = healthPct + '%';
}

function shootLightning() {
    const b = game.boss;
    
    // Lightning bolt dimensions
    const boltWidth = 130;
    const boltHeight = 9;
    
    // Calculate mouth position in world coordinates
    // Lightning comes from bottom corner of mouth, 40px up from bottom
    let mouthX, mouthY;
    
    if (b.facing === 'left') {
        // Facing left - right edge of bolt should align with left edge of dragon
        mouthX = b.x - boltWidth;  
        mouthY = b.y + b.height - 40;
    } else {
        // Facing right - right edge of bolt (source) should align with right edge of dragon
        // We position the div to the left of the mouth, so its right edge is at the mouth
        mouthX = b.x + b.width - boltWidth;  
        mouthY = b.y + b.height - 40;
    }

    // Randomize attack type: 80% angled, 20% straight down
    const isAngled = Math.random() < 0.8;
    
    // Total speed magnitude (constant so all bolts appear same speed)
    const totalSpeed = 700;
    
    let vx, vy;
    
    if (isAngled) {
        // Random angle between 15° and 75° below horizontal
        const angle = (15 + Math.random() * 60) * Math.PI / 180;
        vx = Math.cos(angle) * totalSpeed;
        vy = Math.sin(angle) * totalSpeed;
        // Apply direction based on facing
        if (b.facing === 'left') {
            vx = -vx;
        }
    } else { // Straight Down
        vx = 0;
        vy = totalSpeed;
    }
    
    const bolt = {
        x: mouthX,
        y: mouthY,
        vx: vx,
        vy: vy,
        width: boltWidth,
        height: boltHeight,
        frame: 0,
        frameTime: 0,
        facing: b.facing,  // Track which direction the lightning is facing
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'lightning-bolt projectile sprite';
    el.setAttribute('data-type', 'lightning');
    el.setAttribute('data-active', 'true');
    
    // Apply sprite frame with facing direction
    applySpriteFrame(el, 'lightning', 'bolt', 0, b.facing);
    
    // Calculate rotation based on velocity
    const angle = Math.atan2(vy, vx) * 180 / Math.PI;
    
    // Sprite is naturally Left-facing (180 degrees) with Source on the Right
    // We position the div so the Right edge is always at the Mouth
    // We pivot around the Right Center (Mouth)
    // We rotate by (angle - 180) to align the Left-facing sprite to the target angle
    const rotation = angle - 180;
    const scale = 'scaleX(1)'; 
    const transformOrigin = 'right center'; 
    
    el.style.transformOrigin = transformOrigin;
    el.style.transform = `${scale} rotate(${rotation}deg)`;
    
    bolt.rotation = rotation;
    bolt.scale = scale;
    bolt.transformOrigin = transformOrigin;
    
    bolt.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(bolt);
}
