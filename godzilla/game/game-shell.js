function startGame() {
    document.getElementById('menu').style.display = 'none';
    
    // Reset game state
    game.running = true;
    game.won = false;
    game.lost = false;
    game.time = 0;
    game.lastTime = performance.now();
    game.accumulator = 0;
    
    game.player.hp = GAME_CONFIG.hp.player;
    game.player.x = 100;
    game.player.y = window.innerHeight * 0.9 - game.player.height; // Start at ground level
    game.player.vx = 0;
    game.player.vy = 0;
    game.player.fireCooldown = 0;
    game.player.dying = false;
    game.player.deathTimer = 0;
    game.player.explosionTimer = 0;
    game.player.state = 'stand';
    game.player.invulnerable = 0;
    
    game.enemies = [];
    game.obstacles = [];
    game.projectiles = [];
    game.explosions = [];
    game.lifePickups = [];
    game.boss = null;
    game.spawn.gateReached = false;
    game.spawn.enemiesFinished = false;
    game.spawn.obstaclesFinished = false;
    game.spawn.lastEnemyClearedX = 0;
    game.spawn.timers = {};
    game.spawn.obstacleTimer = 0;
    
    // Clear world
    const world = document.getElementById('world');
    world.innerHTML = '<div id="dragon1" class="sprite" data-upper="stand" data-lower="stand" data-facing="right" data-frame="0" data-attack="none" data-can-fire="true"></div><div id="dragon1-upper" class="sprite"></div>';
    
    requestAnimationFrame(gameLoop);
	pkAnalytics("start");
}

function gameWin() {
    if (game.won) return; // Prevent multiple calls
    game.won = true;
    
    // Make player invulnerable
    game.player.invulnerable = 999;
    
    // Start boss death animation
    if (game.boss) {
        game.boss.dying = true;
        game.boss.deathTimer = 5;  // 5 seconds of death animation
        game.boss.explosionTimer = 0;
    }
	pkAnalytics("win");
}

function gameLose() {
    if (game.lost) return; // Prevent multiple calls
    game.lost = true;
    
    // Make boss invulnerable
    if (game.boss) {
        game.boss.invulnerable = 999;
    }
    
    // Start player death animation
    game.player.dying = true;
    game.player.deathTimer = 5;  // 5 seconds of death animation
    game.player.explosionTimer = 0;
    game.player.state = 'dead';  // Set to dead state
    game.player.frame = 0;
	pkAnalytics("lose");
}

function showGameOverMenu(won) {
    game.running = false;
    const menu = document.getElementById('menu');
    if (won) {
        menu.innerHTML = '<h1>YOU WIN!</h1><button onclick="window.location.reload();">PLAY AGAIN</button><br /><button onclick="window.location.href = \'../index.html\'" class="secondary-btn">BACK TO START</button>';
    } else {
        menu.innerHTML = '<h1>YOU LOSE!</h1><button onclick="window.location.reload();">RETRY?</button><br /><button onclick="window.location.href = \'../index.html\'" class="secondary-btn">BACK TO START</button>';
    }
    menu.style.display = 'block';
}
