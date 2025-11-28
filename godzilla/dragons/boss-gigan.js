// Gigan Boss Logic
function spawnBoss() {
    const spriteInfo = ANCHORS_JSON.gigan || { baseFrameSize: { w: 130, h: 140 } };
    const width = spriteInfo.baseFrameSize.w;
    const height = spriteInfo.baseFrameSize.h;
    
    // Calculate ground position
    const groundY = window.innerHeight * 0.9;
    const y = groundY - height;

    game.boss = {
        x: game.camera.x + window.innerWidth - 200,
        y: y,
        vx: 0,
        vy: 0,
        width: width,
        height: height,
        hp: GAME_CONFIG.hp.boss,
        maxHp: GAME_CONFIG.hp.boss,
        state: 'walk',
        frame: 0,
        frameTime: 0,
        hurtTime: 0,
        hurtFrames: 0,  // For 3-frame hurt animation
        invulnerable: 0,
        dead: false,
        facing: 'left',
        pattern: 'approach',  // 'approach', 'intimidate', 'attack', 'backoff'
        
        // Attack timing (4-8 seconds randomly)
        attackCooldown: 4 + Math.random() * 4,
        attackTimer: 0,
        attackDamageApplied: false,
        lungeDirection: 0,  // Store lunge direction when intimidation starts
        
        // Eye beam timing (3-6 seconds randomly)
        eyeBeamCooldown: 3 + Math.random() * 3,
        
        // Back-off
        backoffTimer: 0,
        
        grounded: true
    };
    
    const el = document.createElement('div');
    el.id = 'gigan';
    el.className = 'sprite';
    el.style.width = game.boss.width + 'px';
    el.style.height = game.boss.height + 'px';
    el.setAttribute('data-state', 'walk');
    el.setAttribute('data-frame', '0');
    
    document.getElementById('world').appendChild(el);
    document.getElementById('boss-health').style.display = 'block';
}

// Calculate overlap percentage between boss and player
function getOverlapPercent(b) {
    const bossLeft = b.x;
    const bossRight = b.x + b.width;
    const playerLeft = game.player.x;
    const playerRight = game.player.x + game.player.width;
    
    const overlapLeft = Math.max(bossLeft, playerLeft);
    const overlapRight = Math.min(bossRight, playerRight);
    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
    
    return overlapWidth / game.player.width;
}

