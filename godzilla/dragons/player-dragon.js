// Update player
function updatePlayer(dt) {
    const p = game.player;
    
    // If dying, lock in dead state and don't process any other updates
    if (p.dying) {
        p.state = 'dead';
        p.frame = 0;
        return;
    }
    
    const speed = GAME_CONFIG.speed.base;
    
    // Update timers
    p.stateTime += dt;
    p.frameTime += dt;
    if (p.hurtTime > 0) p.hurtTime -= dt;
    if (p.invulnerable > 0) p.invulnerable -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;
    
    // Movement - can move while attacking, firing, or ducking
    p.vx = 0;
    if (game.keys.left && !game.keys.right) {
        p.vx = -speed;
        p.facing = 'left';
    }
    if (game.keys.right && !game.keys.left) {
        p.vx = speed;
        p.facing = 'right';
    }
    
    // Gravity
    p.vy += physics.gravity * dt;
    p.vy = Math.min(p.vy, GAME_CONFIG.physics.terminalVy);
    
    // Jump with coyote time and buffer
    if (p.grounded) {
        p.coyoteTime = GAME_CONFIG.physics.coyoteMs / 1000;
        p.jumping = false;
    } else if (p.coyoteTime > 0) {
        p.coyoteTime -= dt;
    }
    
    if (game.keys.up) {
        if (!p.jumpHeld) {
            p.jumpBufferTime = GAME_CONFIG.physics.jumpBufferMs / 1000;
        }
        p.jumpHeld = true;
    } else {
        p.jumpHeld = false;
        if (p.jumping && p.vy < 0) {
            p.vy *= 0.5; // Cut jump when released
        }
    }
    
    if (p.jumpBufferTime > 0) {
        p.jumpBufferTime -= dt;
        if (p.coyoteTime > 0 && !p.jumping) {
            p.vy = -physics.jumpVel;
            p.jumping = true;
            p.jumpBufferTime = 0;
        }
    }
    
    // Ducking - can now duck in the air
    const wasDucking = p.state === 'duck' || p.state === 'duck_spin';
    const isDucking = game.keys.down && !p.attacking && !p.fireState && !p.tailActive;
    
    // Attack handling
    if (!p.attacking && !p.fireState && !p.tailActive) {
        if (game.keys.z) {
            p.attacking = true;
            p.attackType = 'punch';
            p.attackFrame = 0;
            p.attackTime = 0;
            p.attackHits = []; // Clear hit tracking for new attack
        } else if (game.keys.x) {
            p.attacking = true;
            p.attackType = 'kick';
            p.attackFrame = 0;
            p.attackTime = 0;
            p.attackHits = []; // Clear hit tracking for new attack
        } else if (game.keys.spacePressed) {
            // If ducking (on ground or in air), do tail spin
            if (game.keys.down) {
                p.tailActive = true;
                p.tailTime = 0;
                p.attackHits = []; // Clear hit tracking for tail attack
				if (game.debug) {
					console.log('Tail spin started');
				}
            } 
            // If not ducking and fire is ready, blow fire
            else if (p.fireCooldown <= 0) {
                p.fireState = 'windup';
                p.fireTime = 0;
                p.fireTickTime = 0;
                p.fireDamageCount = 0;
            }
            // Clear spacePressed so it doesn't trigger again
            game.keys.spacePressed = false;
        }
    }
    
    // Update attack states
    if (p.attacking) {
        p.attackTime += dt;
        const frameDuration = GAME_CONFIG.animation.frameDuration;
        p.attackFrame = Math.floor(p.attackTime / frameDuration);
        
        if (p.attackFrame >= 4) {
            p.attacking = false;
            p.attackType = null;
        }
    }
    
    if (p.tailActive) {
        p.tailTime += dt;
        // Keep tail active as long as space is held and player is ducking
        // If space is released or player stops ducking, deactivate
        if (!game.keys.space || !game.keys.down) {
			if (game.debug) {
	            console.log(`Tail deactivated: space=${game.keys.space}, down=${game.keys.down}, frame=${p.frame}`);
			}
            p.tailActive = false;
        }
    }
    
    if (p.fireState) {
        p.fireTime += dt;
        
        if (p.fireState === 'windup') {
            if (p.fireTime >= GAME_CONFIG.fire.windupMs / 1000) {
                p.fireState = 'beam';
                p.fireTime = 0;
                createFireBeam();
            }
        } else if (p.fireState === 'beam') {
            p.fireTickTime += dt;
            
            if (p.fireTickTime >= GAME_CONFIG.fire.tickMs / 1000) {
                p.fireTickTime = 0;
                if (p.fireDamageCount < 5) {
                    applyFireDamage();
                    p.fireDamageCount++;
                }
            }
            
            if (p.fireTime >= GAME_CONFIG.fire.activeMs / 1000) {
                p.fireState = null;
                p.fireCooldown = GAME_CONFIG.fire.cooldownMs / 1000;
                removeFireBeam();
            }
        }
    }
    
    // Movement with swept AABB
    const groundY = window.innerHeight * 0.9;
    const nextX = p.x + p.vx * dt;
    const nextY = p.y + p.vy * dt;
    
    // Ground collision (use current height before frame update)
    if (nextY + p.height >= groundY) {
        p.y = groundY - p.height;
        p.vy = 0;
        p.grounded = true;
    } else {
        p.y = nextY;
        p.grounded = false;
    }
    
    // Check obstacle (rock) collisions for movement blocking
    let finalX = nextX;
    const nextPlayerBox = {
        x: nextX,
        y: p.y,
        width: p.width,
        height: p.height
    };
    
    for (let obstacle of game.obstacles) {
        const obstacleBox = {
            x: obstacle.x,
            y: obstacle.y,
            width: obstacle.width,
            height: obstacle.height
        };
        
        if (aabbIntersects(nextPlayerBox, obstacleBox)) {
            // Block movement - keep player at current position
            finalX = p.x;
            break;
        }
    }
    
    p.x = Math.max(0, finalX);
    
    // State determination - prioritize actions over movement
    // Jump state removed - use current action while in air
    let newState = 'stand';
    if (p.hurtTime > 0) {
        newState = 'hurt';
    } else if (p.fireState === 'windup') {
        newState = 'fire_windup';
    } else if (p.fireState === 'beam') {
        newState = 'fire_beam';
    } else if (p.tailActive) {
        newState = 'duck_spin';
    } else if (p.attacking) {
        newState = p.attackType;
    } else if (game.keys.down) {
        newState = 'duck';
    } else if (Math.abs(p.vx) > 0) {
        newState = 'walk';
    }
    // Note: No separate jump state - actions (punch, kick, etc) continue while airborne
    
    // Frame animation
    if (newState !== p.state) {
        p.state = newState;
        p.frame = 0;
        p.frameTime = 0;
		if (game.debug) {
        	console.log(`State changed to: ${newState}, Frame: 0`);
		}
    } else if (p.frameTime > GAME_CONFIG.animation.frameDuration) {
        p.frameTime = 0;
        
        // Get the number of frames for this state
        const actorData = ANCHORS_JSON['dragon1'];
        const stateData = actorData?.states[p.state];
        const frameCount = stateData?.frames?.length || 1;
        
        // Loop back to frame 0 after the last frame
        const oldFrame = p.frame;
        p.frame = (p.frame + 1) % frameCount;
		if (game.debug) {
        	console.log(`State: ${p.state}, Frame: ${oldFrame} → ${p.frame} (${frameCount} total frames)`);
		}
        
        // Clear attack hits when tail spin animation loops back to frame 0
        // This allows continuous damage on each loop
        if (p.frame === 0 && p.state === 'duck_spin') {
            p.attackHits = [];
            if (game.debug) {
                console.log('Tail spin looped - cleared attackHits for new damage cycle');
            }
        }
    }
    
    // Update size based on current state and frame (AFTER state is determined)
    // When punching, use the lower body dimensions (walking or stand state)
    let sizeState = p.state;
    if (p.attacking && p.attackType === 'punch') {
        sizeState = Math.abs(p.vx) > 0 ? 'walk' : 'stand';
    }
    
    const frameInfo = getFrameInfo('dragon1', sizeState, p.frame);
    if (frameInfo) {
        p.width = frameInfo.width;
        p.height = frameInfo.height; // This will be 128px (base height) when punching
    }
    
    // Update data attributes
    const dragon1El = document.getElementById('dragon1');
    dragon1El.setAttribute('data-upper', p.attacking ? p.attackType : p.state);
    dragon1El.setAttribute('data-lower', p.state);
    dragon1El.setAttribute('data-facing', p.facing);
    dragon1El.setAttribute('data-frame', p.frame);
    dragon1El.setAttribute('data-attack', p.attackType || 'none');
    dragon1El.setAttribute('data-can-fire', p.fireCooldown <= 0 ? 'true' : 'false');
}

