// Spawn enemies
function spawnEnemy(type) {
    if (game.enemies.length >= GAME_CONFIG.spawn.maxEnemies) return;
    if (game.spawn.gateReached) return;
    
    const spawnX = game.camera.x + window.innerWidth + 50;
    const minSpacing = game.player.width;
    
    // Check spacing with other enemies
    for (let enemy of game.enemies) {
        if (Math.abs(enemy.x - spawnX) < minSpacing) return;
    }
    
    const enemy = {
        type: type,
        x: spawnX,
        y: window.innerHeight * 0.9 - 60,
        vx: -50,
        vy: 0,
        width: 50,
        height: 50,
        hp: GAME_CONFIG.hp[type] || 1,
        dead: false,
        element: null
    };
    
    if (type === 'bird') {
        enemy.width = 42;
        enemy.height = 30;
        // Spawn birds between ground level and max dragon jump height
        // Y coordinate system: higher values = closer to ground
        const groundY = window.innerHeight * 0.9;
        const minBirdY = groundY - physics.targetApex - enemy.height; // Highest point (max jump)
        const maxBirdY = groundY - enemy.height; // Ground level
        enemy.y = minBirdY + Math.random() * (maxBirdY - minBirdY);
        enemy.vx = -80;
        enemy.state = 'fly';
        enemy.frame = 0;
        enemy.frameTime = 0;
    } else if (type === 'tank') {
        enemy.width = 64;
        enemy.height = 40;
        enemy.shootCooldown = 2;
		enemy.y = window.innerHeight * 0.9 - enemy.height;
    } else if (type === 'bubble-craft') {
        enemy.width = 30;
        enemy.height = 26;
        // Spawn at mid-sky height (between top and ground)
        const groundY = window.innerHeight * 0.9;
        enemy.y = groundY * 0.3;  // Mid-sky
        enemy.baseY = enemy.y;  // Remember original height for retreat
        enemy.vx = -60;  // Slow drift left
        enemy.state = 'fly';
        enemy.frame = 0;
        enemy.frameTime = 0;
        enemy.pattern = 'hover';  // 'hover', 'diving', 'retreating'
        enemy.diveSpeed = 300;  // Configurable dive speed
        enemy.diveProgress = 0;  // For easing curve (0 to 1)
        enemy.diveEarly = Math.random() < 0.5;  // 50% chance to dive earlier (steeper angle)
        enemy.diveStartX = enemy.x;
        enemy.diveStartY = enemy.y;
        enemy.diveTargetX = enemy.x;
        enemy.diveTargetY = enemy.y;
        enemy.retreatStartY = enemy.y;
        enemy.retreatTargetY = enemy.y;
    } else if (type === 'turret') {
        enemy.width = 80;
        enemy.height = 130;
        enemy.vx = 0;  // Turret doesn't move
        enemy.y = window.innerHeight * 0.9 - enemy.height;
        enemy.state = 'still';
        enemy.frame = 0;
        enemy.frameTime = 0;
        enemy.shootCooldown = 2;  // Start with a shorter initial cooldown
        enemy.burstCount = 0;  // Track shots in current burst
        enemy.burstCooldown = 0;  // Time between shots in a burst
        enemy.facing = 'left';  // Will be updated based on player position
    }
    
    // Create element
    const el = document.createElement('div');
    el.className = `enemy ${type} sprite`;
    el.style.width = enemy.width + 'px';
    el.style.height = enemy.height + 'px';
    el.setAttribute('data-type', type);
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-active', 'true');
    
    // Apply initial sprite frame for birds, bubble-crafts, and turrets
    if (type === 'bird') {
        applySpriteFrame(el, 'bird', 'fly', 0, 'left');
    } else if (type === 'bubble-craft') {
        applySpriteFrame(el, 'bubble-craft', 'fly', 0, 'left');
    } else if (type === 'turret') {
        applySpriteFrame(el, 'turret', 'still', 0, 'left');
    }
    
    // Set initial position before appending to prevent flash at (0,0)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (enemy.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - enemy.y - enemy.height) + 'px';
    
    enemy.element = el;
    document.getElementById('world').appendChild(el);
    game.enemies.push(enemy);
}

