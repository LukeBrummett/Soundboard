# Roadmap

Planned features and enhancements for future releases.

## High Priority

### Macro Buttons (Sequenced Audio)

Play multiple audio files in sequence when triggered.

**Use Cases:**
- Comedy bits (setup → punchline → laugh track)
- Dramatic effects (build-up → climax → aftermath)
- Complex reactions (chain multiple sounds)

**Configuration:**
```json
{
  "type": "macro",
  "label": "Epic Fail",
  "sequence": [
    {"audioFile": "suspense.mp3", "delay": 0, "volume": 1.0},
    {"audioFile": "crash.mp3", "delay": 500, "volume": 1.0},
    {"audioFile": "sad_trombone.mp3", "delay": 200, "volume": 0.8}
  ],
  "interruptible": true
}
```

**Features:**
- Configurable delays between clips
- Per-clip volume control
- Loop options
- Interrupt/restart behavior

### Volume Controls

Enhanced audio level management.

**Planned:**
- Master volume (global)
- Per-button volume
- Per-grid volume
- Auto-ducking (lower volume when other sounds play)
- Volume fade in/out

### Audio Effects

Real-time audio processing.

**Planned:**
- Reverb, echo, delay
- Pitch shift
- Distortion, filters
- Per-button effect chains
- Effect presets

## Medium Priority

### Profiles & Scenes

Save and switch between different configurations.

**Features:**
- Save/load complete grid configurations
- Quick switch between profiles (gaming, streaming, recording)
- Profile-specific settings
- Import/export profiles

### Search & Filtering

Find sounds quickly.

**Features:**
- Quick search by name
- Filter by tags/categories
- Recently used sounds
- Favorites/bookmarks

### Recording & Logging

Track button usage.

**Features:**
- Record button press history
- Playback session logs
- Export session recordings
- Usage statistics

## Low Priority

### Themes & Customization

Visual customization options.

**Features:**
- Dark/light mode
- Custom color schemes
- Button size/shape options
- Grid styling
- Animation effects

### Advanced Audio Routing

More flexible output options.

**Features:**
- Multi-output routing (send to multiple devices)
- Per-button output selection
- Audio mixing controls
- Virtual mixer interface

### Mobile Companion App

Control soundboard from mobile devices.

**Features:**
- Remote trigger buttons
- Grid preview on mobile
- WebSocket or HTTP API
- iOS and Android support

## Future Considerations

### Integration APIs

Connect to external services.

**Potential Integrations:**
- OBS Studio (scene switching, source control)
- Discord bot (trigger sounds via chat)
- Twitch (chat commands)
- HTTP REST API for external control

### Cloud Sync

Sync configurations across devices.

**Features:**
- Cloud backup of configurations
- Sync between multiple computers
- Shared sound libraries
- Community presets

### Advanced Button Types

New button functionality.

**Ideas:**
- Timer buttons (countdown before playing)
- Random selection (play random sound from set)
- Conditional logic (if/then behavior)
- Variable triggers (different sounds based on context)

### Accessibility

Improve usability for all users.

**Features:**
- Screen reader support
- High contrast mode
- Keyboard navigation improvements
- Customizable UI scaling

## Contributing Ideas

Have a feature idea? Open an issue on GitHub with the `enhancement` label. Please include:
- Clear description of the feature
- Use case/problem it solves
- How you envision it working
- Any relevant mockups or examples

## Priority Criteria

Features are prioritized based on:
1. **User impact**: How many users benefit?
2. **Complexity**: Implementation effort required
3. **Dependencies**: Requires other features first?
4. **Maintenance**: Long-term support burden

## Timeline

No specific timeline commitments. Features will be implemented as time and resources allow. Contributions are welcome to accelerate development.

---

*Roadmap subject to change based on user feedback and technical constraints.*