// Create fire beam
function createFireBeam() {
    const p = game.player;
    const frameInfo = getFrameInfo('dragon1', p.state, p.frame);
    if (!frameInfo || !frameInfo.mouth) return;
    
    const scale = ANCHORS_JSON.scale;
    const actorData = ANCHORS_JSON.dragon1;
    const beam = document.createElement('div');
    beam.className = 'fire-beam projectile sprite';
    beam.id = 'player-fire-beam';
    
    const beamWidth = actorData.fire.beamSize.w * scale;
    const beamHeight = actorData.fire.beamSize.h * scale;
    
    beam.style.width = beamWidth + 'px';
    beam.style.height = beamHeight + 'px';
    
    // Apply sprite from dragon1.png
    beam.style.backgroundImage = `url('${actorData.spriteSheet.src}')`;
    const bgWidth = actorData.spriteSheet.w * scale;
    const bgHeight = actorData.spriteSheet.h * scale;
    beam.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
    beam.style.imageRendering = 'pixelated';
    
    // Initialize beam animation
    beam._frame = 0;
    beam._frameTime = 0;
    beam._totalFrames = 4; // Fire beam has 4 frames
    
    // Position based on mouth anchor using shared logic
    const groundY = window.innerHeight * 0.9;
    const position = calculateFireBeamPosition(
        p,
        beamWidth,
        beamHeight,
        game.camera.x,
        groundY,
        window.innerHeight
    );
    
    beam.style.left = position.left;
    beam.style.bottom = position.bottom;
    beam.style.transform = position.transform;
    
    beam.setAttribute('data-type', 'fire');
    beam.setAttribute('data-frame', '0');
    beam.setAttribute('data-active', 'true');
    
    document.getElementById('world').appendChild(beam);
    
    // Store the beam's world position for collision detection
    const mouthY = p.y + 55; // mouthOffsetFromTop
    let mouthX;
    if (p.facing === 'right') {
        mouthX = p.x + p.width + 20; // mouthOffsetFromRight
    } else {
        mouthX = p.x;
    }
    beam._worldX = p.facing === 'right' ? mouthX : mouthX - beamWidth;
    beam._worldY = mouthY - beamHeight/2;
    
    // Set initial frame
    updateFireBeamFrame(beam);
}

