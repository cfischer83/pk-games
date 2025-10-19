# Fire Beam Position Refactor

## Problem
The fire beam positioning was calculated differently in `godzilla-opus4.1.html` and `character-viewer.js`, causing the beam to be offset incorrectly in the character viewer. The game file had the correct positioning logic that accounted for:
- The dragon's mouth position using sprite data (`frameInfo.mouth.fromRight`)
- Configuration offsets (`mouthOffset.fromTop: 55`, `mouthOffset.fromRight: 20`)
- Proper facing direction handling

## Solution
Created a shared positioning function in `dragon-sprites.js` that both files now use.

### New Function: `calculateFireBeamPosition()`

```javascript
calculateFireBeamPosition(dragonState, beamWidth, beamHeight, cameraX, groundY)
```

**Parameters:**
- `dragonState` - Dragon object with x, y, width, height, facing, state, frame
- `beamWidth` - Width of fire beam (216px)
- `beamHeight` - Height of fire beam (102px)
- `cameraX` - Camera X offset (0 for character viewer, game.camera.x for game)
- `groundY` - Ground Y position (window.innerHeight * 0.9)

**Returns:**
- Object with `left`, `bottom`, `transform` CSS properties

**Logic:**
1. Gets frame info to access mouth anchor data
2. Uses configuration offsets (55px from top, 20px from right)
3. Adjusts X position based on:
   - Dragon's X and width
   - Facing direction (left/right)
   - Sprite mouth anchor point (`frameInfo.mouth.fromRight`)
4. Calculates Y position from dragon's Y + mouth offset
5. Applies camera offset for scrolling

### Files Modified

**dragon-sprites.js:**
- Added `calculateFireBeamPosition()` function
- Centralizes fire beam positioning logic
- Accounts for sprite mouth anchors and configuration offsets

**character-viewer.js:**
- Updated `updateFireBeamPosition()` to use shared function
- Passes `cameraX: 0` (no camera in viewer)
- Now matches game positioning exactly

**godzilla-opus4.1.html:**
- Updated `createFireBeam()` to use shared function
- Updated render loop fire beam update to use shared function
- Maintains collision detection world position calculation

## Benefits

✅ **Consistent positioning** - Fire beam appears in the same position relative to dragon's mouth in both game and viewer

✅ **Single source of truth** - Positioning logic only needs to be updated in one place

✅ **Sprite-aware** - Uses actual sprite anchor data (`frameInfo.mouth.fromRight`)

✅ **Configuration-driven** - Uses consistent offsets (55px, 20px) from config

✅ **Maintainable** - Easier to adjust fire beam position globally

## Technical Details

### Mouth Position Calculation

**Right-facing:**
```
mouthX = dragonX + dragonWidth + 20 - (spriteAnchor.fromRight * scale)
```

**Left-facing:**
```
mouthX = dragonX + (spriteAnchor.fromRight * scale)
```

### Ground-relative positioning
The `bottom` CSS property is calculated relative to ground level:
```
bottom = groundY - (dragonY + 55) - beamHeight/2
```

This ensures the beam stays aligned with the mouth even during jumping.
