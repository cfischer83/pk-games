// Dragon Sprite System - Shared sprite sheet data and utilities
// Used by both the game and character test environments

// Anchors JSON - Sprite sheet configuration
const ANCHORS_JSON = {
    "scale": 1,
    "dragon1": {
        "spriteSheet": { "w": 1128, "h": 670, "src": "dragon1.png" },
        "baseFrameSize": { "w": 142, "h": 128 },
        "fire": {
            "beamSize": { "w": 216, "h": 102 },
            "tickMs": 300
        },
        "tail": { "risePx": 70 },
        "states": {
            "stand": {
                "frameSize": { "w": 142, "h": 128 },
                "frames": [
                    { "spriteOffset": { "x": 9, "y": 1 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } }
                ]
            },
            "walk": {
                "frameSize": { "w": 142, "h": 128 },
                "frames": [
                    { "spriteOffset": { "x": 9, "y": 1 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 164, "y": 1 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 324, "y": 1 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 480, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 8, "y": 153 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 158, "y": 153 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 314, "y": 153 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 468, "y": 153 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } }
                ]
            },
            "punch": {
                "frameSize": { "w": 142, "h": 156 },
                "frames": [
                    { "spriteOffset": { "x": 643, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 755, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 874, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 986, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } }
                ]
            },
            "punch_upper": {
                "frameSize": { "w": 108, "h": 64 },
                "frames": [
                    { "spriteOffset": { "x": 644, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 756, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 875, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 987, "y": 0 }, "mouth": { "fromTop": 24, "fromRight": 0 } }
                ]
            },
            "punch_lower": {
                "frameSize": { "w": 142, "h": 64 },
                "frames": [
                    { "spriteOffset": { "x": 643, "y": 64 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 755, "y": 64 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 874, "y": 64 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 986, "y": 64 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } }
                ]
            },
            "kick": {
                "frameSize": { "w": 155, "h": 128 },
                "frames": [
                    { "spriteOffset": { "x": 631, "y": 87 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 789, "y": 87 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 631, "y": 87 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } }
                ]
            },
            "duck": {
                "frameSize": { "w": 176, "h": 96 },
                "frames": [
                    { "frameSize": { "w": 146, "h": 96 }, "spriteOffset": { "x": 14, "y": 296 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 }, "duckOffset": -4 },
                    { "frameSize": { "w": 80, "h": 96 }, "spriteOffset": { "x": 172, "y": 296 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 }, "duckOffset": 46 },
                    { "frameSize": { "w": 80, "h": 96 }, "spriteOffset": { "x": 264, "y": 296 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 }, "duckOffset": 72 },
                    { "frameSize": { "w": 176, "h": 96 }, "spriteOffset": { "x": 350, "y": 296 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 }, "duckOffset": 60 },
                    { "frameSize": { "w": 80, "h": 96 }, "spriteOffset": { "x": 264, "y": 296 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 }, "duckOffset": 72 },
                    { "frameSize": { "w": 80, "h": 96 }, "spriteOffset": { "x": 172, "y": 296 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 }, "duckOffset": 46 },
                ]
            },
            "hurt": {
                "frameSize": { "w": 142, "h": 128 },
                "frames": [
                    { "spriteOffset": { "x": 0, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 148, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } },
                    { "spriteOffset": { "x": 284, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 }, "tail": { "fromBottom": 0, "fromCenterX": 0 } }
                ]
            },
            "fire_windup": {
                "frameSize": { "w": 130, "h": 128 },
                "frames": [
                    { "spriteOffset": { "x": 589, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 731, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 871, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 1003, "y": 417 }, "mouth": { "fromTop": 24, "fromRight": 0 } }
                ]
            },
            "fire_beam": {
                "frameSize": { "w": 154, "h": 128 },
                "frames": [
                    { "spriteOffset": { "x": 5, "y": 543 }, "mouth": { "fromTop": 24, "fromRight": 0 } },
                    { "spriteOffset": { "x": 165, "y": 543 }, "mouth": { "fromTop": 24, "fromRight": 0 } }
                ]
            }
        }
    },
    "dragon2": {
        "spriteSheet": { "w": 758, "h": 1336, "src": "dragon2.png" },
        "baseFrameSize": { "w": 240, "h": 220 },
        "lightning": {
            "boltSize": { "w": 160, "h": 48 },
            "mouth": { "fromTop": 32, "fromRight": 8 },
            "cooldownMs": 3000
        },
        "states": {
            "fly": {
                "frameSize": { "w": 240, "h": 218 },
                "frames": [
                    { "spriteOffset": { "x": 4, "y": 6 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 252, "y": 6 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 6 }, "mouth": { "fromTop": 34, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 236 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 252, "y": 236 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 236 }, "mouth": { "fromTop": 34, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 464 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 252, "y": 464 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 464 }, "mouth": { "fromTop": 34, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 682 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 252, "y": 682 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 682 }, "mouth": { "fromTop": 34, "fromRight": 8 } },

                    { "spriteOffset": { "x": 252, "y": 682 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 682 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 464 }, "mouth": { "fromTop": 34, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 464 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 236 }, "mouth": { "fromTop": 34, "fromRight": 8 } },
                    { "spriteOffset": { "x": 252, "y": 236 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 236 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 502, "y": 6 }, "mouth": { "fromTop": 34, "fromRight": 8 } },
                    { "spriteOffset": { "x": 252, "y": 6 }, "mouth": { "fromTop": 32, "fromRight": 8 } },
                    { "spriteOffset": { "x": 4, "y": 6 }, "mouth": { "fromTop": 32, "fromRight": 8 } },

                ]
            },
            "hurt": {
                "frameSize": { "w": 240, "h": 220 },
                "frames": [
                    { "spriteOffset": { "x": 0, "y": 880 }, "mouth": { "fromTop": 32, "fromRight": 8 } }
                ]
            },
            "dead": {
                "frameSize": { "w": 240, "h": 220 },
                "frames": [
                    { "spriteOffset": { "x": 240, "y": 880 }, "mouth": { "fromTop": 32, "fromRight": 8 } }
                ]
            }
        }
    }
};

