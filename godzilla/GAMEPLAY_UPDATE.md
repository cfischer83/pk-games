# Gameplay Update - Movement & Actions

## Changes Made

### 1. Removed "Jump" State
The `jump` state has been completely removed from the sprite system. Now, when the player is in the air, they continue showing whatever action they were performing:
- Jumping while standing → shows `stand` sprite
- Jumping while walking → shows `walk` sprite  
- Jumping while punching → shows `punch` sprite
- Jumping while kicking → shows `kick` sprite
- Jumping while firing → shows `fire_windup` or `fire_beam` sprite

### 2. Movement During Actions
Players can now move left/right while performing any action:
- ✅ Walk while punching
- ✅ Walk while kicking
- ✅ Walk while firing beam
- ✅ Jump while punching/kicking/firing

The movement is no longer blocked when `attacking` or `fireState` is active.

### 3. Fire Beam Follows Player
The fire beam now dynamically follows the player as they move:
- Position is recalculated every frame based on current player position
- Correctly adjusts for player facing direction (left/right)
- Beam stays attached to the mouth position even while walking
- Collision detection updates with the beam's new position

## Technical Implementation

### Files Modified

**godzilla-opus4.1.html:**
- Removed movement restrictions in `updatePlayer()` - now can move during attacks/fire
- Updated state determination logic - removed `!p.grounded` check for jump state
- Enhanced fire beam rendering - recalculates position based on player x, y, facing each frame
- Added comments noting that actions continue while airborne

**character-viewer.js:**
- Same movement and state determination changes as game file
- Fire beam already had dynamic positioning via `updateFireBeamPosition()`

**dragon-sprites.js:**
- Removed `jump` state from ANCHORS_JSON
- All sprite data now focused on actions rather than movement states

## Gameplay Impact

**More Dynamic Combat:**
- Players can position themselves while attacking
- Aerial combat is more fluid (kick while jumping, etc.)
- Fire beam can track moving targets

**Better Control:**
- No animation lock during actions
- Can retreat while firing
- Jump attacks can be aimed mid-air

**Visual Continuity:**
- Sprite reflects actual action being performed
- No jarring transition to generic jump pose
- Actions feel more responsive
