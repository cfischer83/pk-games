// Anguirus Boss Logic
function spawnBoss() {
    // Use placeholder dimensions if not defined in ANCHORS_JSON
    const spriteInfo = ANCHORS_JSON.anguirus || { baseFrameSize: { w: 200, h: 150 } };
    const width = spriteInfo.baseFrameSize.w;
    const height = spriteInfo.baseFrameSize.h;
    
    // Calculate ground position
    const groundY = window.innerHeight * 0.9;
    const y = groundY - height; // Place on top of ground

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
        attackCooldown: 5, // 5 seconds until first attack
        hurtTime: 0,
        invulnerable: 0,
        dead: false,
        facing: 'left',
        pattern: 'approach', // 'approach', 'attack_windup', 'attack_leap', 'attack_bounce'
        targetX: 0,
        startX: 0,
        grounded: true
    };
    
    const el = document.createElement('div');
    el.id = 'anguirus';
    el.className = 'sprite';
    el.style.width = game.boss.width + 'px';
    el.style.height = game.boss.height + 'px';
    el.setAttribute('data-state', 'walk');
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-attack', 'none');
    
    document.getElementById('world').appendChild(el);
    document.getElementById('boss-health').style.display = 'block';
}

function updateBoss(dt) {
    if (!game.boss) return;
    
    const b = game.boss;
    
    // Only run update logic if not dead/dying
    if (!b.dead && !b.dying) {
        b.frameTime += dt;
        
        // Decrement invulnerability timer
        if (b.invulnerable > 0) {
            b.invulnerable -= dt;
        }
        
        if (b.hurtTime > 0) {
            b.hurtTime -= dt;
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
        
        // Face the player (only when approaching or winding up)
        if (b.pattern === 'approach' || b.pattern === 'attack_windup') {
            const centerX = b.x + b.width / 2;
            if (game.player.x > centerX) {
                b.facing = 'right';
            } else {
                b.facing = 'left';
            }
        }
        
        // Movement & Attack Logic
        const moveSpeed = 100;
        const attackRange = 300; // Approx 2 dragon widths
        
        if (b.pattern === 'approach') {
            b.state = 'walk';
            const playerCenterX = game.player.x + game.player.width / 2;
            const bossCenterX = b.x + b.width / 2;
            const dist = Math.abs(bossCenterX - playerCenterX);
            
            // Move towards player if too far
            if (dist > 150) { // Keep some distance
                if (bossCenterX < playerCenterX) {
                    b.x += moveSpeed * dt;
                } else {
                    b.x -= moveSpeed * dt;
                }
            }
            
            // Attack logic
            b.attackCooldown -= dt;
            if (b.attackCooldown <= 0 && dist < attackRange) {
                // Start Windup
                b.pattern = 'attack_windup';
                b.state = 'attack_windup';
                b.frame = 0;
                b.frameTime = 0;
                b.attackTimer = 1.0; // 1 second windup
                b.vx = 0;
            }
            
        } else if (b.pattern === 'attack_windup') {
            b.attackTimer -= dt;
            if (b.attackTimer <= 0) {
                // Start Leap
                b.pattern = 'attack_leap';
                b.state = 'attack';
                b.frame = 0;
                b.frameTime = 0;
                b.startX = b.x; // Remember start position for bounce back
                
                // Leap towards player
                const playerCenterX = game.player.x + game.player.width / 2;
                const bossCenterX = b.x + b.width / 2;
                const dir = playerCenterX > bossCenterX ? 1 : -1;
                
                b.vx = dir * 800; // Very fast leap
                b.vy = -600; // Jump up
                b.grounded = false;
                b.hasHitPlayer = false;
            }
            
        } else if (b.pattern === 'attack_leap') {
            // Move X (Y handled by gravity above)
            b.x += b.vx * dt;
            
            // Check collision with player
            if (!b.hasHitPlayer) {
                const bossBox = { x: b.x, y: b.y, width: b.width, height: b.height };
                const playerBox = { x: game.player.x, y: game.player.y, width: game.player.width, height: game.player.height };
                
                if (aabbIntersects(bossBox, playerBox)) {
                    // Hit player!
                    game.player.hp -= 10;
                    game.player.hurtTime = 0.5;
                    b.hasHitPlayer = true;
                    
                    // Bounce back immediately on hit
                    b.pattern = 'attack_bounce';
                    b.vx = -b.vx * 0.5; // Reverse direction
                    b.vy = -300; // Small hop back
                    b.grounded = false;
                }
            }
            
            // If we hit the ground without hitting player (missed), bounce back
            if (b.grounded) {
                b.pattern = 'attack_bounce';
                b.vx = -b.vx * 0.5; // Reverse direction
                b.vy = -300; // Small hop back
                b.grounded = false;
            }
            
        } else if (b.pattern === 'attack_bounce') {
            // Move X (Y handled by gravity)
            b.x += b.vx * dt;
            
            // When we land from the bounce, return to approach
            if (b.grounded) {
                b.pattern = 'approach';
                b.state = 'walk';
                b.attackCooldown = 5 + Math.random() * 2; // 5-7 seconds cooldown
            }
        }
        
        // Animation
        const frameDuration = b.state === 'attack' ? 0.5 : GAME_CONFIG.animation.frameDuration;
        
        if (b.frameTime > frameDuration) {
            b.frameTime = 0;
            const frameCount = getFrameCount('anguirus', b.state);
            b.frame = (b.frame + 1) % frameCount;
            
            if (b.state === 'attack' && b.frame === 0) {
                b.frame = frameCount - 1;
            }
        }
        
        // Check death
        if (b.hp <= 0 && !b.dead) {
            b.dead = true;
            b.state = 'dead';
            gameWin();
        }
    } else {
        // Handle dying animation (sinking and explosions)
        // Note: game-shell.js also does this, but we do it here to ensure it happens
        // even if game-shell logic changes. The position update below is critical.
        if (b.dying) {
            // Sink downward
            b.y += 10 * dt;  // Slow downward movement
            
            // Spawn random explosions
            b.explosionTimer -= dt;
            if (b.explosionTimer <= 0) {
                const randomX = b.x + Math.random() * b.width;
                const randomY = b.y + Math.random() * b.height;
                spawnExplosion(randomX, randomY);
                b.explosionTimer = 0.1 + Math.random() * 0.2;  // Every 0.1-0.3 seconds
            }
        }
    }
    
    // Update element - ALWAYS run this, even if dead
    const el = document.getElementById('anguirus');
    if (el) {
        applySpriteFrame(el, 'anguirus', b.state, b.frame, b.facing);
        el.style.left = (b.x - game.camera.x) + 'px';
        el.style.top = b.y + 'px';
        el.setAttribute('data-state', b.state);
        el.setAttribute('data-frame', b.frame);
    }
    
    // Update health bar
    const healthPct = Math.max(0, b.hp / b.maxHp * 100);
    document.getElementById('boss-health-fill').style.width = healthPct + '%';
}