function updateBoss(dt) {
    if (!game.boss) return;
    
    const b = game.boss;
    
    if (!b.dead && !b.dying) {
        b.frameTime += dt;
        
        // Decrement invulnerability timer
        if (b.invulnerable > 0) {
            b.invulnerable -= dt;
        }
        
        // Hurt state handling (3 frames)
        if (b.hurtFrames > 0) {
            if (b.frameTime > GAME_CONFIG.animation.frameDuration) {
                b.frameTime = 0;
                b.frame++;
                b.hurtFrames--;
                
                if (b.hurtFrames <= 0) {
                    // Return to previous pattern
                    b.state = b.pattern === 'attack' ? 'attack' : 'walk';
                    b.frame = 0;
                }
            }
        }
        
        // Gravity and Ground Collision
        const groundY = window.innerHeight * 0.9;
        
        if (!b.grounded) {
            b.vy += 2000 * dt; // Gravity
            b.y += b.vy * dt;
        }
        
        if (b.y + b.height >= groundY) {
            b.y = groundY - b.height;
            b.vy = 0;
            b.grounded = true;
        } else {
            b.grounded = false;
        }
        
        // Face the player (except during attack lunge)
        if (b.pattern !== 'attack' && b.pattern !== 'backoff') {
            const centerX = b.x + b.width / 2;
            const playerCenterX = game.player.x + game.player.width / 2;
            if (playerCenterX > centerX + 20) {
                b.facing = 'right';
            } else if (playerCenterX < centerX - 20) {
                b.facing = 'left';
            }
        }
        
        const moveSpeed = GAME_CONFIG.speed.base - 20; // -20 as player (130)
        const playerCenterX = game.player.x + game.player.width / 2;
        const bossCenterX = b.x + b.width / 2;
        const dist = Math.abs(bossCenterX - playerCenterX);
        const twoPlayerWidths = game.player.width * 2;
        
        // Calculate overlap for back-off logic
        const overlapPct = getOverlapPercent(b);
        
        // Back-off check (not during attack or intimidation)
        if (b.pattern === 'approach' && overlapPct > 0.01) {
            if (overlapPct > 0.20) {
                // More than 20% overlap - quick slide/hop backwards
                b.pattern = 'backoff';
                b.state = 'walk';  // Could use a slide state if available
                b.backoffTimer = 0.3;  // Short backoff duration
                // Determine backoff direction (away from player)
                b.vx = bossCenterX < playerCenterX ? -300 : 300;
            } else if (overlapPct > 0.01 && overlapPct <= 0.12) {
                // 1-12% overlap - just stand still
                b.state = 'stand';
            }
        }
        
        // Movement & Attack Logic
        if (b.pattern === 'approach') {
            if (b.hurtFrames <= 0 && overlapPct <= 0.01) {
                b.state = 'walk';
            }
            
            // Move towards player but stop before overlapping
            const minDist = (b.width + game.player.width) / 2;  // Edge to edge
            if (dist > minDist && overlapPct <= 0.01) {
                if (bossCenterX < playerCenterX) {
                    b.x += moveSpeed * dt;
                } else {
                    b.x -= moveSpeed * dt;
                }
            }
            
            // Attack cooldown
            b.attackCooldown -= dt;
            if (b.attackCooldown <= 0) {
                // Add randomness - 50% chance to attack if cooldown ready, otherwise short delay
                if (Math.random() < 0.5 && dist < twoPlayerWidths) {
                    // Close enough and random check passed - start intimidation
                    b.pattern = 'intimidate';
                    b.state = 'intimidate';
                    b.frame = 0;
                    b.frameTime = 0;
                    b.attackTimer = 1.0; // 1 second intimidation
                    // Lock in lunge direction now
                    b.lungeDirection = playerCenterX > bossCenterX ? 1 : -1;
                } else if (dist >= twoPlayerWidths) {
                    // Not close enough, short delay before checking again
                    b.attackCooldown = 0.5 + Math.random() * 1.0;
                } else {
                    // Close enough but random check failed, try again soon
                    b.attackCooldown = 0.3 + Math.random() * 0.5;
                }
            }
            
            // Eye beam cooldown
            b.eyeBeamCooldown -= dt;
            if (b.eyeBeamCooldown <= 0) {
                shootEyeBeam(b);
                b.eyeBeamCooldown = 3 + Math.random() * 3; // 3-6 seconds
            }
            
        } else if (b.pattern === 'backoff') {
            // Quick slide/hop backwards
            b.x += b.vx * dt;
            b.vx *= 0.9;  // Decelerate
            
            b.backoffTimer -= dt;
            if (b.backoffTimer <= 0 || Math.abs(b.vx) < 20) {
                b.pattern = 'approach';
                b.state = 'walk';
                b.vx = 0;
            }
            
        } else if (b.pattern === 'intimidate') {
            b.attackTimer -= dt;
            if (b.attackTimer <= 0) {
                // Start attack with guaranteed lunge (direction locked in earlier)
                b.pattern = 'attack';
                b.state = 'attack';
                b.frame = 0;
                b.frameTime = 0;
                b.attackTimer = 2.0; // 2 second attack
                b.attackDamageApplied = false;
                
                // Lunge towards player (direction was locked when intimidation started)
                b.vx = b.lungeDirection * 800; // Fast lunge like Anguirus
            }
            
        } else if (b.pattern === 'attack') {
            // Apply lunge movement
            if (Math.abs(b.vx) > 0) {
                b.x += b.vx * dt;
                // Decelerate
                b.vx *= 0.95;
                if (Math.abs(b.vx) < 10) {
                    b.vx = 0;
                }
            }
            
            b.attackTimer -= dt;
            
            // Check attack collision - Gigan's attack takes priority
            const bossBox = { x: b.x, y: b.y, width: b.width, height: b.height };
            const playerBox = { x: game.player.x, y: game.player.y, width: game.player.width, height: game.player.height };
            
            if (aabbIntersects(bossBox, playerBox)) {
                // During attack, deal 5hp per second regardless of player state
                if (game.player.invulnerable <= 0) {
                    game.player.hp -= GAME_CONFIG.damage.giganAttack * dt;
                    game.player.hurtTime = 0.2;
                }
            }
            
            if (b.attackTimer <= 0) {
                // End attack, return to approach
                b.pattern = 'approach';
                b.state = 'walk';
                b.frame = 0;
                b.attackCooldown = 4 + Math.random() * 4; // 4-8 seconds
                b.vx = 0;
            }
        }
        
        // Keep boss on screen
        const screenLeft = game.camera.x + 50;
        const screenRight = game.camera.x + window.innerWidth - b.width - 50;
        if (b.x < screenLeft) b.x = screenLeft;
        if (b.x > screenRight) b.x = screenRight;
        
        // Animation (if not in hurt state)
        if (b.hurtFrames <= 0 && b.frameTime > GAME_CONFIG.animation.frameDuration) {
            b.frameTime = 0;
            const frameCount = getFrameCount('gigan', b.state);
            b.frame = (b.frame + 1) % frameCount;
        }
        
        // Check death
        if (b.hp <= 0 && !b.dead) {
            b.dead = true;
            b.state = 'dead';
            gameWin();
        }
    } else if (b.dying) {
        // Handle dying animation
        b.y += 10 * dt;
        
        b.explosionTimer -= dt;
        if (b.explosionTimer <= 0) {
            const randomX = b.x + Math.random() * b.width;
            const randomY = b.y + Math.random() * b.height;
            spawnExplosion(randomX, randomY);
            b.explosionTimer = 0.1 + Math.random() * 0.2;
        }
    }
    
    // Update element
    const el = document.getElementById('gigan');
    if (el) {
        applySpriteFrame(el, 'gigan', b.state, b.frame, b.facing);
        el.style.left = (b.x - game.camera.x) + 'px';
        el.style.top = b.y + 'px';
        el.setAttribute('data-state', b.state);
        el.setAttribute('data-frame', b.frame);
    }
    
    // Update health bar
    const healthPct = Math.max(0, b.hp / b.maxHp * 100);
    document.getElementById('boss-health-fill').style.width = healthPct + '%';
}

