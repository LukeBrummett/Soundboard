# Future Features

This document tracks feature ideas and enhancements to be implemented in future releases.

---

## Macro Buttons (Sequenced Audio Playback)

### Description
A special button type that plays multiple MP3 files in sequence when triggered.

### Use Cases
- **Comedy Bits**: Play setup → punchline → laugh track
- **Dramatic Effects**: Build-up sounds → climax → aftermath
- **Sound Stories**: Multi-part audio clips that tell a story
- **Complex Reactions**: Chain multiple sounds for emphasis

### Example Scenarios

**Scenario 1: Epic Fail Sequence**
```
Button: "Epic Fail"
Sequence:
  1. suspense_build.mp3 (3 seconds)
  2. crash.mp3 (1 second)
  3. sad_trombone.mp3 (4 seconds)
```

**Scenario 2: Hype Train**
```
Button: "Hype Train"
Sequence:
  1. train_horn.mp3 (2 seconds)
  2. crowd_cheer.mp3 (3 seconds)
  3. airhorn.mp3 (2 seconds)
  4. lets_go.mp3 (1 second)
```

### Configuration Options
- **Delay between clips**: 0ms to 5000ms
- **Overlap**: Allow clips to overlap (start next before previous finishes)
- **Interrupt previous**: Stop current macro if triggered again
- **Loop**: Repeat sequence N times or infinitely
- **Volume ramping**: Fade in/out between clips

### JSON Structure
```json
{
  "position": [2, 2],
  "type": "macro",
  "label": "Epic Fail",
  "description": "Plays a dramatic fail sequence",
  "sequence": [
    {
      "audioFile": "C:/Sounds/suspense_build.mp3",
      "delay": 0,
      "volume": 1.0
    },
    {
      "audioFile": "C:/Sounds/crash.mp3",
      "delay": 500,
      "volume": 1.0
    },
    {
      "audioFile": "C:/Sounds/sad_trombone.mp3",
      "delay": 200,
      "volume": 0.8
    }
  ],
  "interruptible": true,
  "loop": false
}
```

### UI Considerations
- **Macro Editor**: Dialog to build and test sequences
- **Visual Timeline**: Show sequence playback progress
- **Preview**: Test macro before saving
- **Drag & Drop**: Add sounds to sequence by dragging from grid or file system

### Advanced Features
- **Conditional playback**: Random selection from pool of sounds
- **Variables**: Playback speed, pitch adjustment per clip
- **Branching**: Different sequences based on previous button presses
- **Chaining**: Trigger other buttons/macros after completion

---

## Other Future Features

### 1. Audio Effects
- Real-time effects (reverb, pitch shift, distortion)
- Per-button effect chains
- Effect presets

### 2. Volume Controls
- Master volume
- Per-button volume
- Per-grid volume
- Ducking (auto-lower music when sound plays)

### 3. Profiles/Scenes
- Save/load different grid configurations
- Quick switch between profiles (gaming, streaming, recording)
- Profile-specific settings

### 4. Audio Routing Advanced
- Multi-output routing (send to multiple devices)
- Per-button output selection
- Audio mixing controls

### 5. Recording & Logging
- Record button press history
- Playback history log
- Export session recordings

### 6. Cloud Sync
- Sync configuration across devices
- Shared sound libraries
- Community presets/layouts

### 7. Themes & Customization
- Dark/light mode
- Custom grid styling
- Button size/shape options
- Animation effects

### 8. Search & Filtering
- Quick search for sounds
- Filter by tags/categories
- Recently used sounds

### 9. Mobile Companion App
- Control soundboard from phone/tablet
- Remote trigger buttons
- Grid preview on mobile

### 10. Integration APIs
- OBS Studio integration
- Discord bot integration
- Twitch chat commands
- HTTP API for external control

---

*Note: Features listed are ideas for future development and not commitments. Priority and implementation timeline to be determined.*
