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
    }
    
    // Create element
    const el = document.createElement('div');
    el.className = `enemy ${type} sprite`;
    el.style.width = enemy.width + 'px';
    el.style.height = enemy.height + 'px';
    el.setAttribute('data-type', type);
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-active', 'true');
    
    // Apply initial sprite frame for birds
    if (type === 'bird') {
        applySpriteFrame(el, 'bird', 'fly', 0, 'left');
    }
    
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
        
        // Movement (rocks don't move)
        if (enemy.type !== 'rock') {
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
    
    bullet.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(bullet);
}
