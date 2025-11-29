// Gigan Boss Logic
function spawnBoss() {
    const spriteInfo = ANCHORS_JSON.gigan || { baseFrameSize: { w: 130, h: 140 } };
    const width = spriteInfo.baseFrameSize.w;
    const height = spriteInfo.baseFrameSize.h;
    
    // Calculate ground position
    const groundY = window.innerHeight * 0.9;
    const y = groundY - height;

    game.boss = {
        x: game.camera.x + window.innerWidth - 200,
        y: y,
        vx: 0,
        vy: 0,
        width: width,
        height: height,
        hp: GAME_CONFIG.hp.boss,
        maxHp: GAME_CONFIG.hp.boss,
        state: 'walk',
        frame: 0,
        frameTime: 0,
        hurtTime: 0,
        hurtFrames: 0,  // For 3-frame hurt animation
        invulnerable: 0,
        dead: false,
        facing: 'left',
        pattern: 'approach',  // 'approach', 'intimidate', 'attack', 'backoff', 'jumpback'
        
        // Attack timing (3-6 seconds randomly)
        attackCooldown: 4,//3 + Math.random() * 3,
        attackTimer: 0,
        attackDamageApplied: false,
        lungeDirection: 0,  // Store lunge direction when intimidation starts
        
        // Eye beam timing (2-4 seconds randomly)
        eyeBeamCooldown: 2 + Math.random() * 2,
        eyeBeamSecondShot: false,  // Track if we need to fire second beam
        eyeBeamSecondShotTimer: 0,
        
        // Back-off
        backoffTimer: 0,
        postAttackCooldown: 0,  // Brief pause after attack before backoff can trigger
        
        // Jump back (triggered by 3 hits in 1.5 seconds)
        hitTimestamps: [],  // Track recent hit times
        jumpBackTimer: 0,
        jumpBackQueued: false,  // Queue jumpBack if hit during attack
        
        // Retreat from tail swing (if player swings for 3+ seconds)
        playerTailSwingTime: 0,  // Track how long player has been tail swinging
        wasRetreating: false,  // Track if we were retreating last frame
        
        grounded: true
    };
    
    const el = document.createElement('div');
    el.id = 'gigan';
    el.className = 'sprite';
    el.style.width = game.boss.width + 'px';
    el.style.height = game.boss.height + 'px';
    el.setAttribute('data-state', 'walk');
    el.setAttribute('data-frame', '0');
    
    document.getElementById('world').appendChild(el);
    document.getElementById('boss-health').style.display = 'block';
}

// Calculate overlap percentage between boss and player
function getOverlapPercent(b) {
    const bossLeft = b.x;
    const bossRight = b.x + b.width;
    const playerLeft = game.player.x;
    const playerRight = game.player.x + game.player.width;
    
    const overlapLeft = Math.max(bossLeft, playerLeft);
    const overlapRight = Math.min(bossRight, playerRight);
    const overlapWidth = Math.max(0, overlapRight - overlapLeft);
    
    return overlapWidth / game.player.width;
}

