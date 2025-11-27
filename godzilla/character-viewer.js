// Dragon Character Viewer - uses shared dragon-sprites.js
// Note: ANCHORS_JSON, getFrameInfo(), and applySpriteFrame() are loaded from dragon-sprites.js

// Character states
const dragon1State = {
    x: 100,
    y: 0,
    state: 'stand',
    frame: 0,
    frameTime: 0,
    facing: 'right',
    width: 142,
    height: 128,
    moving: false,
    grounded: true,
    vy: 0,
    attacking: false,
    attackType: null,
    attackTime: 0,
    fireState: null,
    fireTime: 0,
    fireBeam: null
};

const dragon2State = {
    x: window.innerWidth - 800,
    y: 200,
    state: 'fly',
    frame: 0,
    frameTime: 0,
    facing: 'left',
    width: 240,
    height: 220,
    hurtTime: 0,
    lightningBolt: null
};

const keys = {
    // Dragon 1
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    z: false,
    x: false,
    ' ': false,
    // Dragon 2
    w: false,
    a: false,
    s: false,
    d: false,
    q: false,
    e: false
};

let debugMode = false;
let lastTime = 0;

// Input handling
document.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
});

// Update Dragon 1
function updateDragon1(dt) {
    const d = dragon1State;
    const speed = 200;
    const gravity = 800;
    const jumpVel = 400;
    
    // Movement - can move while attacking or firing
    d.moving = false;
    if (keys.ArrowLeft) {
        d.x -= speed * dt;
        d.facing = 'left';
        d.moving = true;
    }
    if (keys.ArrowRight) {
        d.x += speed * dt;
        d.facing = 'right';
        d.moving = true;
    }
    
    // Gravity
    d.vy += gravity * dt;
    d.y += d.vy * dt;
    
    const groundY = window.innerHeight * 0.9;
    if (d.y >= groundY - d.height) {
        d.y = groundY - d.height;
        d.vy = 0;
        d.grounded = true;
    } else {
        d.grounded = false;
    }
    
    // Jump
    if (keys.ArrowUp && d.grounded) {
        d.vy = -jumpVel;
        d.grounded = false;
    }
    
    // Attacks
    if (!d.attacking && !d.fireState) {
        if (keys.z) {
            d.attacking = true;
            d.attackType = 'punch';
            d.attackTime = 0;
        } else if (keys.x) {
            d.attacking = true;
            d.attackType = 'kick';
            d.attackTime = 0;
        } else if (keys[' ']) {
            if (keys.ArrowDown && d.grounded) {
                // Duck tail spin would go here
            } else {
                d.fireState = 'windup';
                d.fireTime = 0;
            }
        }
    }
    
    // Update attack states
    if (d.attacking) {
        d.attackTime += dt;
        if (d.attackTime >= 0.4) {
            d.attacking = false;
            d.attackType = null;
        }
    }
    
    // Fire state
    if (d.fireState) {
        d.fireTime += dt;
        
        if (d.fireState === 'windup' && d.fireTime >= 0.5) {
            d.fireState = 'beam';
            d.fireTime = 0;
            createFireBeam();
        } else if (d.fireState === 'beam' && d.fireTime >= 1.5) {
            d.fireState = null;
            removeFireBeam();
        }
    }
    
    // State determination - prioritize actions over movement
    // Jump state removed - use current action while in air
    let newState = 'stand';
    if (d.fireState === 'windup') {
        newState = 'fire_windup';
    } else if (d.fireState === 'beam') {
        newState = 'fire_beam';
    } else if (d.attacking) {
        newState = d.attackType;
    } else if (keys.ArrowDown) {
        newState = 'duck';
    } else if (d.moving) {
        newState = 'walk';
    }
    // Note: No separate jump state - actions (punch, kick, etc) continue while airborne
    
    // Frame animation
    if (newState !== d.state) {
        d.state = newState;
        d.frame = 0;
        d.frameTime = 0;
    } else {
        d.frameTime += dt;
        if (d.frameTime >= 0.1) {
            d.frameTime = 0;
            const actorData = ANCHORS_JSON.dragon1;
            const stateData = actorData?.states[d.state];
            const frameCount = stateData?.frames?.length || 1;
            d.frame = (d.frame + 1) % frameCount;
        }
    }
}

// Update Dragon 2
function updateDragon2(dt) {
    const d = dragon2State;
    const speed = 150;
    
    // Movement
    if (keys.a) {
        d.x -= speed * dt;
        d.facing = 'left';
    }
    if (keys.d) {
        d.x += speed * dt;
        d.facing = 'right';
    }
    if (keys.w) {
        d.y -= speed * dt;
    }
    if (keys.s) {
        d.y += speed * dt;
    }
    
    // Hurt state
    if (keys.q) {
        d.hurtTime = 0.5;
    }
    
    if (d.hurtTime > 0) {
        d.hurtTime -= dt;
        d.state = 'hurt';
    } else {
        d.state = 'fly';
    }
    
    // Lightning
    if (keys.e && !d.lightningBolt) {
        createLightning();
    }
    
    // Frame animation
    d.frameTime += dt;
    if (d.frameTime >= 0.1) {
        d.frameTime = 0;
        const actorData = ANCHORS_JSON.dragon2;
        const stateData = actorData?.states[d.state];
        const frameCount = stateData?.frames?.length || 1;
        d.frame = (d.frame + 1) % frameCount;
    }
}

