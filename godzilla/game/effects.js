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
function spawnLifePickup(x, y) {
    // 33% chance to spawn
    if (Math.random() >= 0.25) {
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
