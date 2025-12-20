# Stream Deck Integration

## Overview
The soundboard displays visual frames representing physical Stream Deck devices on the grid. Users can drag these frames to select which buttons should appear on each Stream Deck.

## Core Concepts

### Stream Deck Frame
A visual overlay on the grid showing which buttons are mapped to a physical Stream Deck device.

**Example: 2x3 Stream Deck frame on a 4x4 grid**
```
┌─────────────────────────────────────────────────────┐
│ Current: Games                   [HOME BUTTON 🏠]   │
├─────────────┬─────────────┬─────────────┬──────────┤
│ ╔═══════════╦═══════════╗ │   Memes     │ Streams  │
│ ║ Minecraft ║   CSGO    ║ │ [→ Memes]   │[→Streams]│
│ ╠═══════════╬═══════════╣ ├─────────────┼──────────┤
│ ║ Valorant  ║  Victory  ║ │  Reactions  │  Clips   │
│ ╠═══════════╬═══════════╣ │[→Reactions] │[→ Clips] │
│ ║   Bruh    ║   Oof     ║ ├─────────────┼──────────┤
│ ╚═══════════╩═══════════╝ │             │          │
│   Defeat    │   GG EZ     │   (empty)   │ (empty)  │
│   [Sound]   │   [Sound]   │             │          │
└─────────────┴─────────────┴─────────────┴──────────┘

Stream Deck 1 (2x3) - Top-left position
```

### Multiple Stream Decks
Users can have multiple Stream Deck devices configured, each with its own frame.

**Example: Two Stream Decks on same grid**
```
┌─────────────────────────────────────────────────────────────────┐
│ Current: Home                    [HOME BUTTON 🏠]               │
├─────────────┬─────────────┬─────────────┬──────────┬──────────┤
│ ╔═══════════╦═══════════╗ │   Music     │ ╔════════╦════════╗ │
│ ║  Games    ║   Memes   ║ │ [→ Music]   │ ║ Alerts ║ Custom ║ │
│ ╠═══════════╬═══════════╣ ├─────────────┤ ╠════════╬════════╣ │
│ ║  Streams  ║  Clips    ║ │   Settings  │ ║ Hotkey ║ Volume ║ │
│ ╠═══════════╬═══════════╣ │ [→Settings] │ ╠════════╬════════╣ │
│ ║ Reactions ║  Effects  ║ │             │ ║ Test   ║  Mute  ║ │
│ ╚═══════════╩═══════════╝ │   (empty)   │ ╚════════╩════════╝ │
│             │             │             │          │          │
│   (empty)   │   (empty)   │   (empty)   │ (empty)  │ (empty)  │
└─────────────┴─────────────┴─────────────┴──────────┴──────────┘

Stream Deck 1 (2x3) - Left side
Stream Deck 2 (2x3) - Right side
```

## Features

### 1. Configure Stream Decks
Users define their physical Stream Deck devices:
- **Name/Label**: "Main Deck", "Side Deck", "Left Hand", etc.
- **Size**: Rows x Columns (e.g., 2x3, 3x5, 4x8)
- **Device ID**: For hardware communication
- **Color/Style**: Visual distinction between multiple decks

### 2. Draggable Frames
Each Stream Deck frame can be dragged around the grid:
- Click and drag the frame border
- Snaps to grid positions
- Can overlap different areas
- Updates which buttons are mapped

### 3. Per-Grid Positioning
Stream Deck frames maintain independent positions per grid:
- Home grid: Stream Deck 1 at [0,0], Stream Deck 2 at [2,2]
- Games grid: Stream Deck 1 at [1,0], Stream Deck 2 at [0,3]
- Memes grid: Stream Deck 1 at [0,1], Stream Deck 2 hidden/disabled

### 4. Hardware Synchronization
When a grid is visible:
- Stream Deck hardware updates to show the buttons in its frame
- Button presses on Stream Deck trigger the corresponding grid button
- Images/labels sync to Stream Deck display

### 5. Out-of-Bounds Handling
If a Stream Deck frame extends beyond the grid:
- **Wrap**: Continue from opposite side (optional)
- **Clip**: Empty buttons for positions outside grid
- **Highlight Warning**: Visual indicator that frame is out of bounds

## Configuration Examples

### Example 1: Single Stream Deck (Standard Setup)
```
Stream Deck: "Main" - 3x5 (15 buttons)
Position on Home grid: [0, 0]
Position on Games grid: [0, 0]
Position on Memes grid: [1, 1]
```

### Example 2: Dual Stream Deck (Streamer Setup)
```
Stream Deck 1: "Left Hand" - 2x3 (6 buttons)
  - Home: [0, 0]
  - Games: [0, 0]
  - Memes: [0, 0]

Stream Deck 2: "Right Hand" - 4x4 (16 buttons)
  - Home: [2, 0]
  - Games: [1, 1]
  - Memes: [0, 2]
```

### Example 3: Stream Deck XL
```
Stream Deck: "XL" - 4x8 (32 buttons)
Position on all grids: [0, 0]
Large grids designed to match XL layout
```