// Update enemies
function updateEnemies(dt) {
    game.enemies = game.enemies.filter(enemy => {
        if (enemy.dead) {
            enemy.element.remove();
            return false;
        }
        
        // Movement (rocks and turrets don't move)
        if (enemy.type !== 'rock' && enemy.type !== 'turret') {
            enemy.x += enemy.vx * dt;
        }
        
        if (enemy.type === 'bird') {
            enemy.y += Math.sin(game.time * 3) * 150 * dt;
            
            // Animate bird frames
            enemy.frameTime += dt;
            if (enemy.frameTime >= GAME_CONFIG.animation.frameDuration) {
                enemy.frameTime = 0;
                const frameCount = getFrameCount('bird', 'fly');
                enemy.frame = (enemy.frame + 1) % frameCount;
                applySpriteFrame(enemy.element, 'bird', 'fly', enemy.frame, 'left');
            }
        } else if (enemy.type === 'tank') {
            enemy.shootCooldown -= dt;
            if (enemy.shootCooldown <= 0) {
                shootBullet(enemy);
                enemy.shootCooldown = 2;
            }
        } else if (enemy.type === 'bubble-craft') {
            updateBubbleCraft(enemy, dt);
        } else if (enemy.type === 'turret') {
            updateTurret(enemy, dt);
        }
        
        // Check if off-screen
        if (enemy.x < game.camera.x - 100) {
            enemy.element.remove();
            return false;
        }
        
        // Update position
        const groundY = window.innerHeight * 0.9;
        const groundHeight = window.innerHeight * 0.1;
        enemy.element.style.left = (enemy.x - game.camera.x) + 'px';
        enemy.element.style.bottom = (groundHeight + groundY - enemy.y - enemy.height) + 'px';
        
        return true;
    });
}

