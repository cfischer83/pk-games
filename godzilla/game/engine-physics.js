// Physics calculations
function calculatePhysics() {
    const scale = ANCHORS_JSON.scale;
    const playerHeight = 128 * scale; // Base height (already scaled in sprite sheet)
    const targetApex = playerHeight * GAME_CONFIG.physics.targetApexFactor;
    const timeToApex = GAME_CONFIG.physics.timeToApexMs / 1000;
    
    // v = u + at, at apex v = 0, so u = -at = gt
    // s = ut + 0.5at^2, so apex = gt^2 - 0.5gt^2 = 0.5gt^2
    // Therefore g = 2*apex/t^2
    const gravity = (2 * targetApex) / (timeToApex * timeToApex);
    const jumpVel = gravity * timeToApex;
    
    return { gravity, jumpVel, targetApex };
}

// AABB collision
function aabbIntersects(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
}

// Swept AABB
function sweptAABB(box, vel, obstacle, dt) {
    if (vel.x === 0 && vel.y === 0) {
        return { hit: false, time: 1, normal: { x: 0, y: 0 } };
    }
    
    const expandedBox = {
        x: obstacle.x - box.width / 2,
        y: obstacle.y - box.height / 2,
        width: obstacle.width + box.width,
        height: obstacle.height + box.height
    };
    
    const ray = {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
        dx: vel.x * dt,
        dy: vel.y * dt
    };
    
    let tmin = 0;
    let tmax = 1;
    let normal = { x: 0, y: 0 };
    
    // X axis
    if (ray.dx !== 0) {
        const t1 = (expandedBox.x - ray.x) / ray.dx;
        const t2 = (expandedBox.x + expandedBox.width - ray.x) / ray.dx;
        
        const txmin = Math.min(t1, t2);
        const txmax = Math.max(t1, t2);
        
        if (txmin > tmin) {
            tmin = txmin;
            normal = { x: ray.dx > 0 ? -1 : 1, y: 0 };
        }
        tmax = Math.min(tmax, txmax);
    }
    
    // Y axis
    if (ray.dy !== 0) {
        const t1 = (expandedBox.y - ray.y) / ray.dy;
        const t2 = (expandedBox.y + expandedBox.height - ray.y) / ray.dy;
        
        const tymin = Math.min(t1, t2);
        const tymax = Math.max(t1, t2);
        
        if (tymin > tmin) {
            tmin = tymin;
            normal = { x: 0, y: ray.dy > 0 ? -1 : 1 };
        }
        tmax = Math.min(tmax, tymax);
    }
    
    if (tmax < tmin || tmin < 0 || tmin > 1) {
        return { hit: false, time: 1, normal: { x: 0, y: 0 } };
    }
    
    return { hit: true, time: tmin, normal };
}
