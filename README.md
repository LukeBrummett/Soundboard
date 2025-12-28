# Soundboard

A flexible, customizable desktop soundboard application with Stream Deck integration and non-hierarchical grid navigation.

## Features

- **🎵 Audio Playback**: MP3/WAV support with low-latency output and simultaneous playback
- **🎛️ Customizable Grids**: Organize sounds in flexible grid layouts with custom dimensions per grid
- **⌨️ Hotkey Support**: Global and per-grid hotkey mappings with conflict resolution
- **🎮 Stream Deck Integration**: Visual frame overlays with drag-to-position and multi-device support
- **📁 Graph-Based Navigation**: Create shortcuts between any grids - no forced hierarchy
- **🔊 Virtual Audio Routing**: Send audio to OBS, Discord, or other apps via virtual cables

## Quick Start

### Prerequisites
- Node.js 18+
- Windows 10/11 (primary platform)
- Optional: Virtual audio cable (VB-Cable, VoiceMeeter) for audio routing

### Installation
```bash
git clone https://github.com/LukeBrummett/Soundboard.git
cd Soundboard
npm install
npm start
```

### Building
```bash
npm run build:win  # Windows
npm run build      # All platforms
```

## Usage

1. **Import sounds**: Drag and drop MP3/WAV files into the grid
2. **Organize**: Create navigation buttons to link between grids
3. **Assign hotkeys**: Set global defaults or per-grid overrides
4. **Stream Deck**: Connect hardware, position visual frames on each grid
5. **Play**: Click buttons, use hotkeys, or press Stream Deck buttons

See [docs/FEATURES.md](docs/FEATURES.md) for detailed feature documentation.

## Project Structure

```
Soundboard/
├── src/
│   ├── main/         # Electron main process & Stream Deck manager
│   ├── renderer/     # UI components (grid, audio, app logic)
│   └── common/       # Shared config & utilities
├── assets/icons/     # Application icons
├── docs/             # Documentation
└── package.json
```

## Configuration

Configuration is stored in `config.json` in the user data directory. Key structure:

- **settings**: homeGrid, homeHotkey, defaultAudioOutput, volume
- **defaultHotkeyMap**: Global hotkey assignments by grid position
- **streamDecks**: Array of Stream Deck configurations
- **grids**: Object containing all grid definitions with buttons

Each grid includes:
- Dimensions (rows/columns)
- Hotkey overrides
- Stream Deck frame positions
- Button array (sound or navigate types)

## Technology Stack

- [Electron](https://www.electronjs.org/) - Desktop application framework
- [Howler.js](https://howlerjs.com/) - Audio playback
- [@elgato-stream-deck/node](https://github.com/Julusian/node-elgato-stream-deck) - Hardware integration
- [sharp](https://sharp.pixelplumbing.com/) - Image processing for Stream Deck rendering

## Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Technical overview and data flow
- [FEATURES.md](docs/FEATURES.md) - Detailed feature documentation
- [ROADMAP.md](docs/ROADMAP.md) - Planned enhancements
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details

## Acknowledgments

- Elgato Stream Deck SDK
- VB-Audio & VoiceMeeter for virtual audio routing
- Electron community

---

**Status**: 🚧 In Development
