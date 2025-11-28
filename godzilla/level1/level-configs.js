// Level 1 Specific Configuration
const LEVEL_CONFIG = {
    levelNumber: 1,
    // *** TESTING MODE *** 
    // Set to true to spawn boss immediately without enemies/obstacles
    // Set to false to use normal spawn schedule
    TESTING_BOSS: false,
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
    }
};

// Merge with base config
const GAME_CONFIG = mergeGameConfigs(BASE_GAME_CONFIG, LEVEL_CONFIG);
