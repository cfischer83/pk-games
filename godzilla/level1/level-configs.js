// Configuration
const GAME_CONFIG = {
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
        rock: 6
    },
    damage: { 
        punch: 1, 
        kick: 2, 
        tail: 3, 
        fire: 5, 
        birdContact: 1, 
        tankBullet: 2, 
        bossBody: 1, 
        bossLightning: 4 
    },
    spawn: { 
        maxEnemies: 5,
        maxObstacles: 15,  // Allow more obstacles (rocks) than enemies
        minSpacingRule: 'dragonWidth',
        schedule: [
            { start: 0, end: 20, enemies: ['bird'], intervals: [7000], max: 2 },
            { start: 20, end: 80, enemies: ['bird', 'tank'], intervals: [6000, 9500], max: 3 },
            { start: 80, end: 110, enemies: ['bird', 'tank'], intervals: [4500, 7500], max: 4 }
        ],
        obstacleSchedule: [
            { start: 0, end: 20, interval: 2000 },   // Rock every 2 seconds early game
            { start: 20, end: 80, interval: 1500 },  // More frequent mid game
            { start: 80, end: 110, interval: 1200 }  // Even more frequent late game
        ]
    },
    camera: { 
        lookAheadPx: 80 
    }
};