// Shoot eye beam (uses sprite from gigan.png)
function shootEyeBeam(boss) {
    const beamInfo = ANCHORS_JSON.gigan.eyeBeam;
    const beamWidth = beamInfo.w;
    const beamHeight = beamInfo.h;
    
    // Spawn from eye level (14px from top of sprite)
    let beamX;
    if (boss.facing === 'left') {
        beamX = boss.x - beamWidth;
    } else {
        beamX = boss.x + boss.width;
    }
    
    const beamY = boss.y + 14;
    
    const beam = {
        x: beamX,
        y: beamY,
        vx: boss.facing === 'left' ? -400 : 400,
        vy: 0,
        width: beamWidth,
        height: beamHeight,
        type: 'eyebeam',
        source: 'gigan',
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'eyebeam projectile sprite';
    el.setAttribute('data-type', 'eyebeam');
    el.setAttribute('data-active', 'true');
    el.style.position = 'absolute';
    el.style.width = beamWidth + 'px';
    el.style.height = beamHeight + 'px';
    
    // Use the eye beam sprite from gigan.png
    const giganSheet = ANCHORS_JSON.gigan.spriteSheet;
    el.style.backgroundImage = `url('${giganSheet.src}')`;
    el.style.backgroundPosition = `-${beamInfo.offset.x}px -${beamInfo.offset.y}px`;
    el.style.backgroundSize = `${giganSheet.w}px ${giganSheet.h}px`;
    el.style.imageRendering = 'pixelated';
    
    // Flip if facing right
    if (boss.facing === 'right') {
        el.style.transform = 'scaleX(-1)';
    }
    
    beam.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(beam);
}

// Called when Gigan takes damage (from engine-collisions.js)
function onGiganHurt() {
    const b = game.boss;
    if (!b || b.dead || b.pattern === 'attack') return;
    
    // Start hurt animation (3 frames)
    b.state = 'hurt';
    b.frame = 0;
    b.frameTime = 0;
    b.hurtFrames = 3;
}