function updateBoss(dt) {
    if (!game.boss) return;
    
    const b = game.boss;
    
    if (!b.dead && !b.dying) {
        b.frameTime += dt;
        
        // Decrement invulnerability timer
        if (b.invulnerable > 0) {
            b.invulnerable -= dt;
        }
        
        // Hurt state handling (3 frames)
        if (b.hurtFrames > 0) {
            if (b.frameTime > GAME_CONFIG.animation.frameDuration) {
                b.frameTime = 0;
                b.frame++;
                b.hurtFrames--;
                
                if (b.hurtFrames <= 0) {
                    // Return to previous pattern
                    b.state = b.pattern === 'attack' ? 'attack' : 'walk';
                    b.frame = 0;
                }
            }
        }
        
        // Gravity and Ground Collision
        const groundY = window.innerHeight * 0.9;
        
        if (!b.grounded) {
            b.vy += 2000 * dt; // Gravity
            b.y += b.vy * dt;
        }
        
        if (b.y + b.height >= groundY) {
            b.y = groundY - b.height;
            b.vy = 0;
            b.grounded = true;
        } else {
            b.grounded = false;
        }
        
        // Face the player (except during attack lunge)
        if (b.pattern !== 'attack' && b.pattern !== 'backoff') {
            const centerX = b.x + b.width / 2;
            const playerCenterX = game.player.x + game.player.width / 2;
            if (playerCenterX > centerX + 20) {
                b.facing = 'right';
            } else if (playerCenterX < centerX - 20) {
                b.facing = 'left';
            }
        }
        
        const moveSpeed = GAME_CONFIG.speed.base - 20; // -20 as player (130)
        const playerCenterX = game.player.x + game.player.width / 2;
        const bossCenterX = b.x + b.width / 2;
        const dist = Math.abs(bossCenterX - playerCenterX);
        const twoPlayerWidths = game.player.width * 2;
        
        // Calculate overlap for back-off logic
        const overlapPct = getOverlapPercent(b);
        
        // Decrement post-attack cooldown
        if (b.postAttackCooldown > 0) {
            b.postAttackCooldown -= dt;
        }
		console.log(b.pattern);
        
        // Back-off check (not during attack, intimidation, or right after attack)
        if (b.pattern === 'approach' && overlapPct > 0.01 && b.postAttackCooldown <= 0) {
            if (overlapPct > 0.20) {
                // More than 20% overlap - quick slide/hop backwards
                b.pattern = 'backoff';
                b.state = 'walk';  // Could use a slide state if available
                b.backoffTimer = 0.3;  // Short backoff duration
                // Determine backoff direction (away from player)
                b.vx = bossCenterX < playerCenterX ? -300 : 300;
            } else if (overlapPct > 0.01 && overlapPct <= 0.12) {
                // 1-12% overlap - just stand still
                b.state = 'stand';
            }
        }
        
        // Movement & Attack Logic
        if (b.pattern === 'approach') {
            if (b.hurtFrames <= 0 && overlapPct <= 0.01) {
                b.state = 'walk';
            }
            
            // Track player tail swing duration
            const playerTailSwinging = game.player.tailActive;
            if (playerTailSwinging) {
                b.playerTailSwingTime += dt;
            } else {
                b.playerTailSwingTime = 0;
            }
            
            // If player has been tail swinging for 3+ seconds, retreat until they stop
            const shouldRetreat = playerTailSwinging && b.playerTailSwingTime >= 2;
            
            // Check if retreat just ended - trigger immediate attack
            const retreatJustEnded = b.wasRetreating && !shouldRetreat;
            b.wasRetreating = shouldRetreat;
            
            if (shouldRetreat) {
                // Walk backwards, away from player, but still face them
                b.state = 'walk';
                if (bossCenterX < playerCenterX) {
                    b.x -= moveSpeed * dt;  // Move left (away from player on right)
                } else {
                    b.x += moveSpeed * dt;  // Move right (away from player on left)
                }
            } else if (retreatJustEnded) {
                // Immediate counter-attack after retreat ends (punish tail swing spam)
                b.pattern = 'intimidate';
                b.state = 'intimidate';
                b.frame = 0;
                b.frameTime = 0;
                b.attackTimer = 0.5; // Shorter intimidation for counter-attack
                b.lungeDirection = playerCenterX > bossCenterX ? 1 : -1;
                // Don't reset cooldown - let it continue counting down
            } else {
                // Normal approach - move towards player but stop before overlapping
                const minDist = (b.width + game.player.width) / 2;  // Edge to edge
                if (dist > minDist && overlapPct <= 0.01) {
                    if (bossCenterX < playerCenterX) {
                        b.x += moveSpeed * dt;
                    } else {
                        b.x -= moveSpeed * dt;
                    }
                }
            }
            
            // Attack cooldown (can attack even while retreating)
            b.attackCooldown -= dt;
            if (b.attackCooldown <= 0) {
                // Add randomness - 50% chance to attack if cooldown ready, otherwise short delay
                if (Math.random() < 0.5 && dist < twoPlayerWidths) {
                    // Close enough and random check passed - start intimidation
                    b.pattern = 'intimidate';
                    b.state = 'intimidate';
                    b.frame = 0;
                    b.frameTime = 0;
                    b.attackTimer = 1.0; // 1 second intimidation
                    // Lock in lunge direction now
                    b.lungeDirection = playerCenterX > bossCenterX ? 1 : -1;
                } else if (dist >= twoPlayerWidths) {
                    // Not close enough, short delay before checking again
                    b.attackCooldown = 0.5 + Math.random() * 1.0;
                } else {
                    // Close enough but random check failed, try again soon
                    b.attackCooldown = 0.3 + Math.random() * 0.5;
                }
            }
            
            // Eye beam cooldown
            b.eyeBeamCooldown -= dt;
            if (b.eyeBeamCooldown <= 0 && !b.eyeBeamSecondShot) {
                shootEyeBeam(b);
                b.eyeBeamSecondShot = true;
                b.eyeBeamSecondShotTimer = 0.2;  // 0.2 seconds until second shot
            }
            
            // Second eye beam shot
            if (b.eyeBeamSecondShot) {
                b.eyeBeamSecondShotTimer -= dt;
                if (b.eyeBeamSecondShotTimer <= 0) {
                    shootEyeBeam(b);
                    b.eyeBeamSecondShot = false;
                    b.eyeBeamCooldown = 2 + Math.random() * 2; // 2-4 seconds
                }
            }
            
        } else if (b.pattern === 'backoff') {
            // Quick slide/hop backwards
            b.x += b.vx * dt;
            b.vx *= 0.9;  // Decelerate
            
            b.backoffTimer -= dt;
            if (b.backoffTimer <= 0 || Math.abs(b.vx) < 20) {
                // Immediately attack after backoff ends
                b.pattern = 'intimidate';
                b.state = 'intimidate';
                b.frame = 0;
                b.frameTime = 0;
                b.attackTimer = 0.5; // Short intimidation for counter-attack
                b.lungeDirection = playerCenterX > bossCenterX ? 1 : -1;
                b.vx = 0;
            }
            
        } else if (b.pattern === 'intimidate') {
            b.attackTimer -= dt;
            if (b.attackTimer <= 0) {
                // Start attack with guaranteed lunge (direction locked in earlier)
                b.pattern = 'attack';
                b.state = 'attack';
                b.frame = 0;
                b.frameTime = 0;
                b.attackTimer = 2.0; // 2 second attack
                b.attackDamageApplied = false;
                
                // Lunge towards player (direction was locked when intimidation started)
                b.vx = b.lungeDirection * 400; // Moderate lunge speed
            }
            
        } else if (b.pattern === 'attack') {
            // Apply lunge movement
            if (Math.abs(b.vx) > 0) {
                b.x += b.vx * dt;
                // Decelerate
                b.vx *= 0.92;
                if (Math.abs(b.vx) < 10) {
                    b.vx = 0;
                }
                
                // Stop lunge if we've reached/passed the player (prevent overshooting)
                const bossCenterX = b.x + b.width / 2;
                const playerCenterX = game.player.x + game.player.width / 2;
                const passedPlayer = (b.lungeDirection > 0 && bossCenterX >= playerCenterX) ||
                                     (b.lungeDirection < 0 && bossCenterX <= playerCenterX);
                if (passedPlayer) {
                    b.vx = 0;
                }
            }
            
            b.attackTimer -= dt;
            
            // Check attack collision - Gigan's attack takes priority
            const bossBox = { x: b.x, y: b.y, width: b.width, height: b.height };
            const playerBox = { x: game.player.x, y: game.player.y, width: game.player.width, height: game.player.height };
            
            if (aabbIntersects(bossBox, playerBox)) {
                // During attack, deal 5hp per second regardless of player state
                if (game.player.invulnerable <= 0) {
                    game.player.hp -= GAME_CONFIG.damage.giganAttack * dt;
                    game.player.hurtTime = 0.2;
                }
            }
            
            if (b.attackTimer <= 0) {
                // End attack, return to approach
                b.pattern = 'approach';
                b.state = 'walk';
                b.frame = 0;
                b.attackCooldown = 3 + Math.random() * 3; // 3-6 seconds
                b.postAttackCooldown = 0.5;  // Brief pause before backoff can trigger
                b.vx = 0;
                
                // Check if jumpBack was queued during attack
                if (b.jumpBackQueued) {
                    b.jumpBackQueued = false;
                    startJumpBack(b);
                }
            }
        } else if (b.pattern === 'jumpback') {
            // Slide backwards using intimidate sprite
            b.x += b.vx * dt;
            b.vx *= 0.92;  // Decelerate
            
            b.jumpBackTimer -= dt;
            if (b.jumpBackTimer <= 0 || Math.abs(b.vx) < 20) {
                b.pattern = 'approach';
                b.state = 'walk';
                b.frame = 0;
                b.vx = 0;
            }
        }
        
        // Keep boss on screen
        const screenLeft = game.camera.x + 50;
        const screenRight = game.camera.x + window.innerWidth - b.width - 50;
        if (b.x < screenLeft) b.x = screenLeft;
        if (b.x > screenRight) b.x = screenRight;
        
        // Animation (if not in hurt state)
        if (b.hurtFrames <= 0 && b.frameTime > GAME_CONFIG.animation.frameDuration) {
            b.frameTime = 0;
            const frameCount = getFrameCount('gigan', b.state);
            b.frame = (b.frame + 1) % frameCount;
        }
        
        // Check death
        if (b.hp <= 0 && !b.dead) {
            b.dead = true;
            b.state = 'dead';
            gameWin();
        }
    } else if (b.dying) {
        // Handle dying animation
        b.y += 10 * dt;
        
        b.explosionTimer -= dt;
        if (b.explosionTimer <= 0) {
            const randomX = b.x + Math.random() * b.width;
            const randomY = b.y + Math.random() * b.height;
            spawnExplosion(randomX, randomY);
            b.explosionTimer = 0.1 + Math.random() * 0.2;
        }
    }
    
    // Update element
    const el = document.getElementById('gigan');
    if (el) {
        applySpriteFrame(el, 'gigan', b.state, b.frame, b.facing);
        el.style.left = (b.x - game.camera.x) + 'px';
        el.style.top = b.y + 'px';
        el.setAttribute('data-state', b.state);
        el.setAttribute('data-frame', b.frame);
    }
    
    // Update health bar
    const healthPct = Math.max(0, b.hp / b.maxHp * 100);
    document.getElementById('boss-health-fill').style.width = healthPct + '%';
}

