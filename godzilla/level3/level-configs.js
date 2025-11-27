// Level 2 Specific Configuration
const LEVEL_CONFIG = {
    // *** TESTING MODE *** 
    // Set to true to spawn boss immediately without enemies/obstacles
    // Set to false to use normal spawn schedule
    TESTING_BOSS: false,
    spawn: { 
        maxEnemies: 10,
        maxObstacles: 0,  // Allow more obstacles (rocks) than enemies
        minSpacingRule: 'dragonWidth',
        schedule: [
            { start: 0, end: 20, enemies: ['turret'], intervals: [1000, 4000], max: 2 },
            { start: 20, end: 40, enemies: ['turret', 'tank', 'bubble-craft'], intervals: [4000, 4000, 6500], max: 5 },
            { start: 40, end: 60, enemies: ['turret', 'bird', 'tank', 'bubble-craft'], intervals: [4500, 7500, 6000, 2000], max: 7 }
        ],
        obstacleSchedule: [
            // empty
        ]
    }
};

// Merge with base config
const GAME_CONFIG = mergeGameConfigs(BASE_GAME_CONFIG, LEVEL_CONFIG);
