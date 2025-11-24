function toggleDebug() {
    if (game.debug) {
        document.body.classList.add('debug-mode');
        document.getElementById('debug').style.display = 'block';
    } else {
        document.body.classList.remove('debug-mode');
        document.getElementById('debug').style.display = 'none';
    }
}

function updateDebug() {
    if (!game.debug) return;
    
    const p = game.player;
    const debugEl = document.getElementById('debug');
    
    let html = `
        FPS: ${Math.round(1 / game.fixedDeltaMs * 1000)}<br>
        Time: ${game.time.toFixed(1)}<br>
        Player: ${Math.round(p.x)}, ${Math.round(p.y)}<br>
        State: ${p.state} (Frame: ${p.frame})<br>
        Vel: ${Math.round(p.vx)}, ${Math.round(p.vy)}<br>
        Grounded: ${p.grounded}<br>
        Enemies: ${game.enemies.length}<br>
        Obstacles: ${game.obstacles.length}<br>
        Projectiles: ${game.projectiles.length}<br>
    `;
    
    if (game.boss) {
        html += `Boss: ${game.boss.state} (${game.boss.pattern})<br>`;
        html += `Boss HP: ${game.boss.hp}/${game.boss.maxHp}<br>`;
    }
    
    debugEl.innerHTML = html;
}