// Shoot eye beam (uses sprite from gigan.png)
function shootEyeBeam(boss) {
    const beamInfo = ANCHORS_JSON.gigan.eyeBeam;
    const beamWidth = beamInfo.w;
    const beamHeight = beamInfo.h;
    
    // Spawn from eye level (14px from top of sprite)
    let beamX;
    if (boss.facing === 'left') {
        beamX = boss.x - beamWidth;
    } else {
        beamX = boss.x + boss.width;
    }
    
    const beamY = boss.y + 14;
    
    const beam = {
        x: beamX,
        y: beamY,
        vx: boss.facing === 'left' ? -400 : 400,
        vy: 0,
        width: beamWidth,
        height: beamHeight,
        type: 'eyebeam',
        source: 'gigan',
        element: null
    };
    
    const el = document.createElement('div');
    el.className = 'eyebeam projectile sprite';
    el.setAttribute('data-type', 'eyebeam');
    el.setAttribute('data-active', 'true');
    el.style.position = 'absolute';
    el.style.width = beamWidth + 'px';
    el.style.height = beamHeight + 'px';
    
    // Use the eye beam sprite from gigan.png
    const giganSheet = ANCHORS_JSON.gigan.spriteSheet;
    el.style.backgroundImage = `url('${giganSheet.src}')`;
    el.style.backgroundPosition = `-${beamInfo.offset.x}px -${beamInfo.offset.y}px`;
    el.style.backgroundSize = `${giganSheet.w}px ${giganSheet.h}px`;
    el.style.imageRendering = 'pixelated';
    
    // Flip if facing right
    if (boss.facing === 'right') {
        el.style.transform = 'scaleX(-1)';
    }
    
    // Set initial position before appending to prevent flash at (0,0)
    const groundY = window.innerHeight * 0.9;
    const groundHeight = window.innerHeight * 0.1;
    el.style.left = (beam.x - game.camera.x) + 'px';
    el.style.bottom = (groundHeight + groundY - beam.y - beam.height) + 'px';
    
    beam.element = el;
    document.getElementById('world').appendChild(el);
    game.projectiles.push(beam);
}

