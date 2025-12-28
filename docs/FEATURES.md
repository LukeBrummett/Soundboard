# Features Documentation

Comprehensive guide to all Simple Soundboard features.

## Table of Contents

- [Grid System](#grid-system)
- [Navigation](#navigation)
- [Hotkey System](#hotkey-system)
- [Stream Deck Integration](#stream-deck-integration)
- [Audio Playback](#audio-playback)
- [Button Types](#button-types)

---

## Grid System

### Overview

The soundboard organizes buttons in customizable grids. Each grid can have different dimensions and contains sound buttons, navigation buttons, or empty spaces.

### Grid Configuration

**Per-Grid Settings:**
- **Dimensions**: Rows × Columns (e.g., 4×4, 3×5, 6×8)
- **Name**: Display name shown in UI
- **Hotkey Overrides**: Position-specific hotkey mappings
- **Stream Deck Positions**: Frame locations for each connected device
- **Buttons**: Array of button configurations

### Creating Grids

Grids are created by adding navigation buttons that link to new grid IDs. When navigating to a non-existent grid, the application creates it with default settings.

### Grid Dimensions

Different grids can have different sizes:
```
Home:       4×4 (16 positions)
Games:      3×5 (15 positions)
Minecraft:  6×3 (18 positions)
```

---

## Navigation

### Graph-Based Structure

Unlike traditional hierarchical folder systems, Simple Soundboard uses a **non-hierarchical graph structure**. Any grid can link to any other grid.

**Example Navigation Graph:**
```
        Home
       / | \ \
      /  |  \ \
  Games Music Memes
   / \    ↕    ↕
  /   \   └────┘
MC  CSGO────→Clips
 ↕
 └──────────→Music
```

### Navigation Buttons

Create shortcuts between grids using navigation buttons:

```json
{
  "type": "navigate",
  "label": "→ Memes",
  "targetGrid": "memes",
  "description": "Shortcut to Memes grid"
}
```

### Home Button

A static **Home** button or hotkey returns to the designated home grid from anywhere. Set in config:

```json
{
  "settings": {
    "homeGrid": "home",
    "homeHotkey": "Ctrl+H"
  }
}
```

### Navigation Scenarios

**Scenario 1: Direct Navigation**
```
Home → Games → Memes (via shortcut, not through Home)
```

**Scenario 2: Multi-Path**
```
Start: Home → Games → Minecraft → Music
Never needed to use back/home buttons
```

---

## Hotkey System

### Default Hotkey Map

Global hotkey assignments for grid positions:

```json
{
  "defaultHotkeyMap": {
    "0,0": ["F1"],
    "0,1": ["F2"],
    "0,2": ["F3"],
    "1,0": ["F4"],
    "1,1": ["F5"],
    "1,2": ["F6"]
  }
}
```

### Per-Grid Overrides

Override specific positions on individual grids:

```json
{
  "grids": {
    "games": {
      "hotkeyOverrides": {
        "0,0": ["Ctrl+G", "F1"]
      }
    }
  }
}
```

### Priority Rules

1. **One hotkey per button per grid**: Each hotkey triggers only one button on the current grid
2. **Overrides take precedence**: Per-grid overrides supersede default mappings
3. **Conflict resolution**: If a hotkey is assigned to position A via override, position B (which has that hotkey by default) becomes unbound
4. **Multiple hotkeys per button**: A single button can respond to multiple hotkeys
5. **Grid-specific**: Hotkeys only work on the currently visible grid

### Conflict Example

```
Default Map:
  [0,2]: F3
  [1,3]: F4

Games Grid Override:
  [1,3]: F3

Result on Games Grid:
  [0,2]: Unbound (F3 taken by [1,3])
  [1,3]: F3 (override works)
```

### Multiple Hotkeys

Assign multiple triggers to the same button:

```json
{
  "hotkeyOverrides": {
    "1,0": ["F5", "V", "Numpad5"]
  }
}
```

---

## Stream Deck Integration

### Visual Frames

Stream Deck devices appear as visual frame overlays on grids, showing which buttons are mapped to hardware.

**Frame Example (2×3 Stream Deck):**
```
┌─────────────────────────────────────┐
│ Current: Games          [HOME 🏠]   │
├─────────┬─────────┬─────────┬──────┤
│ ╔═══════╦═══════╗ │ Memes   │ Clips│
│ ║ MC    ║ CSGO  ║ │ [Nav]   │ [Nav]│
│ ╠═══════╬═══════╣ ├─────────┼──────┤
│ ║ Val   ║Victory║ │ Sound   │ Sound│
│ ╠═══════╬═══════╣ ├─────────┼──────┤
│ ║ Bruh  ║ Oof   ║ │ (empty) │ ...  │
│ ╚═══════╩═══════╝ │         │      │
└─────────┴─────────┴─────────┴──────┘
```

### Configuration

**Stream Deck Setup:**
```json
{
  "streamDecks": [
    {
      "id": "deck1",
      "name": "Main Deck",
      "model": "mini",
      "rows": 2,
      "columns": 3,
      "color": "#3B82F6"
    }
  ]
}
```

### Per-Grid Positioning

Each grid stores frame positions independently:

```json
{
  "grids": {
    "home": {
      "streamDeckPositions": {
        "deck1": {"position": [0, 0], "visible": true},
        "deck2": {"position": [2, 0], "visible": true}
      }
    },
    "games": {
      "streamDeckPositions": {
        "deck1": {"position": [1, 0], "visible": true},
        "deck2": {"position": [0, 3], "visible": false}
      }
    }
  }
}
```

### Draggable Frames

**Usage:**
1. Hover over frame border → cursor changes to move icon
2. Click and drag → frame follows cursor
3. Release → position snaps to grid and saves
4. Different grids can have different frame positions

### Multiple Stream Decks

Support for unlimited devices:
- Each device has unique color-coded frame
- Independent positioning per grid
- Simultaneous hardware synchronization
- Frames can overlap (both devices show same buttons)

### Hardware Synchronization

**When grid changes:**
1. Stream Deck Manager reads current grid
2. For each configured device, finds its frame position
3. Extracts button data at that position
4. Renders images/labels to hardware
5. Registers button press handlers

**Button Rendering:**
- Buttons with images → render image (first frame if GIF)
- Text-only buttons → render SVG with label
- Empty slots → gray/black background
- Out-of-bounds → black

### Supported Models

Common Stream Deck models (extensible):
- **Mini**: 2×3 (6 buttons), 80×80px icons
- **Standard**: 3×5 (15 buttons), 72×72px icons
- **XL**: 4×8 (32 buttons), 96×96px icons

---

## Audio Playback

### Supported Formats

- **MP3** (primary)
- **WAV**
- Other formats supported by Howler.js (OGG, WEBM, AAC, etc.)

### Playback Features

**Simultaneous Playback:**
- Trigger multiple buttons at once → all sounds play simultaneously
- Audio layers/overlaps rather than interrupting

**Sound Reuse:**
- Same audio file can be assigned to multiple buttons
- On same grid or across different grids
- Each trigger creates independent playback instance

**Rapid Triggering:**
- Press same button multiple times quickly
- Creates layered effect (sound over itself)
- Useful for airhorns, impact sounds, etc.

### Audio Routing

**Virtual Audio Cables:**
1. Install virtual audio device (VB-Cable, VoiceMeeter)
2. Set soundboard output to virtual device
3. Set OBS/Discord/etc. to listen to virtual device

**Configuration:**
```json
{
  "settings": {
    "defaultAudioOutput": "VB-Audio Virtual Cable",
    "volume": 0.8
  }
}
```

---

## Button Types

### Sound Buttons

Play audio files when triggered.

**Configuration:**
```json
{
  "position": [1, 2],
  "type": "sound",
  "label": "Airhorn",
  "audioFile": "C:/Sounds/airhorn.mp3",
  "image": "icons/airhorn.png",
  "description": "Classic airhorn sound"
}
```

**Properties:**
- `position`: [row, column] in grid
- `type`: "sound"
- `label`: Display text
- `audioFile`: Absolute path to audio file
- `image` (optional): Path to button icon
- `description` (optional): Tooltip text

### Navigation Buttons

Navigate to other grids.

**Configuration:**
```json
{
  "position": [0, 0],
  "type": "navigate",
  "label": "→ Games",
  "targetGrid": "games",
  "image": "icons/games.png",
  "description": "Go to Games grid"
}
```

**Properties:**
- `position`: [row, column] in grid
- `type`: "navigate"
- `label`: Display text
- `targetGrid`: ID of destination grid
- `image` (optional): Path to button icon
- `description` (optional): Tooltip text

### Empty Positions

Positions without button definitions appear empty in the grid. Useful for spacing or organization.

---

## Usage Examples

### Example 1: Stream Deck User

You have a 3×5 Stream Deck. Set default hotkeys F1-F15 to match Stream Deck positions, then override specific positions for heavily-used grids.

### Example 2: Gaming Session

1. Launch app → Home grid visible
2. Press `F1` → Navigate to Games
3. Press `Ctrl+Shift+M` (override) → Navigate to Minecraft
4. Press `F1` (different grid context) → Play "Oof" sound
5. Click "→ Games" button → Back to Games (direct link)
6. Press `Ctrl+H` → Return to Home

### Example 3: Sound Organization

1. Download new meme sounds
2. Drag and drop into app
3. Navigate to Memes grid
4. Arrange sounds in desired layout
5. Create new "2025 Memes" grid if needed
6. Link from multiple grids for easy access

### Example 4: Layered Sound Effects

1. Assign airhorn.mp3 to positions [0,0], [0,1], [0,2]
2. Set hotkeys F1, F2, F3
3. During stream: Press F1, wait 0.2s, press F3, wait 0.1s, press F5
4. Result: Triple-layered airhorn effect (all playing simultaneously)

---

## Tips & Best Practices

### Organization

- Use descriptive grid names ("Gaming", "Stream Alerts", "Music")
- Create navigation shortcuts between frequently-used grids
- Group similar sounds together
- Leave empty spaces for visual separation

### Hotkeys

- Map frequently-used sounds to easy-to-reach keys
- Use per-grid overrides for context-specific shortcuts
- Assign multiple hotkeys to important sounds
- Test for conflicts before streaming

### Stream Deck

- Position frames to cover most-used buttons
- Use different frame positions per grid for variety
- Test hardware sync before live use
- Keep frame positions within grid bounds

### Performance

- Use compressed MP3 files for faster loading
- Avoid extremely large audio files (>10MB)
- Test simultaneous playback limits
- Clear unused sounds periodically
