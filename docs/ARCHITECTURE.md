# Architecture

Technical overview of the Simple Soundboard application architecture.

## Overview

Simple Soundboard is an Electron application with a main process handling hardware integration and file operations, and a renderer process managing the UI and audio playback. Communication occurs via IPC (Inter-Process Communication).

## Process Architecture

```
┌─────────────────────────────────────────┐
│         Main Process (Node.js)          │
│  • Stream Deck Manager                  │
│  • File Operations                      │
│  • IPC Handlers                         │
│  • Configuration Management             │
└──────────────┬──────────────────────────┘
               │ IPC
┌──────────────▼──────────────────────────┐
│      Renderer Process (Browser)         │
│  • UI Rendering (Grid, Buttons)         │
│  • Audio Playback (Howler.js)           │
│  • User Input Handling                  │
│  • Hotkey Registration                  │
└─────────────────────────────────────────┘
```

## Key Components

### Stream Deck Manager (`src/main/streamdeck-manager.js`)

Manages physical Stream Deck hardware devices and rendering.

**Responsibilities:**
- Scans for connected Stream Deck devices
- Maintains device map (device path → instance, config, streamDeckId)
- Only interacts with user-configured devices (prevents unwanted takeover)
- Renders button content based on frame position and grid state

**Rendering Process:**
1. Each Stream Deck has a saved position (row/col) per grid
2. Reads button data at frame position when updating
3. Uses `sharp` to process images/GIFs into RGB buffers (e.g., 80x80 for Mini)
4. Buttons with images render the image, text-only buttons render SVG, empty slots are gray
5. GIF support: Extracts first frame only (`animated: false`)

**Important Details:**
- Devices identified by `device.MODEL` string (e.g., "mini"), not product ID
- Model specs define button layout and icon size
- Exact RGB buffer size required per device or errors occur (e.g., 19200 bytes for 80x80)

### IPC Handlers (`src/main/main.js`)

**Key Handlers:**
- `get-config-path` - Returns path to config.json
- `get-app-path` - Returns application path
- `get-user-data-path` - Returns Electron userData directory
- `copy-audio-file` - Copies audio to userData/audio, converts MP4→MP3 via ffmpeg
- `copy-image-file` - Copies images to userData/images
- `delete-file` - Deletes files from userData directory
- `validate-audio-file` - Checks file exists, has size, and has valid MP3 header
- `update-streamdecks` - Reloads config and triggers all Stream Decks to re-render
- `reinitialize-streamdeck` - Called after adding new Stream Deck in settings
- `get-connected-streamdecks` - Returns list of physical devices with model info
- `test-streamdeck` - Displays alternating red/blue test pattern
- `focus-window` - Brings window to front
- `log-to-main` - Logs from renderer to main console

**Global Hotkeys:**
- Registered via `globalShortcut` API (not electron-localshortcut)
- `CommandOrControl+Shift+I` - Toggle DevTools
- Grid hotkeys registered via `register-hotkeys` IPC event
- Sends `hotkey-pressed` event to renderer with position

### Config Management (`src/common/config.js`)

Shared between main and renderer processes. Persists to JSON in user data directory.

**Key Methods:**
- `init()` - Gets config path via IPC (renderer) or from constructor (main), loads config
- `load()` - Reads config.json or creates default
- `save()` - Writes config.json with 2-space indentation
- `getDefaultConfig()` - Returns structure with home grid, F1-F12 hotkeys, empty streamDecks array

**Config Structure:**
- `settings` - homeGrid, homeHotkey, audioOutputDevice, volume, showStreamDeckFrames, autoSyncStreamDecks
- `defaultHotkeyMap` - Global hotkey assignments as `"row,col": ["Key"]`
- `streamDecks` - Array of `{id, name, model, modelId, rows, columns}`
- `grids` - Object of gridId → grid data

**Grid Structure:**
- `name` - Display name
- `rows`, `columns` - Dimensions
- `hotkeyOverrides` - Position-specific overrides as `"row,col": ["Key"]`
- `streamDeckPositions` - Object of streamDeckId → `{row, col, visible}`
- `buttons` - Array of button objects with `position: [row, col]`

