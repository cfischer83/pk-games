// Collision detection
function checkCollisions() {
    const p = game.player;
    
    // Get player hitbox/hurtbox
    const playerBox = {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height
    };
    
    if (p.state === 'duck' || p.state === 'duck_spin') {
        playerBox.height *= 0.75;
        playerBox.y += p.height * 0.25;
        
        // Adjust x position for duck offset to match visual position
        const frameInfo = getFrameInfo('dragon1', p.state, p.frame);
        if (frameInfo) {
            // Apply correct offset based on facing direction
            if (p.facing === 'right' && frameInfo.duckOffset) {
                playerBox.x += frameInfo.duckOffset;
            } else if (p.facing === 'left' && frameInfo.duckOffsetLeft) {
                playerBox.x += frameInfo.duckOffsetLeft;
            }
        }
    }
    
    // Adjust x position for kick offset when kicking and facing left
    if (p.state === 'kick' && p.facing === 'left') {
        const frameInfo = getFrameInfo('dragon1', p.state, p.frame);
        if (frameInfo && frameInfo.kickOffset) {
            playerBox.x += frameInfo.kickOffset;
        }
    }
    
    // Check if player is attacking
    const isAttacking = p.attacking || p.tailActive || p.fireState === 'beam';
    const isPunching = p.attacking && p.attackType === 'punch';
    
    // Create punch hitbox if punching (upper body area)
    let punchHitbox = null;
    if (isPunching) {
        // Upper body punch hitbox - positioned at the upper 64px of the player
        const punchWidth = 142;
        const punchHeight = 64;
        const punchReach = p.facing === 'right' ? 30 : -30; // Extend hitbox in facing direction
        
        punchHitbox = {
            x: p.facing === 'right' ? p.x + punchReach : p.x - punchWidth + punchReach,
            y: p.y, // Upper portion of sprite
            width: punchWidth,
            height: punchHeight
        };
    }
    
    // Enemy collisions
    game.enemies.forEach(enemy => {
        const enemyBox = {
            x: enemy.x,
            y: enemy.y,
            width: enemy.width,
            height: enemy.height
        };
        
        // Check punch hitbox first
        let punchHit = false;
        if (punchHitbox && aabbIntersects(punchHitbox, enemyBox)) {
            // Only damage if this enemy hasn't been hit by this attack yet
            if (!p.attackHits.includes(enemy)) {
                punchHit = true;
                p.attackHits.push(enemy); // Mark as hit
                enemy.hp -= GAME_CONFIG.damage.punch;
                if (enemy.hp <= 0) {
                    enemy.dead = true;
                    // Spawn explosion at enemy center
                    const explosionX = enemy.x + enemy.width / 2;
                    const explosionY = enemy.y + enemy.height / 2;
                    spawnExplosion(explosionX, explosionY);
                } else if (enemy.type === 'rock' && enemy.hp <= 3) {
                    enemy.element.classList.add('broken');
                }
            }
        }
        
        // Regular body collision (only if not already hit by punch)
        if (!punchHit && aabbIntersects(playerBox, enemyBox)) {
            // Check if player is doing any damaging action
            const isDucking = p.state === 'duck' || p.state === 'duck_spin';
            if ((isAttacking && !isPunching) || isDucking) {
                // Only damage if this enemy hasn't been hit by this attack yet
                if (!p.attackHits.includes(enemy)) {
                    // Debug logging for tail
                    if (p.tailActive && enemy.type === 'rock' && game.debug) {
                        console.log('Tail collision with rock:', {
                            tailActive: p.tailActive,
                            state: p.state,
                            isDucking: isDucking,
                            isAttacking: isAttacking,
                            enemyHP: enemy.hp,
                            damage: GAME_CONFIG.damage.tail
                        });
                    }
                    
                    // Any attack or duck_spin damages enemies (including rocks)
                    let damage = 0;
                    if (p.tailActive || p.state === 'duck_spin') {
                        damage = GAME_CONFIG.damage.tail;
                    } else if (p.attacking) {
                        damage = p.attackType === 'kick' ? 2 : 1;
                    }
                    
                    if (damage > 0) {
                        p.attackHits.push(enemy); // Mark as hit
                        enemy.hp -= damage;
                        if (enemy.hp <= 0) {
                            enemy.dead = true;
                            // Spawn explosion at enemy center
                            const explosionX = enemy.x + enemy.width / 2;
                            const explosionY = enemy.y + enemy.height / 2;
                            spawnExplosion(explosionX, explosionY);
                        } else if (enemy.type === 'rock' && enemy.hp <= 3) {
                            enemy.element.classList.add('broken');
                        }
                    }
                }
            } else if (p.invulnerable <= 0 && !isAttacking && !isDucking) {
                // Contact damage to player (not rocks)
                if (enemy.type !== 'rock') {
                    // Bubble-craft does configured damage and retreats on hit
                    if (enemy.type === 'bubble-craft') {
                        p.hp -= GAME_CONFIG.damage.bubbleCraftContact;
                        // Trigger retreat from current position
                        enemy.pattern = 'retreating';
                        enemy.diveProgress = 0;
                        enemy.retreatStartY = enemy.y;
                        enemy.retreatTargetY = enemy.baseY;
                    } else {
                        const damage = enemy.type === 'bird' ? 1 : 2;
                        p.hp -= damage;
                    }
                    p.hurtTime = 0.5;
                    p.invulnerable = 1;
                    
                    // Spawn explosion at collision center
                    const collisionX = Math.max(playerBox.x, enemyBox.x);
                    const collisionRight = Math.min(playerBox.x + playerBox.width, enemyBox.x + enemyBox.width);
                    const collisionY = Math.max(playerBox.y, enemyBox.y);
                    const collisionBottom = Math.min(playerBox.y + playerBox.height, enemyBox.y + enemyBox.height);
                    const explosionX = (collisionX + collisionRight) / 2;
                    const explosionY = (collisionY + collisionBottom) / 2;
                    spawnExplosion(explosionX, explosionY);
                }
                // Rocks block movement - this is handled in updatePlayer
            }
        }
    });
    
    // Obstacle collisions
    game.obstacles.forEach(obstacle => {
        const obstacleBox = {
            x: obstacle.x,
            y: obstacle.y,
            width: obstacle.width,
            height: obstacle.height
        };
        
        // Check punch hitbox first
        let punchHit = false;
        if (punchHitbox && aabbIntersects(punchHitbox, obstacleBox)) {
            // Only damage if this obstacle hasn't been hit by this attack yet
            if (!p.attackHits.includes(obstacle)) {
                punchHit = true;
                p.attackHits.push(obstacle); // Mark as hit
                obstacle.hp -= GAME_CONFIG.damage.punch;
                if (obstacle.hp <= 0) {
                    obstacle.dead = true;
                    // Spawn life pickup when rock is destroyed
                    spawnLifePickup(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
                } else if (obstacle.hp <= 3) {
                    obstacle.element.classList.add('broken');
                }
            }
        }
        
        // Regular body collision (only if not already hit by punch)
        if (!punchHit && aabbIntersects(playerBox, obstacleBox)) {
            // Check if player is doing any damaging action
            const isDucking = p.state === 'duck' || p.state === 'duck_spin';
            if ((isAttacking && !isPunching) || isDucking) {
                // Only damage if this obstacle hasn't been hit by this attack yet
                if (!p.attackHits.includes(obstacle)) {
                    // Any attack or duck_spin damages obstacles
                    let damage = 0;
                    if (p.tailActive || p.state === 'duck_spin') {
                        damage = GAME_CONFIG.damage.tail;
                    } else if (p.attacking) {
                        damage = p.attackType === 'kick' ? 2 : 1;
                    }
                    
                    if (damage > 0) {
                        p.attackHits.push(obstacle); // Mark as hit
                        obstacle.hp -= damage;
                        if (obstacle.hp <= 0) {
                            obstacle.dead = true;
                            // Spawn life pickup when rock is destroyed
                            spawnLifePickup(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
                        } else if (obstacle.hp <= 3) {
                            obstacle.element.classList.add('broken');
                        }
                    }
                }
            }
        }
    });
    
    // Fire beam collisions
    const fireBeam = document.getElementById('player-fire-beam');
    if (fireBeam && fireBeam._worldX !== undefined) {
        const beamBox = {
            x: fireBeam._worldX,
            y: fireBeam._worldY,
            width: 216,
            height: 102
        };
        
        // Check fire beam vs enemies
        game.enemies.forEach(enemy => {
            if (enemy.dead) return;
            const enemyBox = {
                x: enemy.x,
                y: enemy.y,
                width: enemy.width,
                height: enemy.height
            };
            if (aabbIntersects(beamBox, enemyBox)) {
                enemy.hp -= GAME_CONFIG.damage.fire * (game.fixedDeltaMs / 1000);
                if (enemy.hp <= 0) {
                    enemy.dead = true;
                    // Spawn explosion at enemy center (not for rocks)
                    if (enemy.type !== 'rock') {
                        spawnExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
                    }
                } else if (enemy.type === 'rock' && enemy.hp <= 3) {
                    enemy.element.classList.add('broken');
                }
            }
        });
        
        // Check fire beam vs obstacles
        game.obstacles.forEach(obstacle => {
            if (obstacle.dead) return;
            const obstacleBox = {
                x: obstacle.x,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            };
            if (aabbIntersects(beamBox, obstacleBox)) {
                obstacle.hp -= GAME_CONFIG.damage.fire * (game.fixedDeltaMs / 1000);
                if (obstacle.hp <= 0) {
                    obstacle.dead = true;
                    // Spawn life pickup when rock is destroyed
                    spawnLifePickup(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2);
                } else if (obstacle.hp <= 3) {
                    obstacle.element.classList.add('broken');
                }
            }
        });
        
        // Check fire beam vs boss
        if (game.boss && !game.boss.dead) {
            const bossBox = {
                x: game.boss.x,
                y: game.boss.y,
                width: game.boss.width,
                height: game.boss.height
            };
            if (aabbIntersects(beamBox, bossBox)) {
                // Fire beam does continuous damage
                game.boss.hp -= GAME_CONFIG.damage.fire * (game.fixedDeltaMs / 1000);
                if (game.boss.hp <= 0) {
                    game.boss.dead = true;
                    game.boss.state = 'dead';
                    game.boss.vy = 300;
                    gameWin();
                }
            }
        }
    }
    
    // Projectile collisions
    game.projectiles.forEach(proj => {
        const projBox = {
            x: proj.x,
            y: proj.y,
            width: proj.width,
            height: proj.height
        };
        
        if (aabbIntersects(playerBox, projBox) && p.invulnerable <= 0) {
            const damage = proj.element.classList.contains('lightning-bolt') ? 4 : 2;
            p.hp -= damage;
            p.hurtTime = 0.5;
            p.invulnerable = 1;
            
            // Spawn explosion at projectile impact center
            const collisionX = Math.max(playerBox.x, projBox.x);
            const collisionRight = Math.min(playerBox.x + playerBox.width, projBox.x + projBox.width);
            const collisionY = Math.max(playerBox.y, projBox.y);
            const collisionBottom = Math.min(playerBox.y + playerBox.height, projBox.y + projBox.height);
            const explosionX = (collisionX + collisionRight) / 2;
            const explosionY = (collisionY + collisionBottom) / 2;
            spawnExplosion(explosionX, explosionY);
            
            proj.element.remove();
            game.projectiles = game.projectiles.filter(pr => pr !== proj);
        }
    });
    
    // Boss collision
    if (game.boss && !game.boss.dead) {
        const b = game.boss;
        
        // Boss now uses same coordinate system as player (Y = top of screen)
        const bossBox = {
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height
        };
        
        // Debug logging
        if (game.debug && game.time % 2 < 0.1) {
            console.log('Boss collision box:', {
                boss: {
                    left: Math.round(bossBox.x),
                    right: Math.round(bossBox.x + bossBox.width),
                    top: Math.round(bossBox.y),
                    bottom: Math.round(bossBox.y + bossBox.height),
                    width: Math.round(bossBox.width),
                    height: Math.round(bossBox.height)
                },
                player: {
                    left: Math.round(playerBox.x),
                    right: Math.round(playerBox.x + playerBox.width),
                    top: Math.round(playerBox.y),
                    bottom: Math.round(playerBox.y + playerBox.height),
                    width: Math.round(playerBox.width),
                    height: Math.round(playerBox.height)
                },
                overlap: aabbIntersects(playerBox, bossBox)
            });
        }
        
        // Check punch hitbox first
        let punchHitBoss = false;
        if (punchHitbox && aabbIntersects(punchHitbox, bossBox) && b.invulnerable <= 0) {
            punchHitBoss = true;
            game.boss.hp -= GAME_CONFIG.damage.punch;
            game.boss.hurtTime = 0.3;
            game.boss.invulnerable = 0.5;  // 0.5 second invulnerability
            // Spawn explosion at boss center when damaged
            spawnExplosion(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2);
        }
        
        // Regular body collision (only if not already hit by punch)
        if (!punchHitBoss && aabbIntersects(playerBox, bossBox)) {
            // Debug logging for collision
            if (game.debug) {
                console.log('*** COLLISION DETECTED ***', {
                    boss: {
                        left: Math.round(bossBox.x),
                        right: Math.round(bossBox.x + bossBox.width),
                        top: Math.round(bossBox.y),
                        bottom: Math.round(bossBox.y + bossBox.height)
                    },
                    player: {
                        left: Math.round(playerBox.x),
                        right: Math.round(playerBox.x + playerBox.width),
                        top: Math.round(playerBox.y),
                        bottom: Math.round(playerBox.y + playerBox.height)
                    },
                    state: p.state,
                    isDucking: p.state === 'duck' || p.state === 'duck_spin',
                    isAttacking,
                    isPunching,
                    invulnerable: p.invulnerable.toFixed(2)
                });
            }
            
            const isDucking = p.state === 'duck' || p.state === 'duck_spin';
            if ((isAttacking && !isPunching) || isDucking) {
                // Attack or duck_spin damages boss (only if boss not invulnerable)
                if (b.invulnerable <= 0) {
                    if (p.tailActive || p.state === 'duck_spin') {
                        game.boss.hp -= GAME_CONFIG.damage.tail;
                        game.boss.hurtTime = 0.3;
                        game.boss.invulnerable = 0.5;  // 0.5 second invulnerability
                        // Spawn explosion at boss center when damaged by tail
                        spawnExplosion(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2);
                    } else if (p.attacking) {
                        const damage = p.attackType === 'kick' ? 2 : 1;
                        game.boss.hp -= damage;
                        game.boss.hurtTime = 0.3;
                        game.boss.invulnerable = 0.5;  // 0.5 second invulnerability
                        // Spawn explosion at boss center when damaged by attack
                        spawnExplosion(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2);
                    }
                }
            } else if (p.invulnerable <= 0 && !isAttacking && !isDucking) {
                p.hp -= 1;
                p.hurtTime = 0.5;
                p.invulnerable = 1;
                p.vx = p.x < game.boss.x ? -200 : 200;
                // Spawn explosion at collision center when player hit by boss
                const overlapLeft = Math.max(playerBox.x, bossBox.x);
                const overlapRight = Math.min(playerBox.x + playerBox.width, bossBox.x + bossBox.width);
                const overlapTop = Math.max(playerBox.y, bossBox.y);
                const overlapBottom = Math.min(playerBox.y + playerBox.height, bossBox.y + bossBox.height);
                const explosionX = (overlapLeft + overlapRight) / 2;
                const explosionY = (overlapTop + overlapBottom) / 2;
                spawnExplosion(explosionX, explosionY);
            }
        }
    }
    
    // Check player death
    if (p.hp <= 0 && !game.lost) {
        gameLose();
    }
}