/**
 * Get frame information for a specific actor, state, and frame index
 * @param {string} actor - 'dragon1' or 'dragon2'
 * @param {string} state - Animation state name
 * @param {number} frameIndex - Frame number
 * @returns {Object|null} Frame info with width, height, spriteOffset, mouth, tail
 */
function getFrameInfo(actor, state, frameIndex) {
    const actorData = ANCHORS_JSON[actor];
    if (!actorData || !actorData.states[state]) return null;
    
    const stateData = actorData.states[state];
    const frames = stateData.frames || [];
    const frameIdx = Math.min(frameIndex, frames.length - 1);
    const frame = frames[frameIdx] || frames[frames.length - 1] || {};
    
    // Determine frame size
    let frameSize = frame.frameSize || stateData.frameSize || actorData.baseFrameSize;
    
    return {
        width: frameSize.w * ANCHORS_JSON.scale,
        height: frameSize.h * ANCHORS_JSON.scale,
        spriteOffset: frame.spriteOffset || { x: 0, y: 0 },
        mouth: frame.mouth || (frames[0] && frames[0].mouth),
        tail: frame.tail || (frames[0] && frames[0].tail),
        duckOffset: frame.duckOffset || 0
    };
}

/**
 * Apply sprite sheet positioning to an element
 * @param {HTMLElement} element - DOM element to apply sprite to
 * @param {string} actor - 'dragon1' or 'dragon2'
 * @param {string} state - Animation state name
 * @param {number} frameIndex - Frame number
 * @param {string} facing - 'left' or 'right'
 * @returns {Object|null} Frame info that was applied
 */
