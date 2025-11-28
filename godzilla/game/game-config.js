// Base Configuration for all levels
const BASE_GAME_CONFIG = {
    // *** TESTING MODE *** 
    // Set to true to spawn boss immediately without enemies/obstacles
    // Set to false to use normal spawn schedule
    TESTING_BOSS: false,
    
    level: { 
        gateX: 15500, 
        groundBandPct: 0.10 
    },
    speed: { 
        min: 110, 
        base: 130, 
        max: 150, 
        ramp: { 
            enabled: true, 
            early: 0, 
            mid: 10, 
            late: 20 
        } 
    },
    physics: { 
        targetApexFactor: 0.75, 
        timeToApexMs: 450, 
        coyoteMs: 120, 
        jumpBufferMs: 120, 
        terminalVy: 1400 
    },
    animation: {
        frameDuration: .1  // Duration per frame in seconds (0.1 = 10 FPS, 0.05 = 20 FPS, etc.)
    },
    fire: { 
        windupMs: 500, 
        activeMs: 1500, 
        cooldownMs: 7000, 
        tickMs: 300, 
        beamSize: { w: 216, h: 102 }, 
        mouthOffset: { fromTop: 55, fromRight: 20 }, 
        scale: 1 
    },
    tail: { 
        risePx: 70, 
        scale: 1, 
        activeMs: 600  // 6 frames × 100ms per frame
    },
    hp: { 
        player: 50, 
        boss: 50, 
        bird: 1, 
        tank: 2, 
        rock: 6,
        'bubble-craft': 1,
        turret: 5
    },
    damage: { 
        punch: 1, 
        kick: 2, 
        tail: 3, 
        fire: 5, 
        birdContact: 1, 
        tankBullet: 2, 
        bubbleCraftContact: 5,
        turretLaser: 2,
        bossBody: 1, 
        bossLightning: 4,
        mechagodzillaLaser: 3,
        mechagodzillaBullet: 2,
        giganAttack: 10,
        giganEyeBeam: 2
    },
    camera: { 
        lookAheadPx: 80 
    }
};

/**
 * Deep merges two configuration objects.
 * Arrays are replaced, not merged.
 * Objects are merged recursively.
 */
function mergeGameConfigs(base, specific) {
    const result = {};
    
    // Copy base properties
    for (const key in base) {
        if (base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
            result[key] = mergeGameConfigs(base[key], {});
        } else {
            result[key] = base[key];
        }
    }

    // Merge specific properties
    for (const key in specific) {
        if (specific[key] && typeof specific[key] === 'object' && !Array.isArray(specific[key])) {
            if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
                result[key] = mergeGameConfigs(result[key], specific[key]);
            } else {
                result[key] = mergeGameConfigs({}, specific[key]);
            }
        } else {
            result[key] = specific[key];
        }
    }
    
    return result;
}
