// Update projectiles
function updateProjectiles(dt) {
    // Account for mobile zoom when checking if projectiles are off-screen
    const mobileZoom = window.mobileZoomLevel || 1;
    const effectiveWidth = window.innerWidth / mobileZoom;
    
    game.projectiles = game.projectiles.filter(proj => {
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;
        
        if (proj.x < game.camera.x - 100 || proj.x > game.camera.x + effectiveWidth + 100) {
            proj.element.remove();
            return false;
        }
        
        // Animate bullet frames
        if (proj.element.classList.contains('bullet') && proj.frameTime !== undefined) {
            proj.frameTime += dt;
            if (proj.frameTime >= GAME_CONFIG.animation.frameDuration) {
                proj.frameTime = 0;
                const frameCount = getFrameCount('bullet', 'fired');
                proj.frame = (proj.frame + 1) % frameCount;
                applySpriteFrame(proj.element, 'bullet', 'fired', proj.frame, 'left');
            }
        }
        
        // Animate lightning frames
        if (proj.element.classList.contains('lightning-bolt') && proj.frameTime !== undefined) {
            proj.frameTime += dt;
            if (proj.frameTime >= GAME_CONFIG.animation.frameDuration) {
                proj.frameTime = 0;
                const frameCount = getFrameCount('lightning', 'bolt');
                proj.frame = (proj.frame + 1) % frameCount;
                applySpriteFrame(proj.element, 'lightning', 'bolt', proj.frame, proj.facing);
                
                // Re-apply rotation and origin if they exist
                if (proj.rotation !== undefined && proj.scale !== undefined) {
                    if (proj.transformOrigin) {
                        proj.element.style.transformOrigin = proj.transformOrigin;
                    }
                    proj.element.style.transform = `${proj.scale} rotate(${proj.rotation}deg)`;
                }
            }
        }
        
        // Position projectiles
        const groundY = window.innerHeight * 0.9;
        const groundHeight = window.innerHeight * 0.1;
        proj.element.style.left = (proj.x - game.camera.x) + 'px';
        proj.element.style.bottom = (groundHeight + groundY - proj.y - proj.height) + 'px';
        
        return true;
    });
}
