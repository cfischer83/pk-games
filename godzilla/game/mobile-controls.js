/**
 * Mobile Touch Controls for Godzilla Game
 * 
 * This module adds touch controls for mobile devices while leaving
 * desktop keyboard controls unchanged.
 */

(function() {
    'use strict';
    
    // Only initialize on touch-capable devices
    const isTouchDevice = ('ontouchstart' in window) || 
                          (navigator.maxTouchPoints > 0) || 
                          (navigator.msMaxTouchPoints > 0);
    
    if (!isTouchDevice) {
        return; // Exit early on desktop - no changes to desktop behavior
    }
    
    // Mark body as touch device for CSS
    document.body.classList.add('touch-device');
    
    // Track active touches for each control
    const touchState = {
        dpad: {
            up: false,
            down: false,
            left: false,
            right: false
        },
        buttons: {
            z: false,
            x: false,
            action: false
        },
        // Track which touch IDs are on which elements
        activeTouches: new Map()
    };
    
    /**
     * Initialize mobile controls after DOM is ready
     */
    function initMobileControls() {
        createMobileLayout();
        setupTouchHandlers();
        setupOrientationHandling();
    }
    
    /**
     * Create the mobile layout wrapper and touch controls
     */
    function createMobileLayout() {
        const gameContainer = document.getElementById('game-container');
        if (!gameContainer) return;
        
        // Create rotate device overlay
        const rotateOverlay = document.createElement('div');
        rotateOverlay.id = 'rotate-device-overlay';
        rotateOverlay.innerHTML = `
            <div class="rotate-icon">📱</div>
            <div class="rotate-text">
                Please rotate your device<br>
                to landscape mode
            </div>
        `;
        document.body.appendChild(rotateOverlay);
        
        // Create mobile wrapper
        const wrapper = document.createElement('div');
        wrapper.id = 'mobile-game-wrapper';
        
        // Create left controls (D-pad)
        const leftControls = document.createElement('div');
        leftControls.id = 'touch-controls-left';
        leftControls.innerHTML = `
            <div class="dpad-container" id="dpad">
                <div class="dpad-btn dpad-up" data-direction="up"></div>
                <div class="dpad-btn dpad-down" data-direction="down"></div>
                <div class="dpad-btn dpad-left" data-direction="left"></div>
                <div class="dpad-btn dpad-right" data-direction="right"></div>
                <div class="dpad-center"></div>
            </div>
        `;
        
        // Create right controls (Action buttons)
        const rightControls = document.createElement('div');
        rightControls.id = 'touch-controls-right';
        rightControls.innerHTML = `
            <div class="action-buttons">
                <div class="action-btn action-btn-z" data-button="z">Z</div>
                <div class="action-btn action-btn-x" data-button="x">X</div>
                <div class="action-btn action-btn-a" data-button="action">A</div>
            </div>
        `;
        
        // Move game container into wrapper
        gameContainer.parentNode.insertBefore(wrapper, gameContainer);
        wrapper.appendChild(leftControls);
        wrapper.appendChild(gameContainer);
        wrapper.appendChild(rightControls);
    }
    
    /**
     * Set up touch event handlers for all controls
     */
    function setupTouchHandlers() {
        const dpad = document.getElementById('dpad');
        const actionButtons = document.querySelectorAll('.action-btn');
        
        if (dpad) {
            setupDpadHandlers(dpad);
        }
        
        actionButtons.forEach(btn => {
            setupButtonHandler(btn);
        });
        
        // Prevent default touch behaviors on control areas
        const controlAreas = document.querySelectorAll('#touch-controls-left, #touch-controls-right');
        controlAreas.forEach(area => {
            area.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
            area.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
            area.addEventListener('touchend', e => e.preventDefault(), { passive: false });
            area.addEventListener('contextmenu', e => e.preventDefault());
        });
    }
    
    /**
     * Set up D-pad touch handlers with drag support
     */
    function setupDpadHandlers(dpad) {
        const dpadButtons = dpad.querySelectorAll('.dpad-btn');
        const dpadRect = { element: dpad };
        
        // Helper to get which d-pad directions are touched
        function getDpadDirectionsAtPoint(x, y) {
            const directions = [];
            
            dpadButtons.forEach(btn => {
                const rect = btn.getBoundingClientRect();
                // Add some padding for easier diagonal touches
                const padding = 8;
                if (x >= rect.left - padding && 
                    x <= rect.right + padding && 
                    y >= rect.top - padding && 
                    y <= rect.bottom + padding) {
                    directions.push(btn.dataset.direction);
                }
            });
            
            return directions;
        }
        
        // Update visual state of d-pad buttons
        function updateDpadVisuals() {
            dpadButtons.forEach(btn => {
                const dir = btn.dataset.direction;
                btn.classList.toggle('active', touchState.dpad[dir]);
            });
        }
        
        // Update game.keys based on touch state
        function syncDpadToGameKeys() {
            if (typeof game !== 'undefined' && game.keys) {
                game.keys.up = touchState.dpad.up;
                game.keys.down = touchState.dpad.down;
                game.keys.left = touchState.dpad.left;
                game.keys.right = touchState.dpad.right;
            }
        }
        
        // Handle touch start on d-pad
        dpad.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            for (const touch of e.changedTouches) {
                const directions = getDpadDirectionsAtPoint(touch.clientX, touch.clientY);
                
                // Store which directions this touch is activating
                touchState.activeTouches.set(touch.identifier, {
                    type: 'dpad',
                    directions: directions
                });
                
                // Activate directions
                directions.forEach(dir => {
                    touchState.dpad[dir] = true;
                });
            }
            
            updateDpadVisuals();
            syncDpadToGameKeys();
        }, { passive: false });
        
        // Handle touch move (drag between directions)
        dpad.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            for (const touch of e.changedTouches) {
                const touchData = touchState.activeTouches.get(touch.identifier);
                if (!touchData || touchData.type !== 'dpad') continue;
                
                // Get new directions at current position
                const newDirections = getDpadDirectionsAtPoint(touch.clientX, touch.clientY);
                const oldDirections = touchData.directions;
                
                // Deactivate old directions not in new set
                oldDirections.forEach(dir => {
                    if (!newDirections.includes(dir)) {
                        // Check if another touch is still holding this direction
                        let stillHeld = false;
                        touchState.activeTouches.forEach((data, id) => {
                            if (id !== touch.identifier && 
                                data.type === 'dpad' && 
                                data.directions.includes(dir)) {
                                stillHeld = true;
                            }
                        });
                        if (!stillHeld) {
                            touchState.dpad[dir] = false;
                        }
                    }
                });
                
                // Activate new directions
                newDirections.forEach(dir => {
                    touchState.dpad[dir] = true;
                });
                
                // Update stored directions for this touch
                touchData.directions = newDirections;
            }
            
            updateDpadVisuals();
            syncDpadToGameKeys();
        }, { passive: false });
        
        // Handle touch end
        dpad.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            for (const touch of e.changedTouches) {
                const touchData = touchState.activeTouches.get(touch.identifier);
                if (!touchData || touchData.type !== 'dpad') continue;
                
                // Deactivate directions from this touch
                touchData.directions.forEach(dir => {
                    // Check if another touch is still holding this direction
                    let stillHeld = false;
                    touchState.activeTouches.forEach((data, id) => {
                        if (id !== touch.identifier && 
                            data.type === 'dpad' && 
                            data.directions.includes(dir)) {
                            stillHeld = true;
                        }
                    });
                    if (!stillHeld) {
                        touchState.dpad[dir] = false;
                    }
                });
                
                touchState.activeTouches.delete(touch.identifier);
            }
            
            updateDpadVisuals();
            syncDpadToGameKeys();
        }, { passive: false });
        
        // Handle touch cancel (e.g., incoming call)
        dpad.addEventListener('touchcancel', (e) => {
            // Release all d-pad directions for cancelled touches
            for (const touch of e.changedTouches) {
                const touchData = touchState.activeTouches.get(touch.identifier);
                if (touchData && touchData.type === 'dpad') {
                    touchData.directions.forEach(dir => {
                        let stillHeld = false;
                        touchState.activeTouches.forEach((data, id) => {
                            if (id !== touch.identifier && 
                                data.type === 'dpad' && 
                                data.directions.includes(dir)) {
                                stillHeld = true;
                            }
                        });
                        if (!stillHeld) {
                            touchState.dpad[dir] = false;
                        }
                    });
                    touchState.activeTouches.delete(touch.identifier);
                }
            }
            
            updateDpadVisuals();
            syncDpadToGameKeys();
        }, { passive: false });
    }
    
    /**
     * Set up individual action button handler
     */
    function setupButtonHandler(btn) {
        const buttonType = btn.dataset.button;
        
        // Map button type to game key
        function syncButtonToGameKeys(pressed) {
            if (typeof game === 'undefined' || !game.keys) return;
            
            switch (buttonType) {
                case 'z':
                    game.keys.z = pressed;
                    break;
                case 'x':
                    game.keys.x = pressed;
                    break;
                case 'action':
                    // Action button = Space bar
                    if (pressed && !game.keys.space) {
                        // Set spacePressed for initial press detection
                        game.keys.spacePressed = true;
                    }
                    game.keys.space = pressed;
                    if (!pressed) {
                        game.keys.spacePressed = false;
                    }
                    break;
            }
        }
        
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            
            for (const touch of e.changedTouches) {
                touchState.activeTouches.set(touch.identifier, {
                    type: 'button',
                    button: buttonType,
                    element: btn
                });
            }
            
            touchState.buttons[buttonType] = true;
            btn.classList.add('active');
            syncButtonToGameKeys(true);
        }, { passive: false });
        
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            for (const touch of e.changedTouches) {
                const touchData = touchState.activeTouches.get(touch.identifier);
                if (touchData && touchData.type === 'button' && touchData.button === buttonType) {
                    touchState.activeTouches.delete(touch.identifier);
                }
            }
            
            // Check if any other touch is still on this button
            let stillPressed = false;
            touchState.activeTouches.forEach((data) => {
                if (data.type === 'button' && data.button === buttonType) {
                    stillPressed = true;
                }
            });
            
            if (!stillPressed) {
                touchState.buttons[buttonType] = false;
                btn.classList.remove('active');
                syncButtonToGameKeys(false);
            }
        }, { passive: false });
        
        btn.addEventListener('touchcancel', (e) => {
            for (const touch of e.changedTouches) {
                const touchData = touchState.activeTouches.get(touch.identifier);
                if (touchData && touchData.type === 'button' && touchData.button === buttonType) {
                    touchState.activeTouches.delete(touch.identifier);
                }
            }
            
            let stillPressed = false;
            touchState.activeTouches.forEach((data) => {
                if (data.type === 'button' && data.button === buttonType) {
                    stillPressed = true;
                }
            });
            
            if (!stillPressed) {
                touchState.buttons[buttonType] = false;
                btn.classList.remove('active');
                syncButtonToGameKeys(false);
            }
        }, { passive: false });
        
        // Handle touch leaving the button while held
        btn.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            for (const touch of e.changedTouches) {
                const touchData = touchState.activeTouches.get(touch.identifier);
                if (!touchData || touchData.type !== 'button' || touchData.button !== buttonType) continue;
                
                const rect = btn.getBoundingClientRect();
                const isInside = touch.clientX >= rect.left && 
                                 touch.clientX <= rect.right && 
                                 touch.clientY >= rect.top && 
                                 touch.clientY <= rect.bottom;
                
                if (!isInside) {
                    // Touch moved outside button - release it
                    touchState.activeTouches.delete(touch.identifier);
                    
                    let stillPressed = false;
                    touchState.activeTouches.forEach((data) => {
                        if (data.type === 'button' && data.button === buttonType) {
                            stillPressed = true;
                        }
                    });
                    
                    if (!stillPressed) {
                        touchState.buttons[buttonType] = false;
                        btn.classList.remove('active');
                        syncButtonToGameKeys(false);
                    }
                }
            }
        }, { passive: false });
    }
    
    /**
     * Handle orientation changes
     */
    function setupOrientationHandling() {
        // Initial check
        checkOrientation();
        
        // Listen for orientation changes
        window.addEventListener('orientationchange', () => {
            // Small delay to let the browser update dimensions
            setTimeout(checkOrientation, 100);
            setTimeout(updateViewportScale, 150);
        });
        
        // Also listen for resize (some browsers don't fire orientationchange)
        window.addEventListener('resize', () => {
            checkOrientation();
            updateViewportScale();
        });
        
        // Initial scale calculation
        setTimeout(updateViewportScale, 100);
    }
    
    /**
     * Calculate and apply zoom to fit game in available space
     * 
     * The game uses window.innerWidth/innerHeight for all positioning.
     * We use CSS zoom to show more game area, keeping container at window size.
     */
    function updateViewportScale() {
        const gameContainer = document.getElementById('game-container');
        const wrapper = document.getElementById('mobile-game-wrapper');
        const viewport = document.getElementById('viewport');
        const leftControls = document.getElementById('touch-controls-left');
        const rightControls = document.getElementById('touch-controls-right');
        
        if (!gameContainer || !wrapper) return;
        
        // Get available space for the game (between the controls)
        const leftWidth = leftControls ? leftControls.offsetWidth : 0;
        const rightWidth = rightControls ? rightControls.offsetWidth : 0;
        const availableWidth = wrapper.offsetWidth - leftWidth - rightWidth;
        const availableHeight = wrapper.offsetHeight;
        
        // We want to show more game width by zooming out
        // Target: show at least 850px of game width
        const targetGameWidth = 850;
        
        // Calculate zoom based on how much width we want to show
        let zoom = 1;
        if (availableWidth < targetGameWidth) {
            zoom = availableWidth / targetGameWidth;
        }
        
        // Keep container at full window size so game JS works correctly
        // The zoom will visually shrink it
        gameContainer.style.width = window.innerWidth + 'px';
        gameContainer.style.height = window.innerHeight + 'px';
        gameContainer.style.zoom = zoom;
        gameContainer.style.position = 'relative';
        
        // After zoom, the game will be:
        // - Width: window.innerWidth * zoom (should fit in availableWidth)
        // - Height: window.innerHeight * zoom (may be less than availableHeight)
        
        // To fill the height, we need to adjust. But we can't change container height
        // without breaking game positioning. Instead, we can use a flex container
        // that centers or aligns the zoomed game.
        
        // Debug output
        if (typeof game !== 'undefined' && game.debug) {
            console.log('Zoom:', zoom, 'Window:', window.innerWidth, 'x', window.innerHeight, 'Available:', availableWidth, 'x', availableHeight);
        }

		// Now change viewport to account for aspect ratio change
		const zoomedHeightDiff = (window.innerHeight / zoom) - window.innerHeight;
		console.log("zoomedHeightDiff = " + zoomedHeightDiff);
		viewport.style.marginTop = zoomedHeightDiff + 'px';
    }

    /**
     * Check current orientation and show/hide rotate overlay
     */
    function checkOrientation() {
        const overlay = document.getElementById('rotate-device-overlay');
        const wrapper = document.getElementById('mobile-game-wrapper');
        
        if (!overlay || !wrapper) return;
        
        const isPortrait = window.innerHeight > window.innerWidth;
        
        if (isPortrait) {
            overlay.style.display = 'flex';
            wrapper.style.display = 'none';
        } else {
            overlay.style.display = 'none';
            wrapper.style.display = 'flex';
        }
    }
    
    /**
     * Reset all touch states (useful when game restarts)
     */
    function resetTouchState() {
        // Reset d-pad
        touchState.dpad.up = false;
        touchState.dpad.down = false;
        touchState.dpad.left = false;
        touchState.dpad.right = false;
        
        // Reset buttons
        touchState.buttons.z = false;
        touchState.buttons.x = false;
        touchState.buttons.action = false;
        
        // Clear active touches
        touchState.activeTouches.clear();
        
        // Update visuals
        document.querySelectorAll('.dpad-btn, .action-btn').forEach(el => {
            el.classList.remove('active');
        });
        
        // Sync to game keys
        if (typeof game !== 'undefined' && game.keys) {
            game.keys.up = false;
            game.keys.down = false;
            game.keys.left = false;
            game.keys.right = false;
            game.keys.z = false;
            game.keys.x = false;
            game.keys.space = false;
            game.keys.spacePressed = false;
        }
    }
    
    // Expose reset function globally for game to use
    window.resetMobileTouchState = resetTouchState;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initMobileControls);
    } else {
        initMobileControls();
    }
    
})();