function shootBullet(tank) {
    const bullet = {
        x: tank.x - 20,
        y: tank.y + (tank.height/2)-10,
        vx: -200,
        vy: 0,
        width: 30,
        height: 14,
        frame: 0,
        frameTime: 0,
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'bullet projectile sprite';
    el.setAttribute('data-type', 'bullet');
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-active', 'true');
    
    // Apply initial sprite frame
    applySpriteFrame(el, 'bullet', 'fired', 0, 'left');
    
    // Set initial position before appending to prevent flash at (0,0)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (bullet.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - bullet.y - bullet.height) + 'px';
    
    bullet.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(bullet);
}

// Easing function for smooth arc (ease-in-out)
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Update bubble-craft enemy behavior
function updateBubbleCraft(enemy, dt) {
    const p = game.player;
    const groundY = window.innerHeight * 0.9;
    
    // Animate frames continuously
    enemy.frameTime += dt;
    if (enemy.frameTime >= GAME_CONFIG.animation.frameDuration) {
        enemy.frameTime = 0;
        const frameCount = getFrameCount('bubble-craft', 'fly');
        enemy.frame = (enemy.frame + 1) % frameCount;
        applySpriteFrame(enemy.element, 'bubble-craft', 'fly', enemy.frame, 'left');
    }
    
    if (enemy.pattern === 'hover') {
        // Drift left slowly at fixed height
        enemy.x += enemy.vx * dt;
        
        // Check for dive opportunity
        // Player center position
        const playerCenterX = p.x + p.width / 2;
        const playerCenterY = p.y + p.height / 2;
        const enemyCenterX = enemy.x + enemy.width / 2;
        const enemyCenterY = enemy.y + enemy.height / 2;
        
        // Distance to player
        const dx = enemyCenterX - playerCenterX;
        const dy = playerCenterY - enemyCenterY;  // dy is positive when enemy is above player
        
        // Determine when to dive based on angle ratio
        // At 45 degrees: dx/dy = 1.0
        // Early dive at steeper angle: dx/dy around 1.5-2.0 (craft much further right)
        const targetRatio = enemy.diveEarly ? 1.5 + Math.random() * 0.5 : 1.0;  // 1.5-2.0 for early, 1.0 for 45°
        
        // Check if at appropriate angle and enemy is above and to the right
        if (dx > 0 && dy > 0) {
            const currentRatio = dx / dy;
            // Trigger dive when we reach the target ratio (within small tolerance)
            if (currentRatio <= targetRatio + 0.1 && currentRatio >= targetRatio - 0.2) {
                // Start dive!
                enemy.pattern = 'diving';
                enemy.diveProgress = 0;
                enemy.diveStartX = enemy.x;
                enemy.diveStartY = enemy.y;
                
                // For early dives, target AHEAD of the player to intercept their walk
                // Calculate where player will be when craft arrives
                if (enemy.diveEarly) {
                    // Estimate dive time based on distance and speed
                    const estimatedDiveDistance = Math.sqrt(dx * dx + dy * dy);
                    const estimatedDiveTime = estimatedDiveDistance / enemy.diveSpeed;
                    // Lead the player by their walking speed
                    const playerSpeed = GAME_CONFIG.speed.base || 130;
                    const leadDistance = playerSpeed * estimatedDiveTime * 0.8;  // 80% lead to not overshoot too much
                    enemy.diveTargetX = p.x + leadDistance;
                } else {
                    // Normal dive targets current player position
                    enemy.diveTargetX = p.x;
                }
                enemy.diveTargetY = p.y + p.height - enemy.height;  // Align bottoms
            }
        }
    } else if (enemy.pattern === 'diving') {
        // Calculate dive duration based on distance and speed
        const diveDistanceX = enemy.diveStartX - enemy.diveTargetX;
        const diveDistanceY = enemy.diveTargetY - enemy.diveStartY;
        const totalDistance = Math.sqrt(diveDistanceX * diveDistanceX + diveDistanceY * diveDistanceY);
        const diveDuration = totalDistance / enemy.diveSpeed;
        
        // Progress through dive with easing
        enemy.diveProgress += dt / diveDuration;
        
        // Apply eased position FIRST (before checking completion)
        const clampedProgress = Math.min(enemy.diveProgress, 1);
        const easedProgress = easeInOutQuad(clampedProgress);
        enemy.x = enemy.diveStartX - (enemy.diveStartX - enemy.diveTargetX) * easedProgress;
        enemy.y = enemy.diveStartY + (enemy.diveTargetY - enemy.diveStartY) * easedProgress;
        
        if (enemy.diveProgress >= 1) {
            // Start retreat from current position
            enemy.pattern = 'retreating';
            enemy.diveProgress = 0;
            enemy.retreatStartY = enemy.y;
            enemy.retreatTargetY = enemy.baseY;
        }
        
    } else if (enemy.pattern === 'retreating') {
        // Arc back up to original height while continuing left
        const retreatDuration = 1.5;  // seconds to retreat
        enemy.diveProgress += dt / retreatDuration;
        
        if (enemy.diveProgress >= 1) {
            enemy.diveProgress = 1;
            enemy.pattern = 'hover';
            enemy.y = enemy.baseY;
        } else {
            // Ease back up vertically
            const easedProgress = easeInOutQuad(enemy.diveProgress);
            enemy.y = enemy.retreatStartY + (enemy.retreatTargetY - enemy.retreatStartY) * easedProgress;
        }
        
        // Continue drifting left during retreat
        enemy.x += enemy.vx * dt;
    }
}

// Update turret enemy behavior
function updateTurret(enemy, dt) {
    const p = game.player;
    
    // Face the player
    const turretCenterX = enemy.x + enemy.width / 2;
    const playerCenterX = p.x + p.width / 2;
    enemy.facing = playerCenterX < turretCenterX ? 'left' : 'right';
    
    // Handle burst shooting
    if (enemy.burstCount > 0) {
        // In the middle of a burst
        enemy.burstCooldown -= dt;
        if (enemy.burstCooldown <= 0) {
            shootLaser(enemy);
            enemy.burstCount--;
            if (enemy.burstCount > 0) {
                enemy.burstCooldown = 0.33;  // ~0.33s between shots (3 shots in 1 second)
            } else {
                // Burst complete, start main cooldown
                enemy.shootCooldown = 4;
                enemy.state = 'still';
                enemy.frame = 0;
            }
        }
        
        // Animate shooting frames during burst
        enemy.frameTime += dt;
        if (enemy.frameTime >= 0.08) {  // Fast animation during shooting
            enemy.frameTime = 0;
            const frameCount = getFrameCount('turret', 'shooting');
            enemy.frame = (enemy.frame + 1) % frameCount;
        }
        applySpriteFrame(enemy.element, 'turret', 'shooting', enemy.frame, enemy.facing);
    } else {
        // Waiting for next burst
        enemy.shootCooldown -= dt;
        if (enemy.shootCooldown <= 0) {
            // Start a new burst
            enemy.burstCount = 3;
            enemy.burstCooldown = 0;  // Fire first shot immediately
            enemy.state = 'shooting';
            enemy.frame = 0;
            enemy.frameTime = 0;
        }
        
        // Show still state
        applySpriteFrame(enemy.element, 'turret', 'still', 0, enemy.facing);
    }
}

// Shoot laser from turret
function shootLaser(turret) {
    const laserWidth = 20;
    const laserHeight = 5;
    
    // Spawn laser from the side of the turret facing the player
    let laserX;
    if (turret.facing === 'left') {
        laserX = turret.x - laserWidth;
    } else {
        laserX = turret.x + turret.width;
    }
    
    // Spawn at roughly mid-height of turret
    const laserY = turret.y + turret.height * 0.2;
    
    const laser = {
        x: laserX,
        y: laserY,
        vx: turret.facing === 'left' ? -400 : 400,
        vy: 0,
        width: laserWidth,
        height: laserHeight,
        type: 'laser',
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'laser projectile';
    el.setAttribute('data-type', 'laser');
    el.setAttribute('data-active', 'true');
    el.style.position = 'absolute';
    el.style.width = laserWidth + 'px';
    el.style.height = laserHeight + 'px';
    el.style.backgroundColor = '#ffffff';
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
