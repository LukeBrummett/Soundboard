# Backend Overview

## Architecture

The main process handles hardware integration, file operations, and system-level tasks. Communication with the renderer process happens via IPC (Inter-Process Communication).

## Key Components

### Stream Deck Manager (`src/main/streamdeck-manager.js`)

**Purpose**: Manages physical Stream Deck hardware devices and rendering to them.

**Core Responsibilities**:
- Scans for connected Stream Deck devices on startup and periodically
- Maintains a map of device paths to device data (device instance, config, streamDeckId)
- Only interacts with devices that have been configured by the user (prevents unwanted screen takeover)
- Renders button content to Stream Decks based on frame position and grid state

**How Rendering Works**:
1. Each Stream Deck has a saved position (row/col) per grid
2. When updating, it reads the grid's button data at the frame position
3. Uses `sharp` to process images/GIFs into RGB buffers (80x80 for Mini, no alpha channel)
4. Buttons with images render the image, buttons without render SVG text, empty slots are gray
5. GIF support: extracts first frame only (`animated: false`)

**Important Details**:
- Stream Decks use the `device.MODEL` string (e.g., "mini") for identification, not product ID
- Model specs define button layout (rows/cols) and icon size per device type
- Each device needs exact RGB buffer size or it errors (e.g., 19200 bytes for 80x80)

### IPC Handlers (`src/main/main.js`)

**Key Handlers**:
- `update-streamdecks`: Triggers all configured Stream Decks to re-render their displays
- `reinitialize-streamdeck`: Called after user adds a new Stream Deck in settings
- `get-connected-streamdecks`: Returns list of physical devices with their model info
- `test-streamdeck`: Displays test pattern (alternating red/blue) on selected device
- File operations: copy/delete audio files, get user data path

### Config Management (`src/common/config.js`)

Persists to JSON file in user data directory. Tracks:
- Multiple grids with buttons
- Stream Deck configurations (id, name, model, rows, cols)
- **Per-grid** frame positions (`streamDeckPositions` object in each grid)
- Settings (volume, output device, home grid, frame visibility)

### Data Flow

**On App Launch**:
1. Main process creates Stream Deck Manager
2. Manager scans for devices and opens them
3. Only devices with matching config get initialized (clearPanel + button handlers + initial render)
4. Unrecognized devices are detected but ignored

**When Frame Moves**:
1. Renderer detects drag end, saves new position to config
2. Renderer calls `update-streamdecks` IPC
3. Main process calls `updateAllDevices()`
4. For each device: reads current grid, finds frame position, renders buttons at that position

**When Adding Stream Deck**:
1. User selects from connected unconfigured devices
2. Renderer saves config with model info (rows, cols, modelId)
3. Calls `reinitialize-streamdeck` IPC
4. Manager updates device's streamDeckId and config, then renders

## Important Concepts

**Frame Position**: Stored per-grid so a Stream Deck can show different grid regions when switching grids. Position is grid coordinates (row, col) where the frame's top-left starts.

**Device vs Config**: A physical device is identified by its device path. A config (streamDeckId) ties a device to user settings. Devices without configs are visible but inert.

**Bounds Checking**: When rendering, if frame position + Stream Deck size exceeds grid bounds, those buttons show black. Dragging enforces bounds - won't let you snap to invalid positions.

**No Auto-Config**: Devices don't auto-configure on detection. User must explicitly add them through settings to prevent surprise screen takeovers.
