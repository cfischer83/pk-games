// Spawn scheduler
function updateSpawner(dt) {
    if (game.spawn.gateReached) return;
    
    // *** TESTING MODE: Skip enemy/obstacle spawning ***
    if (GAME_CONFIG.TESTING_BOSS) {
        if (!game.spawn.enemiesFinished) {
            game.spawn.enemiesFinished = true;
        }
        return;
    }
    // *** END TESTING MODE ***
    
    const elapsed = game.time;
    const schedule = GAME_CONFIG.spawn.schedule;
    
    // Find current phase for enemies
    let phase = null;
    for (let p of schedule) {
        if (elapsed >= p.start && elapsed < p.end) {
            phase = p;
            break;
        }
    }
    
    if (!phase) {
        // No more enemy spawning phases - mark as finished
        if (!game.spawn.enemiesFinished) {
            game.spawn.enemiesFinished = true;
            if (game.debug) {
                console.log('Enemy spawning finished at time:', elapsed);
            }
        }
    } else {
        // Update spawn timers for enemies
        phase.enemies.forEach((type, i) => {
            const key = `${type}_${i}`;
            if (!game.spawn.timers[key]) {
                game.spawn.timers[key] = 0;
            }
            
            game.spawn.timers[key] += dt;
            
            const interval = phase.intervals[i] / 1000;
            if (game.spawn.timers[key] >= interval) {
                if (game.enemies.length < phase.max) {
                    spawnEnemy(type);
                    game.spawn.timers[key] = 0;
                }
            }
        });
    }
    
    // Obstacle spawning - stop when enemy spawning stops
    if (game.spawn.enemiesFinished) {
        if (!game.spawn.obstaclesFinished) {
            game.spawn.obstaclesFinished = true;
            if (game.debug) {
                console.log('Obstacle spawning finished at time:', elapsed);
            }
        }
        return; // Stop all spawning
    }
    
    const obstacleSchedule = GAME_CONFIG.spawn.obstacleSchedule;
    let obstaclePhase = null;
    for (let p of obstacleSchedule) {
        if (elapsed >= p.start && elapsed < p.end) {
            obstaclePhase = p;
            break;
        }
    }
    
    if (obstaclePhase) {
        game.spawn.obstacleTimer += dt;
        const obstacleInterval = obstaclePhase.interval / 1000;
        if (game.spawn.obstacleTimer >= obstacleInterval) {
            spawnObstacle();
            game.spawn.obstacleTimer = 0;
        }
    }
}