### Renderer Components

**App (`src/renderer/app.js`):**
- Initializes ConfigManager, AudioManager, GridManager
- Sets up UI handlers (settings, lock, delete grid)
- Coordinates between components
- Shows settings dialog with volume slider and audio device selector

**GridManager (`src/renderer/grid.js`):**
- Renders button grid based on current grid state
- Handles drag-and-drop for audio files and Stream Deck frames
- Manages grid navigation and button interactions
- Listens for `hotkey-pressed` and `streamdeck-button-press` IPC events
- Repositions Stream Deck frames on window resize
- Handles context menu (copy, paste, edit, delete buttons)

**AudioManager (`src/renderer/audio.js`):**
- Howler.js-based audio playback
- Supports simultaneous playback (multiple sounds at once)
- Uses Web Audio API (`html5: false`)
- Sets audio output via `Howler.ctx.setSinkId()`
- Preloads sounds in Map, resolves paths (absolute or relative to userData)
- `getAudioOutputDevices()` - Uses navigator.mediaDevices.enumerateDevices()

## Data Flow

### On App Launch
```
1. app.whenReady() → Initialize ConfigManager with path
2. ConfigManager.init() → Load config.json from userData
3. Create BrowserWindow
4. Initialize StreamDeckManager(mainWindow, configManager)
5. StreamDeckManager.init() → Scan for devices
6. For each device:
   - Open device via @elgato-stream-deck/node
   - Match to config by modelId
   - If configured: clearPanel, register button handlers, render
   - If not configured: Detect but ignore (no takeover)
7. Start 5-second scan interval for device hotplug
```

### Renderer Initialization
```
1. app.js: Create ConfigManager instance (renderer-side)
2. ConfigManager.init() → Get path via IPC, load config
3. Create AudioManager, set volume and output device
4. Create GridManager(config, audio)
5. GridManager.init() → Navigate to homeGrid
6. GridManager renders buttons, sets up IPC listeners
```

### When Frame Moves
```
1. User drags Stream Deck frame on grid
2. GridManager detects drag end → calculates new row/col
3. Updates config.grids[gridId].streamDeckPositions[deckId]
4. Calls config.save()
5. Invokes 'update-streamdecks' IPC handler
6. Main: configManager.load() → streamDeckManager.updateAllDevices()
7. For each device: executeJavaScript to get currentGrid, render buttons at frame position
```

Stored in Electron userData directory (e.g., `%APPDATA%/SimpleSoundboard/config.json` on Windows).

```json
{
  "settings": {
    "homeGrid": "home",
    "homeHotkey": "Home",
    "audioOutputDevice": "default",
    "volume": 0.8,
    "showStreamDeckFrames": true,
    "autoSyncStreamDecks": true
  },
  "defaultHotkeyMap": {
    "0,0": ["F1"],
    "0,1": ["F2"],
    "0,2": ["F3"],
    "0,3": ["F4"],
    "1,0": ["F5"],
    "1,1": ["F6"],
    "1,2": ["F7"],
    "1,3": ["F8"],
    "2,0": ["F9"],
    "2,1": ["F10"],
    "2,2": ["F11"],
    "2,3": ["F12"]
  },
  "streamDecks": [
    {
      "id": "deck1",
      "name": "Main Deck",
      "model": "mini",
      "modelId": "streamdeck-mini",
      "rows": 2,
      "columns": 3
    }
  ],
  "grids": {
    "home": {
      "name": "Home",
      "rows": 4,
      "columns": 4,
      "hotkeyOverrides": {},
      "streamDeckPositions": {
        "deck1": {"row": 0, "col": 0, "visible": true}
      },
      "buttons": [
        {
          "position": [0, 0],
          "type": "sound",
          "label": "Airhorn",
          "audioFile": "audio/airhorn_1234567890.mp3",
          "image": "images/airhorn_1234567890.png"
        },
        {
          "position": [0, 1],
          "type": "navigate",
          "label": "→ Games",
          "targetGrid": "games"
        }
      ]
    }
  }
}
```

