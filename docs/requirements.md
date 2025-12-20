# Soundboard Requirements

## Overview
An easy-to-use soundboard application that displays audio files as interactive buttons with customizable metadata.

## Core Features

### Platform
- **Desktop Application** (Windows primary, cross-platform possible)
- Easy to use, simple interface

### Audio File Management
- Import MP3 files (primary format)
- Optional: WAV support if straightforward
- Files can be placed anywhere in the grid regardless of file system structure
- Drag and drop to import sounds

### Grid Layout System
- **Customizable Grid**: User-arranged buttons in grid layout
- **Breadcrumb Navigation**: Shows current folder/level at top
- **Nested Folders**: Create virtual folders in the grid (not tied to file system)
- **Back Button**: Forced "back" button in grid (user-movable) to navigate up one level
- **Flexible Organization**: Place any sound in any grid location at any level

### Grid Items
- **Sound Buttons**: Play MP3 on click
- **Folder Buttons**: Navigate to nested grid view
- **Metadata per Button**:
  - Audio file path
  - Optional image
  - Description/label
  - Grid position (row, column)
  - Hotkey binding

### Hotkey Support
- Bind keyboard shortcuts to specific grid positions
- Trigger sounds without clicking

### Playback
- Click button to play associated audio
- Audio output routing to sound mixer
- **Simultaneous playback**: Multiple buttons can play at once (audio layers/overlaps)
- **Same sound, multiple buttons**: One audio file can be assigned to multiple grid positions
- **Trigger same sound multiple times**: Press the same button rapidly to layer the sound over itself

## End Goals

### Stream Deck Integration
- Buttons accessible via Stream Deck hardware
- Trigger audio playback from physical buttons

### Audio Routing
- Output audio to a sound mixer (virtual or physical)
- Professional audio workflow integration

## Technical Considerations

### Technology Stack
**Desktop Application** - Choose one:
1. **Electron** (JavaScript/TypeScript + HTML/CSS)
   - Easy web tech stack
   - Good audio libraries available
   - Stream Deck SDK available
   
2. **Tauri** (Rust backend + Web frontend)
   - Lighter weight than Electron
   - Better performance
   
3. **Python + Qt/Tkinter**
   - Simpler for basic desktop apps
   - pygame/pydub for audio

### Audio Requirements
### Data Storage
- **Configuration File**: JSON structure storing:
  - Grid layouts (multiple levels/folders)
  - Button positions and metadata
  - Audio file references (absolute or relative paths)
  - Hotkey bindings
  - Back button position per level
- Virtual folder hierarchy (independent of file system)
- Save/load grid configurations
### Data Storage
- File-based configuration (JSON/YAML)
- Store button metadata separate from audio files
- Hot-reload when files change

## Next Steps
1. Choose technology stack
2. Design UI mockup
3. Plan data structure for button metadata
4. Research Stream Deck SDK integration
5. Test audio routing solutions