function applySpriteFrame(element, actor, state, frameIndex, facing = 'right') {
    const frameInfo = getFrameInfo(actor, state, frameIndex);
    if (!frameInfo) return null;
    
    const actorData = ANCHORS_JSON[actor];
    const scale = ANCHORS_JSON.scale;
    
    // Set element size
    element.style.width = frameInfo.width + 'px';
    element.style.height = frameInfo.height + 'px';
    
    // Set background image
    element.style.backgroundImage = `url('${actorData.spriteSheet.src}')`;
    
    // Calculate background size (scale the entire sprite sheet)
    const bgWidth = actorData.spriteSheet.w * scale;
    const bgHeight = actorData.spriteSheet.h * scale;
    element.style.backgroundSize = `${bgWidth}px ${bgHeight}px`;
    
    // Calculate background position
    const offsetX = frameInfo.spriteOffset.x * scale;
    const offsetY = frameInfo.spriteOffset.y * scale;
    element.style.backgroundPosition = `-${offsetX}px -${offsetY}px`;
    
    // Handle flipping
    // Dragon1 sprite faces right by default, Dragon2 sprite faces left by default
    let flipTransform;
    if (actor === 'dragon2') {
        // Dragon2 sprite is naturally left-facing, so flip for right
        flipTransform = facing === 'right' ? 'scaleX(-1)' : 'scaleX(1)';
    } else {
        // Dragon1 sprite is naturally right-facing, so flip for left
        flipTransform = facing === 'left' ? 'scaleX(-1)' : 'scaleX(1)';
    }
    element.style.transform = flipTransform;
    
    // Set pixelated rendering
    element.style.imageRendering = 'pixelated';
    
    return frameInfo;
}

/**
 * Get the number of frames for a given actor and state
 * @param {string} actor - 'dragon1' or 'dragon2'
 * @param {string} state - Animation state name
 * @returns {number} Number of frames
 */
function getFrameCount(actor, state) {
    const actorData = ANCHORS_JSON[actor];
    if (!actorData || !actorData.states[state]) return 1;
    
    const stateData = actorData.states[state];
    return stateData.frames?.length || 1;
}

/**
 * Get all available states for an actor
 * @param {string} actor - 'dragon1' or 'dragon2'
 * @returns {string[]} Array of state names
 */
function getAvailableStates(actor) {
    const actorData = ANCHORS_JSON[actor];
    if (!actorData) return [];
    
    return Object.keys(actorData.states);
}

/**
 * Calculate fire beam position based on dragon's mouth position
 * @param {Object} dragonState - Dragon state object with x, y, width, height, facing, state, frame
 * @param {number} beamWidth - Width of the fire beam
 * @param {number} beamHeight - Height of the fire beam
 * @param {number} cameraX - Camera X position (0 for character viewer)
 * @param {number} groundY - Ground Y position (window.innerHeight * 0.9 for game)
 * @param {number} windowHeight - Full window height
 * @returns {Object} Object with left, bottom, transform properties for CSS
 */
function calculateFireBeamPosition(dragonState, beamWidth, beamHeight, cameraX = 0, groundY = 0, windowHeight = 0) {
    const scale = ANCHORS_JSON.scale;
    const frameInfo = getFrameInfo('dragon1', dragonState.state, dragonState.frame);
    
    // Use sprite mouth data and configuration offsets
    const mouthOffsetFromTop = 60; // Configurable offset from dragon's Y position
    const mouthOffsetFromRight = 0; // Configurable horizontal offset
    
    const mouthY = dragonState.y + mouthOffsetFromTop;
    let mouthX;
    
    // Calculate bottom position: groundHeight + (groundY - mouthY - beamHeight/2)
    const groundHeight = windowHeight * 0.1;
    const beamBottom = groundHeight + groundY - mouthY - beamHeight / 2;
    
    if (dragonState.facing === 'right') {
        // Mouth is fromRight pixels from the right edge, adjusted by sprite data
        mouthX = dragonState.x + dragonState.width + mouthOffsetFromRight;
        if (frameInfo && frameInfo.mouth) {
            mouthX -= frameInfo.mouth.fromRight * scale;
        }
        
        return {
            left: (mouthX - cameraX) + 'px',
            bottom: beamBottom + 'px',
            transform: 'scaleX(1)'
        };
    } else {
        // When facing left, mouth position is mirrored
        mouthX = dragonState.x;
        if (frameInfo && frameInfo.mouth) {
            mouthX += frameInfo.mouth.fromRight * scale;
        }
        
        return {
            left: (mouthX - beamWidth - cameraX) + 'px',
            bottom: beamBottom + 'px',
            transform: 'scaleX(-1)'
        };
    }
}