function removeFireBeam() {
    const beam = document.getElementById('player-fire-beam');
    if (beam) beam.remove();
}

function updateFireBeamFrame(beam) {
    if (!beam) return;
    
    // Fire beam sprite offsets - 4 frames at Y=566, spaced 216px apart horizontally
    const frameOffsets = [
        { x: 468, y: 566 },  // Frame 0
        { x: 688, y: 566 },  // Frame 1 (468 + 216)
        { x: 468, y: 566 },  // Frame 2 (684 + 216)
        { x: 688, y: 566 }   // Frame 3 (loop back to frame 0)
    ];
    
    const currentFrame = beam._frame % 4;
    const offset = frameOffsets[currentFrame];
    
    beam.style.backgroundPosition = `-${offset.x}px -${offset.y}px`;
    beam.setAttribute('data-frame', currentFrame);
}

function applyFireDamage() {
    const beam = document.getElementById('player-fire-beam');
    if (!beam) return;
    
    const beamRect = beam.getBoundingClientRect();
    const beamBox = {
        x: beamRect.left,
        y: beamRect.top,
        width: beamRect.width,
        height: beamRect.height
    };
    
    // Check enemies
    game.enemies.forEach(enemy => {
        const enemyRect = enemy.element.getBoundingClientRect();
        const enemyBox = {
            x: enemyRect.left,
            y: enemyRect.top,
            width: enemyRect.width,
            height: enemyRect.height
        };
        
        if (aabbIntersects(beamBox, enemyBox)) {
            enemy.hp -= 1;
            if (enemy.hp <= 0) {
                enemy.dead = true;
            } else if (enemy.type === 'rock' && enemy.hp <= 3) {
                enemy.element.classList.add('broken');
            }
        }
    });
    
    // Check boss
    if (game.boss && !game.boss.dead) {
        // Boss and player use the same Y coordinate system
        const bossBox = {
            x: game.boss.x,
            y: game.boss.y,
            width: game.boss.width,
            height: game.boss.height
        };
        
        if (aabbIntersects(beamBox, bossBox)) {
            game.boss.hp -= 1;
            game.boss.hurtTime = 0.3;
            // Spawn explosion at boss center when damaged by fire beam
            spawnExplosion(game.boss.x + game.boss.width / 2, game.boss.y + game.boss.height / 2);
        }
    }
}