**Note:** Audio and image paths are relative to userData directory, using forward slashes.

## Important Concepts

### Device vs Config
- **Physical device**: Identified by device path, opened by `@elgato-stream-deck/node`
- **Config (streamDeckId)**: User-created configuration in `config.streamDecks` array
- Matching: Device matches config if `modelId` matches and no other device claimed it
- Devices without configs are detected but ignored (no interaction)

### Bounds Checking
When rendering, if `framePosition.row + sdRow >= grid.rows` or `framePosition.col + sdCol >= grid.columns`, those buttons show black (out of bounds).

### No Auto-Config
Devices don't auto-configure on detection. User must explicitly add through settings (click Add Stream Deck) to prevent surprise takeovers of hardware.

### Hotkey Resolution
- Registered via `globalShortcut` in main process
- Keys converted: `Ctrl+` → `CommandOrControl+` for cross-platform
- On press: Main sends `hotkey-pressed` IPC event with position to renderer
- Only one button per hotkey per grid
- Per-grid overrides in `hotkeyOverrides` take precedence over `defaultHotkeyMap`
- Hotkeys only work on currently visible grid (`app.grid.currentGrid`)

### Graph-Based Navigation
Grids can link to any other grid via `type: "navigate"` buttons with `targetGrid` property. Non-hierarchical graph structure, not a tree. No parent/child relationship enforced.

### File Management
- Audio files copied to `userData/audio/` with timestamp suffix
- Images copied to `userData/images/`
- MP4 files converted to MP3 via ffmpeg with libmp3lame codec
- Paths stored as relative paths with forward slashes: `"audio/file_1234567890.mp3"`
- Resolved at runtime by prepending userData path

### Animated GIF Handling
- GIFs extracted into frames using `sharp` with `{page: frameIndex}`
- Frames skipped for performance (every 2nd or 3rd frame)
- Max 20 frames to limit memory
- Animations stored in Map with interval IDs
- Stopped when device updates or disconnects
- Animations stored in Map with interval IDs
- Stopped when device updates or disconnects

## Technology Choices

- **Electron**: Cross-platform desktop framework with Node.js integration
  - Uses `globalShortcut` for hotkeys (not electron-localshortcut)
  - `nodeIntegration: true`, `contextIsolation: false` for easy IPC
- **Howler.js**: Robust audio library with format support and output routing
  - Uses Web Audio API mode (`html5: false`)
  - Output device selection via `Howler.ctx.setSinkId()`
- **@elgato-stream-deck/node**: Official Stream Deck SDK for hardware control
  - Handles device detection, button events, rendering
  - Requires exact RGB buffer sizes per model
- **sharp**: Fast image processing for Stream Deck rendering
  - Resizes images, extracts GIF frames
  - Converts SVG text to RGB buffers
  - `removeAlpha()` required (Stream Deck doesn't support alpha)
- **ffmpeg-static**: Bundled ffmpeg for MP4→MP3 conversion
  - Falls back to system ffmpeg if not available
  - Uses libmp3lame codec at 192k bitrate

## Extension Points

### Adding New Button Types
1. Add type to button schema (e.g., "macro" type)
2. Update GridManager to handle new type in button click handler
3. If needed, add IPC handlers in main process for special operations

### Supporting New Stream Deck Models
1. Add model definition to `src/common/streamdeck-models.js`
2. Include modelId, name, rows, columns, iconSize, productId
3. Test that RGB buffer size matches: `rows * columns * iconSize * iconSize * 3`
4. Verify rendering with actual hardware

### Audio Effects
Future: Add Web Audio API effect chain in `audio.js`:
- Insert nodes between source and destination
- GainNode for volume/ducking
- BiquadFilterNode for EQ
- ConvolverNode for reverb
- Apply before Howler.js output

## Security Considerations

- File paths validated before copy/delete operations
- Only user-configured Stream Decks receive display updates
- No remote code execution vectors
- User data stored locally in Electron userData directory
- No network/cloud functionality currently (no attack surface)
