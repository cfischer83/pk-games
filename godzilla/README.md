# Dragon Fighter - NES Style Side-Scroller

A DOM-based 2D side-scrolling game featuring dragon characters with pixel-art sprite animations.

## Files

### Game Files
- **godzilla-opus4.1.html** - Main game with side-scrolling, enemies, boss fight, and game mechanics
- **character-viewer.html** - Character testing environment to view and test all animations independently

### Shared Resources
- **dragon-sprites.js** - Shared sprite sheet system used by both game and character viewer
  - Contains `ANCHORS_JSON` with all sprite sheet data for both dragons
  - Provides `getFrameInfo()` to get frame dimensions and offsets
  - Provides `applySpriteFrame()` to apply sprite positioning to DOM elements
  - Provides `getFrameCount()` and `getAvailableStates()` utility functions

- **dragon1.png** - Player dragon sprite sheet (1128×670px)
  - States: stand, walk, punch, kick, duck, jump, hurt, fire_windup, fire_beam
  
- **dragon2.png** - Boss dragon sprite sheet (758×1336px)
  - States: fly, hurt, dead

### Styling
- **character-viewer.css** - Styles for the character viewer interface

### Documentation
- **godzilla-nes-prd.txt** - Product requirements document
- **README.md** - This file

## Architecture

The sprite system is centralized in `dragon-sprites.js` which both HTML files load. This ensures:
- Single source of truth for all sprite sheet data
- Consistent sprite rendering across different contexts
- Easy updates to sprite definitions
- Reusable utility functions

### Sprite System Usage

```javascript
// Apply a sprite frame to a DOM element
applySpriteFrame(element, 'dragon1', 'walk', 2, 'right');

// Get frame information
const frameInfo = getFrameInfo('dragon1', 'punch', 0);
// Returns: { width, height, spriteOffset: {x, y}, mouth, tail }

// Get available states for a character
const states = getAvailableStates('dragon1');
// Returns: ['stand', 'walk', 'punch', ...]
```

## How to Use

### Play the Game
Open `godzilla-opus4.1.html` in a browser.

**Controls:**
- Arrow Keys: Move/Jump/Duck
- Z: Punch
- X: Kick  
- Space: Fire Beam (or Tail Spin when ducking)
- D: Toggle debug info

### Test Characters
Open `character-viewer.html` in a browser.

**Dragon 1 Controls:**
- Arrow Keys: Move/Jump/Duck
- Z: Punch
- X: Kick
- Space: Fire Beam

**Dragon 2 Controls:**
- WASD: Move
- Q: Trigger hurt animation
- E: Lightning attack

## Development

When adding new animations or modifying sprite data:
1. Edit `dragon-sprites.js` - update `ANCHORS_JSON`
2. Changes automatically apply to both game and character viewer
3. Test in character viewer first to verify sprite positioning
4. Then test in the full game

## Sprite Sheet Format

Each frame in ANCHORS_JSON includes:
- `spriteOffset: {x, y}` - Position in the sprite sheet (pixels)
- `frameSize: {w, h}` - Optional frame size override
- `mouth: {fromTop, fromRight}` - Anchor point for projectiles
- `tail: {fromBottom, fromCenterX}` - Tail attachment point

Scale is set to 1 (sprite sheets are pre-scaled to 2x).
