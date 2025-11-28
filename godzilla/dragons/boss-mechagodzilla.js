// MechaGodzilla Boss Logic
function spawnBoss() {
    const spriteInfo = ANCHORS_JSON.mechagodzilla || { baseFrameSize: { w: 122, h: 136 } };
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
        state: 'stand',
        frame: 0,
        frameTime: 0,
        hurtTime: 0,
        invulnerable: 0,
        dead: false,
        facing: 'left',
        pattern: 'approach',  // 'approach', 'sliding'
        
        // Eye laser (like turret)
        laserCooldown: 2,
        laserBurstCount: 0,
        laserBurstCooldown: 0,
        
        // Hand bullets (like tank)
        bulletCooldown: 3,
        
        // Slide back
        slideCooldown: 5 + Math.random() * 3,  // 5-8 seconds
        slideTime: 0,
        slideDirection: 0
    };
    
    const el = document.createElement('div');
    el.id = 'mechagodzilla';
    el.className = 'sprite';
    el.style.width = game.boss.width + 'px';
    el.style.height = game.boss.height + 'px';
    el.setAttribute('data-state', 'stand');
    el.setAttribute('data-frame', '0');
    
    document.getElementById('world').appendChild(el);
    document.getElementById('boss-health').style.display = 'block';
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
        
        if (b.hurtTime > 0) {
            b.hurtTime -= dt;
        }
        
        // Face the player (when not sliding)
        if (b.pattern !== 'sliding') {
            const centerX = b.x + b.width / 2;
            const playerCenterX = game.player.x + game.player.width / 2;
            if (playerCenterX > centerX + 20) {
                b.facing = 'right';
            } else if (playerCenterX < centerX - 20) {
                b.facing = 'left';
            }
        }
        
        // Movement patterns
        const moveSpeed = 150;
        const preferredDistance = 300;  // MechaGodzilla wants to keep distance
        
        if (b.pattern === 'approach') {
            const playerCenterX = game.player.x + game.player.width / 2;
            const bossCenterX = b.x + b.width / 2;
            const dist = Math.abs(bossCenterX - playerCenterX);
            
            // Move to maintain preferred distance
            if (dist < preferredDistance - 50) {
                // Too close, back up
                b.state = 'walk';
                if (bossCenterX < playerCenterX) {
                    b.x -= moveSpeed * dt;
                } else {
                    b.x += moveSpeed * dt;
                }
            } else if (dist > preferredDistance + 100) {
                // Too far, approach
                b.state = 'walk';
                if (bossCenterX < playerCenterX) {
                    b.x += moveSpeed * dt;
                } else {
                    b.x -= moveSpeed * dt;
                }
            } else {
                // Good distance, stand and shoot
                b.state = 'stand';
            }
            
            // Check if should slide back
            b.slideCooldown -= dt;
            if (b.slideCooldown <= 0 && dist < preferredDistance) {
                // Start sliding away from player
                b.pattern = 'sliding';
                b.state = 'slide';
                b.slideTime = 0.8;  // Slide for 0.8 seconds
                b.slideDirection = bossCenterX < playerCenterX ? -1 : 1;
                b.slideCooldown = 5 + Math.random() * 3;
            }
        } else if (b.pattern === 'sliding') {
            // Fast slide backwards
            const slideSpeed = 400;
            b.x += b.slideDirection * slideSpeed * dt;
            
            b.slideTime -= dt;
            if (b.slideTime <= 0) {
                b.pattern = 'approach';
                b.state = 'stand';
            }
        }
        
        // Keep boss on screen
        const screenLeft = game.camera.x + 50;
        const screenRight = game.camera.x + window.innerWidth - b.width - 50;
        if (b.x < screenLeft) b.x = screenLeft;
        if (b.x > screenRight) b.x = screenRight;
        
        // Eye laser attacks (like turret - 3 burst)
        if (b.laserBurstCount > 0) {
            b.laserBurstCooldown -= dt;
            if (b.laserBurstCooldown <= 0) {
                shootEyeLaser(b);
                b.laserBurstCount--;
                if (b.laserBurstCount > 0) {
                    b.laserBurstCooldown = 0.33;
                } else {
                    b.laserCooldown = 4;
                }
            }
        } else {
            b.laserCooldown -= dt;
            if (b.laserCooldown <= 0) {
                b.laserBurstCount = 3;
                b.laserBurstCooldown = 0;
            }
        }
        
        // Hand bullet attacks (like tank)
        b.bulletCooldown -= dt;
        if (b.bulletCooldown <= 0) {
            shootHandBullet(b);
            b.bulletCooldown = 2;
        }
        
        // Animation
        if (b.frameTime > GAME_CONFIG.animation.frameDuration) {
            b.frameTime = 0;
            const frameCount = getFrameCount('mechagodzilla', b.state);
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
    const el = document.getElementById('mechagodzilla');
    if (el) {
        applySpriteFrame(el, 'mechagodzilla', b.state, b.frame, b.facing);
        el.style.left = (b.x - game.camera.x) + 'px';
        el.style.top = b.y + 'px';
        el.setAttribute('data-state', b.state);
        el.setAttribute('data-frame', b.frame);
    }
    
    // Update health bar
    const healthPct = Math.max(0, b.hp / b.maxHp * 100);
    document.getElementById('boss-health-fill').style.width = healthPct + '%';
}

// Shoot eye laser (like turret laser)
function shootEyeLaser(boss) {
    const laserWidth = 20;
    const laserHeight = 5;
    
    // Spawn from eye level (roughly 20% from top of sprite)
    let laserX;
    if (boss.facing === 'left') {
        laserX = boss.x - laserWidth;
    } else {
        laserX = boss.x + boss.width;
    }
    
    const laserY = boss.y + boss.height * 0.1;
    
    const laser = {
        x: laserX,
        y: laserY,
        vx: boss.facing === 'left' ? -400 : 400,
        vy: 0,
        width: laserWidth,
        height: laserHeight,
        type: 'laser',
        source: 'mechagodzilla',
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'laser projectile';
    el.setAttribute('data-type', 'laser');
    el.setAttribute('data-active', 'true');
    el.style.position = 'absolute';
    el.style.width = laserWidth + 'px';
    el.style.height = laserHeight + 'px';
    el.style.backgroundColor = '#FFF';
    el.style.borderRadius = '3px';
    el.style.boxShadow = '0 0 13px 6px #ff0000, 0 0 16px #ff4444';
    
    // Set initial position before appending to prevent flash at (0,0)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (laser.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - laser.y - laser.height) + 'px';
    
    laser.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(laser);
}

// Shoot hand bullet (like tank bullet)
function shootHandBullet(boss) {
    // Spawn from hand level (roughly 60% from top of sprite)
    let bulletX;
    if (boss.facing === 'left') {
        bulletX = boss.x - 20;
    } else {
        bulletX = boss.x + boss.width;
    }
    
    const bulletY = boss.y + boss.height * 0.4;
    
    const bullet = {
        x: bulletX,
        y: bulletY,
        vx: boss.facing === 'left' ? -200 : 200,
        vy: 0,
        width: 30,
        height: 14,
        frame: 0,
        frameTime: 0,
        source: 'mechagodzilla',
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'bullet projectile sprite';
    el.setAttribute('data-type', 'bullet');
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-active', 'true');
    
    applySpriteFrame(el, 'bullet', 'fired', 0, boss.facing);
    
    // Set initial position before appending to prevent flash at (0,0)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (bullet.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - bullet.y - bullet.height) + 'px';
    
    bullet.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(bullet);
}