// Called when Gigan takes damage (from engine-collisions.js)
function onGiganHurt() {
    const b = game.boss;
    if (!b || b.dead) return;
    
    const now = performance.now();
    
    // Track hit timestamp
    b.hitTimestamps.push(now);
    
    // Remove hits older than 1.5 seconds
    b.hitTimestamps = b.hitTimestamps.filter(t => now - t < 1500);
    
    // Check for 3 hits in 1.5 seconds - trigger jumpBack
    if (b.hitTimestamps.length >= 3) {
        b.hitTimestamps = [];  // Clear hits
        
        if (b.pattern === 'attack' || b.pattern === 'intimidate') {
            // Queue jumpBack for after attack finishes
            b.jumpBackQueued = true;
        } else if (b.pattern !== 'jumpback') {
            // Start jumpBack immediately
            startJumpBack(b);
            return;  // Skip normal hurt animation
        }
    }
    
    // Normal hurt animation (only if not attacking or approaching)
    // Gigan is aggressive - doesn't flinch during approach, only jumpBack makes him retreat
    if (b.pattern !== 'attack' && b.pattern !== 'approach' && b.pattern !== 'intimidate') {
        b.state = 'hurt';
        b.frame = 0;
        b.frameTime = 0;
        b.hurtFrames = 3;
    }
}

// Start jump back - slide backwards two player widths
function startJumpBack(b) {
    const jumpBackDistance = game.player.width * 3;
    
    // Direction is backwards from facing
    const direction = b.facing === 'left' ? 1 : -1;  // If facing left, jump back to the right
    
    b.pattern = 'jumpback';
    b.state = 'intimidate';  // Use intimidate sprite for jumpBack
    b.frame = 0;
    b.frameTime = 0;
    
    // Calculate velocity based on desired distance
    // Higher multiplier = faster initial velocity = farther slide
    b.vx = direction * jumpBackDistance * 3;
    b.jumpBackTimer = 0.5;
	shootEyeBeam(b);// always shoot on jumpback
}
