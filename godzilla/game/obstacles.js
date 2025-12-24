// Helper to get effective viewport width accounting for mobile zoom
function getEffectiveViewportWidth() {
    const mobileZoom = window.mobileZoomLevel || 1;
    // When zoomed to 0.5, visible area is 2x wider, so we need to spawn further out
    return window.innerWidth / mobileZoom;
}

// Spawn obstacles (rocks)
function spawnObstacle() {
    if (game.obstacles.length >= GAME_CONFIG.spawn.maxObstacles) return;
    if (game.spawn.gateReached) return;
    
    const spawnX = game.camera.x + getEffectiveViewportWidth() + 50;
    const minSpacing = game.player.width;
    
    // Check spacing with other obstacles
    for (let obstacle of game.obstacles) {
        if (Math.abs(obstacle.x - spawnX) < minSpacing) return;
    }
    
    // Check spacing with enemies too
    for (let enemy of game.enemies) {
        if (Math.abs(enemy.x - spawnX) < minSpacing) return;
    }
    
    const obstacle = {
        type: 'rock',
        x: spawnX,
        vx: 0, // Rocks don't move
        vy: 0,
        width: 64,
        height: 96,
        hp: GAME_CONFIG.hp.rock,
        dead: false,
        element: null
    };
    
    obstacle.y = window.innerHeight * 0.9 - obstacle.height; // On the ground
    
    // Create element
    const el = document.createElement('div');
    el.className = 'obstacle rock sprite';
    el.style.width = obstacle.width + 'px';
    el.style.height = obstacle.height + 'px';
    el.setAttribute('data-type', 'rock');
    el.setAttribute('data-frame', '0');
    el.setAttribute('data-active', 'true');
    
    // Set initial position before appending to prevent flash at (0,0)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (obstacle.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - obstacle.y - obstacle.height) + 'px';
    
    obstacle.element = el;
    document.getElementById('world').appendChild(el);
    game.obstacles.push(obstacle);
}

// Update obstacles
function updateObstacles(dt) {
    game.obstacles = game.obstacles.filter(obstacle => {
        if (obstacle.dead) {
            obstacle.element.remove();
            return false;
        }
        
        // Obstacles don't move
        
        // Check if off-screen
        if (obstacle.x < game.camera.x - 100) {
            obstacle.element.remove();
            return false;
        }
        
        // Update position
        const groundY = window.innerHeight * 0.9;
        const groundHeight = window.innerHeight * 0.1;
        obstacle.element.style.left = (obstacle.x - game.camera.x) + 'px';
        obstacle.element.style.bottom = (groundHeight + groundY - obstacle.y - obstacle.height) + 'px';
        
        return true;
    });
}
