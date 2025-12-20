# Soundboard

A flexible, customizable desktop soundboard application with Stream Deck integration and virtual grid navigation.

## Features

### 🎵 Audio Playback
- Play MP3 and WAV audio files with a single click
- Low-latency audio output for live streaming and gaming
- Route audio to virtual audio devices (VB-Cable, VoiceMeeter, etc.)
- Simultaneous playback - trigger multiple sounds at once
- Layer sounds by pressing the same button rapidly
- Assign one sound to multiple grid positions

### 🎛️ Customizable Grid System
- Organize sounds in a flexible grid layout
- Each grid can have its own size (e.g., 4x4, 3x5, 6x4)
- Virtual folder structure independent of file system
- Non-hierarchical navigation - create shortcuts between any grids

### ⌨️ Hotkey Support
- Set default hotkeys for all grid positions globally
- Override hotkeys per grid for specific positions
- Assign multiple hotkeys to a single button
- Conflict-free hotkey resolution

### 🎮 Stream Deck Integration
- Visual frames showing Stream Deck coverage on grids
- Support for multiple Stream Decks simultaneously
- Drag frames to different positions per grid
- Real-time hardware synchronization
- Configurable Stream Deck sizes (2x3, 3x5, 4x8, etc.)

### 📁 Flexible Organization
- Create virtual folders that organize sounds your way
- Place the same sound in multiple grids
- Drag and drop audio files to import
- Button metadata: images, labels, descriptions

### 🏠 Quick Navigation
- Static "Home" button to return to main grid
- Create navigation shortcuts between any grids
- No forced hierarchy - connect grids however makes sense

## Technology Stack

- **Electron** - Desktop application framework
- **HTML/CSS/JavaScript** - UI development
- **Web Audio API / Howler.js** - Audio playback
- **Elgato Stream Deck SDK** - Hardware integration
- **electron-localshortcut** - Global hotkey support

## Project Structure

```
Soundboard/
├── docs/
│   ├── requirements.md           # Detailed requirements
│   ├── grid-structure-example.md # Grid system explanation
│   ├── stream-deck-integration.md # Stream Deck features
│   └── future-features.md        # Planned enhancements
├── src/                          # (To be created)
│   ├── main/                     # Electron main process
│   ├── renderer/                 # UI components
│   └── common/                   # Shared utilities
├── assets/                       # (To be created)
│   ├── icons/
│   └── sounds/
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Windows 10/11 (primary platform)

### Installation
```bash
# Clone the repository
git clone https://github.com/LukeBrummett/Soundboard.git
cd Soundboard

# Install dependencies
npm install

# Run the application
npm start
```

### Building
```bash
# Build for Windows
npm run build:win

# Build for all platforms
npm run build
```

## Configuration

The soundboard configuration is stored in a JSON file (`config.json`) with the following structure:

### Settings
- **homeGrid**: Default grid to show on startup
- **homeHotkey**: Keyboard shortcut to return to home grid
- **defaultAudioOutput**: Audio device for playback
- **volume**: Master volume (0.0 to 1.0)

### Default Hotkey Map
Global hotkey assignments for grid positions (e.g., `[0,0]: F1`, `[0,1]: F2`)

### Grids
Each grid contains:
- **name**: Display name
- **rows/columns**: Grid dimensions
- **hotkeyOverrides**: Position-specific hotkey mappings
- **streamDeckPositions**: Frame positions for each Stream Deck
- **buttons**: Array of button configurations

### Buttons
Each button has:
- **position**: `[row, column]`
- **type**: `sound` or `navigate`
- **label**: Display text
- **audioFile**: Path to MP3/WAV file (for sound buttons)
- **targetGrid**: Destination grid ID (for navigation buttons)
- **image**: Optional button icon
- **description**: Optional tooltip text

## Usage

### Basic Workflow
1. Launch the application
2. Import audio files via drag and drop
3. Arrange buttons in the grid
4. Set up hotkeys and Stream Deck positions
5. Create navigation buttons to organize into virtual folders
6. Play sounds with clicks or hotkeys

### Stream Deck Setup
1. Connect your Stream Deck hardware
2. Configure device in settings (name, size, color)
3. Position the visual frame on each grid
4. Stream Deck automatically syncs with frame contents

### Creating Virtual Folders
1. Add a navigation button to current grid
2. Create a new grid with desired layout
3. Link the button to the new grid
4. Add sounds and navigation in the new grid
5. Create shortcuts to other grids as needed

## Hotkey System

### Priority Rules
- Only one button per hotkey per grid
- If a hotkey is assigned to a specific position, default assignments are ignored
- Positions with conflicting hotkeys show as "unbound"
- Multiple hotkeys can trigger the same button
- Hotkeys only work on the currently visible grid

### Example
```
Default: [0,2] = F3
Override: [1,3] = F3

Result:
- [0,2]: Unbound (F3 taken)
- [1,3]: F3 (works)
```

## Stream Deck Features

### Visual Frames
- See which buttons appear on your Stream Deck
- Drag frames to reposition coverage area
- Different colors for multiple Stream Decks
- Per-grid positioning

### Multiple Devices
- Support for unlimited Stream Deck devices
- Independent frame positioning
- Simultaneous hardware synchronization

## Audio Routing

To route audio to OBS, Discord, or other applications:

1. Install a virtual audio cable (e.g., VB-Audio Virtual Cable, VoiceMeeter)
2. Set the soundboard output to the virtual device
3. Set your streaming/recording software to listen to the virtual device
4. Adjust volumes as needed

## Future Features

See [docs/future-features.md](docs/future-features.md) for planned enhancements:
- Macro buttons (sequenced audio playback)
- Audio effects and filters
- Profiles and scenes
- Cloud sync
- Mobile companion app
- OBS/Discord integration

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[To be determined]

## Acknowledgments

- Elgato for Stream Deck SDK
- Audio routing solutions: VB-Audio, VoiceMeeter
- Electron community

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

**Status**: 🚧 In Development

*Documentation complete. Implementation in progress.*