## UI/UX Design

### Frame Appearance
```
╔═══════════╦═══════════╗
║  Button   ║  Button   ║  <- Double-line border
╠═══════════╬═══════════╣     Thicker lines between buttons
║  Button   ║  Button   ║  <- Slightly transparent overlay
╠═══════════╬═══════════╣     Shows grid buttons underneath
║  Button   ║  Button   ║
╚═══════════╩═══════════╝

Label: "Stream Deck 1" (draggable handle)
```

### Drag Interaction
1. **Hover** over frame border → Cursor changes to move icon
2. **Click and hold** → Frame becomes highlighted
3. **Drag** → Frame follows cursor, snapping to grid positions
4. **Release** → Frame position saved for current grid
5. **Visual feedback** → Buttons within frame slightly highlighted

### Frame Management UI
**Settings Panel:**
```
Stream Decks:
┌─────────────────────────────────────┐
│ Stream Deck 1: "Main Deck"          │
│ Size: 3x5                           │
│ Color: Blue                         │
│ Status: Connected                   │
│ [Edit] [Remove] [Test]              │
├─────────────────────────────────────┤
│ Stream Deck 2: "Side Deck"          │
│ Size: 2x3                           │
│ Color: Green                        │
│ Status: Disconnected                │
│ [Edit] [Remove] [Test]              │
├─────────────────────────────────────┤
│ [+ Add Stream Deck]                 │
└─────────────────────────────────────┘

☐ Show frames on grid
☐ Auto-position frames
☐ Sync hardware automatically
```

## JSON Data Structure

```json
{
  "settings": {
    "homeGrid": "home",
    "homeHotkey": "Ctrl+H",
    "showStreamDeckFrames": true,
    "autoSyncStreamDecks": true
  },
  "streamDecks": [
    {
      "id": "deck1",
      "name": "Main Deck",
      "rows": 2,
      "columns": 3,
      "deviceId": "ABC123XYZ",
      "color": "#3B82F6",
      "enabled": true
    },
    {
      "id": "deck2",
      "name": "Side Deck",
      "rows": 3,
      "columns": 5,
      "deviceId": "DEF456UVW",
      "color": "#10B981",
      "enabled": true
    }
  ],
  "grids": {
    "home": {
      "name": "Home",
      "rows": 4,
      "columns": 4,
      "streamDeckPositions": {
        "deck1": {
          "position": [0, 0],
          "visible": true
        },
        "deck2": {
          "position": [2, 0],
          "visible": true
        }
      },
      "buttons": [
        {
          "position": [0, 0],
          "type": "navigate",
          "label": "Games",
          "targetGrid": "games"
        }
      ]
    },
    "games": {
      "name": "Games",
      "rows": 3,
      "columns": 5,
      "streamDeckPositions": {
        "deck1": {
          "position": [0, 0],
          "visible": true
        },
        "deck2": {
          "position": [0, 3],
          "visible": false
        }
      },
      "buttons": [
        {
          "position": [0, 0],
          "type": "sound",
          "label": "Victory",
          "audioFile": "C:/Sounds/victory.mp3"
        }
      ]
    }
  }
}
```

## Implementation Considerations

### Stream Deck SDK Integration
- Use official Elgato Stream Deck SDK
- Handle device connection/disconnection
- Update button images and labels
- Listen for button press events

### Rendering
- Draw frames as overlay on grid
- Semi-transparent so underlying buttons are visible
- Different colors per Stream Deck for easy identification
- Drag handles on frame borders

### Synchronization
- On grid change → Update all connected Stream Decks
- On button edit → Refresh Stream Deck display
- On frame move → Recalculate which buttons to send

### Edge Cases
- **Frame larger than grid**: Clip or show warning
- **Overlapping frames**: Allow, but highlight conflict
- **Device disconnected**: Show warning on frame
- **Button in multiple frames**: Both Stream Decks show the same button

## User Workflow

### Initial Setup
1. Connect Stream Deck hardware
2. App detects device (or user adds manually)
3. Configure name and color
4. Position frame on home grid
5. Test by pressing Stream Deck buttons

### Daily Use
1. Navigate to a grid
2. Stream Deck automatically shows buttons in its frame area
3. Press Stream Deck button → Triggers corresponding sound/navigation
4. If layout doesn't work, drag frame to better position

### Multi-Deck Workflow
1. Position "Main Deck" at top-left of each grid (primary sounds)
2. Position "Side Deck" at different area (secondary/navigation)
3. Main Deck: F1-F6 for sounds
4. Side Deck: Navigation buttons between grids

## Future Enhancements
- **Auto-arrange**: Suggest optimal Stream Deck positions
- **Templates**: Pre-configured layouts for common setups
- **Rotation**: Rotate frame 90° for vertical Stream Deck mounting
- **Button preview**: Hover over grid button to see which Stream Deck(s) it appears on
- **Multi-page**: One Stream Deck frame, multiple pages via grid navigation
- **Profile switching**: Different frame positions per profile/scene
