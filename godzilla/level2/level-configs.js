// Level 2 Specific Configuration
const LEVEL_CONFIG = {
    // *** TESTING MODE *** 
    // Set to true to spawn boss immediately without enemies/obstacles
    // Set to false to use normal spawn schedule
    TESTING_BOSS: false,
    spawn: { 
        maxEnemies: 10,
        maxObstacles: 15,  // Allow more obstacles (rocks) than enemies
        minSpacingRule: 'dragonWidth',
        schedule: [
            { start: 0, end: 20, enemies: ['bubble-craft'], intervals: [1000, 4000], max: 2 },
            { start: 20, end: 40, enemies: ['bubble-craft', 'bird', 'tank'], intervals: [4000, 6500, 4000], max: 4 },
            { start: 40, end: 60, enemies: ['bird', 'tank', 'bubble-craft'], intervals: [4500, 7500, 2000], max: 5 }
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