// Create fire beam
function createFireBeam() {
    const d = dragon1State;
    const beam = document.createElement('div');
    beam.className = 'fire-beam';
    beam.id = 'fire-beam';
    
    const beamWidth = 216;
    const beamHeight = 102;
    
    beam.style.width = beamWidth + 'px';
    beam.style.height = beamHeight + 'px';
    beam.style.backgroundImage = `url('img/dragon1.png')`;
    beam.style.backgroundSize = '1128px 670px';
    beam.style.imageRendering = 'pixelated';
    
    beam._frame = 0;
    beam._frameTime = 0;
    
    updateFireBeamPosition(beam);
    updateFireBeamFrame(beam);
    
    document.getElementById('stage').appendChild(beam);
    d.fireBeam = beam;
}

function updateFireBeamPosition(beam) {
    const beamWidth = 216;
    const beamHeight = 102;
    const groundY = window.innerHeight * 0.9;
    
    // Use shared positioning logic from dragon-sprites.js
    const position = calculateFireBeamPosition(
        dragon1State,
        beamWidth,
        beamHeight,
        0, // No camera offset in character viewer
        groundY
    );
    
    beam.style.left = position.left;
    beam.style.bottom = position.bottom;
    beam.style.transform = position.transform;
}

function updateFireBeamFrame(beam) {
    const frameOffsets = [
        { x: 468, y: 566 },
        { x: 688, y: 566 },
        { x: 468, y: 566 },
        { x: 688, y: 566 }
    ];
    
    const currentFrame = beam._frame % 4;
    const offset = frameOffsets[currentFrame];
    beam.style.backgroundPosition = `-${offset.x}px -${offset.y}px`;
}

function removeFireBeam() {
    const beam = document.getElementById('fire-beam');
    if (beam) {
        beam.remove();
        dragon1State.fireBeam = null;
    }
}

// Create lightning
function createLightning() {
    const d = dragon2State;
    const bolt = document.createElement('div');
    bolt.className = 'lightning-bolt';
    bolt.id = 'lightning-bolt';
    
    bolt.style.width = '160px';
    bolt.style.height = '48px';
    bolt.style.left = (d.x + 50) + 'px';
    bolt.style.bottom = (window.innerHeight - d.y - d.height + 50) + 'px';
    
    document.getElementById('stage').appendChild(bolt);
    d.lightningBolt = bolt;
    
    setTimeout(() => {
        if (bolt.parentNode) {
            bolt.remove();
            d.lightningBolt = null;
        }
    }, 500);
}

// Render
function render() {
    // Update Dragon 1
    const d1 = document.getElementById('dragon1');
    const frameInfo1 = applySpriteFrame(d1, 'dragon1', dragon1State.state, dragon1State.frame, dragon1State.facing);
    if (frameInfo1) {
        dragon1State.width = frameInfo1.width;
        dragon1State.height = frameInfo1.height;
    }
    const groundY = window.innerHeight * 0.9;
    d1.style.left = dragon1State.x + 'px';
    d1.style.bottom = (groundY - dragon1State.y - dragon1State.height) + 'px';
    
    // Update Dragon 2
    const d2 = document.getElementById('dragon2');
    const frameInfo2 = applySpriteFrame(d2, 'dragon2', dragon2State.state, dragon2State.frame, dragon2State.facing);
    if (frameInfo2) {
        dragon2State.width = frameInfo2.width;
        dragon2State.height = frameInfo2.height;
    }
    d2.style.left = dragon2State.x + 'px';
    d2.style.bottom = (groundY - dragon2State.y - dragon2State.height) + 'px';
    
    // Update fire beam
    if (dragon1State.fireBeam) {
        dragon1State.fireBeam._frameTime += 0.016;
        if (dragon1State.fireBeam._frameTime >= 0.1) {
            dragon1State.fireBeam._frameTime = 0;
            dragon1State.fireBeam._frame = (dragon1State.fireBeam._frame + 1) % 4;
            updateFireBeamFrame(dragon1State.fireBeam);
        }
        updateFireBeamPosition(dragon1State.fireBeam);
    }
    
    // Update status displays
    document.getElementById('d1-state').textContent = dragon1State.state;
    document.getElementById('d1-frame').textContent = dragon1State.frame;
    document.getElementById('d1-facing').textContent = dragon1State.facing;
    document.getElementById('d1-size').textContent = `${dragon1State.width}x${dragon1State.height}`;
    document.getElementById('d1-attack').textContent = dragon1State.attackType || 'none';
    
    document.getElementById('d2-state').textContent = dragon2State.state;
    document.getElementById('d2-frame').textContent = dragon2State.frame;
    document.getElementById('d2-facing').textContent = dragon2State.facing;
    document.getElementById('d2-size').textContent = `${dragon2State.width}x${dragon2State.height}`;
}

// Game loop
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;
    
    if (dt > 0) {
        updateDragon1(dt);
        updateDragon2(dt);
        render();
    }
    
    requestAnimationFrame(gameLoop);
}

// Utility functions
function toggleDebug() {
    debugMode = !debugMode;
    document.getElementById('debug-info').style.display = debugMode ? 'block' : 'none';
}

function resetPositions() {
    dragon1State.x = 100;
    dragon1State.y = 0;
    dragon1State.state = 'stand';
    dragon1State.frame = 0;
    dragon1State.facing = 'right';
    
    dragon2State.x = window.innerWidth - 400;
    dragon2State.y = 200;
    dragon2State.state = 'fly';
    dragon2State.frame = 0;
    dragon2State.facing = 'left';
    
    removeFireBeam();
    const lightning = document.getElementById('lightning-bolt');
    if (lightning) lightning.remove();
}

// Initialize
lastTime = performance.now();
requestAnimationFrame(gameLoop);

console.log('Character test initialized');
