# Grid Structure Example

## Conceptual Layout

The soundboard uses a hierarchical grid system where each "level" is a grid of buttons. You can navigate between levels using folder buttons and back buttons.

## Example Configuration

### Home Grid (4x4 grid)
```
┌─────────────────────────────────────────────────────┐
│ Current: Home                    [HOME BUTTON 🏠]   │
├─────────────┬─────────────┬─────────────┬──────────┤
│   Games     │   Music     │   Memes     │ Streams  │
│ [→ Games]   │ [→ Music]   │ [→ Memes]   │[→Streams]│
├─────────────┼─────────────┼─────────────┼──────────┤
│   Alerts    │  Reactions  │   Custom    │  Clips   │
│ [→ Alerts]  │[→Reactions] │ [→ Custom]  │[→ Clips] │
├─────────────┼─────────────┼─────────────┼──────────┤
│             │             │             │          │
│   (empty)   │   (empty)   │   (empty)   │ (empty)  │
├─────────────┼─────────────┼─────────────┼──────────┤
│             │             │             │          │
│   (empty)   │   (empty)   │   (empty)   │ (empty)  │
└─────────────┴─────────────┴─────────────┴──────────┘
```

### Games Grid (5x3 grid - different size!)
```
┌─────────────────────────────────────────────────────┐
│ Current: Games                   [HOME BUTTON 🏠]   │
├─────────────┬─────────────┬─────────────┬──────────┬──────────┐
│  Minecraft  │    CSGO     │   LoL       │→ Memes   │→ Clips   │
│ [→ MC Grid] │ [→ CSGO]    │ [→ LoL]     │[shortcut]│[shortcut]│
├─────────────┼─────────────┼─────────────┼──────────┼──────────┤
│  Valorant   │   Victory   │   Defeat    │  GG EZ   │ Clutch   │
│ [→ Val]     │   [Sound]   │   [Sound]   │ [Sound]  │ [Sound]  │
├─────────────┼─────────────┼─────────────┼──────────┼──────────┤
│  Bruh.mp3   │ Ooof.mp3    │ Owned.mp3   │          │          │
│   [Sound]   │   [Sound]   │   [Sound]   │ (empty)  │ (empty)  │
└─────────────┴─────────────┴─────────────┴──────────┴──────────┘

Note: "→ Memes" button goes directly to Memes grid (not through Home)
Note: "→ Clips" button goes directly to Clips grid
```

### Minecraft Grid (3x6 grid - another different size!)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Current: Minecraft               [HOME BUTTON 🏠]                           │
├─────────────┬─────────────┬─────────────┬──────────┬──────────┬───────────┤
│    Oof      │   Hurt 1    │  Hurt 2     │  Hurt 3  │→ Games   │ → Clips   │
│   [Sound]   │   [Sound]   │   [Sound]   │ [Sound]  │[shortcut]│ [shortcut]│
├─────────────┼─────────────┼─────────────┼──────────┼──────────┼───────────┤
│  Villager   │   Door      │   Click     │  Anvil   │  Slime   │ Enderman  │
│   [Sound]   │   [Sound]   │   [Sound]   │ [Sound]  │ [Sound]  │  [Sound]  │
├─────────────┼─────────────┼─────────────┼──────────┼──────────┼───────────┤
│ Explosion   │   Eat       │  Bow        │  XP      │  Music   │           │
│   [Sound]   │   [Sound]   │   [Sound]   │ [Sound]  │ [→Music] │  (empty)  │
└─────────────┴─────────────┴─────────────┴──────────┴──────────┴───────────┘

Note: This grid links back to Games, forward to Clips, and sideways to Music folder
```

### Memes Grid (clicked "Memes" from Home - different path)
### Memes Grid (4x5 grid)
```
┌──────────────────────────────────────────────────────────────────┐
│ Current: Memes                   [HOME BUTTON 🏠]                │
├─────────────┬─────────────┬─────────────┬──────────┬───────────┤
│   Bruh      │   Airhorn   │  → Music    │→ Games   │   Sad     │
│   [Sound]   │   [Sound]   │  [shortcut] │[shortcut]│ [→ Sad]   │
├─────────────┼─────────────┼─────────────┼──────────┼───────────┤
│   WOW!      │  Trombone   │  Crickets   │  Yeet    │  Bonk     │
│   [Sound]   │   [Sound]   │   [Sound]   │ [Sound]  │  [Sound]  │
├─────────────┼─────────────┼─────────────┼──────────┼───────────┤
│  911.mp3    │ Vine boom   │  Oof        │ Classic  │  Dank     │
│   [Sound]   │   [Sound]   │   [Sound]   │ [→Classic]│ [→Dank]  │
├─────────────┼─────────────┼─────────────┼──────────┼───────────┤
│             │             │             │          │           │
│   (empty)   │   (empty)   │   (empty)   │ (empty)  │  (empty)  │
└─────────────┴─────────────┴─────────────┴──────────┴───────────┘

Note: Direct shortcuts to Music and Games grids
```
## Key Navigation Concepts

### 1. Graph Structure (Not Tree - Non-Hierarchical)
Grids can link to any other grid, creating a flexible graph structure:
```
        ┌─────────┐
        │  Home   │
        └─────────┘
         /   |   \
        /    |    \
   ┌────┐ ┌────┐ ┌─────┐
   │Games│ │Music│ │Memes│
   └────┘ └────┘ └─────┘
     /  \     ↕      ↕
    /    \    └──────┘
┌────┐  ┌────┐
│MC  │  │CSGO│───────┐
└────┘  └────┘        ↓
   ↕                ┌─────┐
   └────────────────│Clips│
                    └─────┘
```

**Examples of non-hierarchical navigation:**
- Games → Memes (direct link, no need to go through Home)
- Minecraft → Clips (shortcut to related content)
- Music ↔ Memes (bidirectional links)
- CSGO → Clips (direct access)

### 2. Same Sound, Multiple Locations
The same MP3 file (e.g., `airhorn.mp3`) could appear in:
- Home > Memes > airhorn
- Home > Streams > Hype > airhorn
- Home > Alerts > airhorn

All three buttons reference the same file on disk but exist in different parts of your virtual grid graph.

**Multiple Buttons, Same Grid:**
You can also have the same sound appear multiple times on a single grid:
```
┌─────────────┬─────────────┬─────────────┬──────────┤
│  Airhorn    │   Sound 2   │   Airhorn   │ Sound 3  │
│  [Sound]    │   [Sound]   │  [Sound]    │ [Sound]  │
└─────────────┴─────────────┴─────────────┴──────────┘
Position [0,0] and [0,2] both play airhorn.mp3
```

**Simultaneous Playback:**
If multiple buttons are triggered at the same time (via different hotkeys, Stream Deck buttons, or rapid clicks), each instance plays simultaneously. The audio layers/overlaps rather than canceling out.

### 3. Home Button (Static, Not in Grid)
- **Fixed "Home" button/hotkey** outside the grid UI
- Always returns to the designated "home" grid
- Not configurable per grid
- User responsible for ensuring all grids are reachable

### 4. Configurable Grid Size
Each grid can have different dimensions:
- Home: 4x4
- Games: 5x6
- Minecraft: 3x8
### 5. Hotkey Bindings

**Default Hotkey Map (Global):**
- Position [0,0]: `F1`
- Position [0,1]: `F2`
- Position [0,2]: `F3`
- Position [1,0]: `F4`
- Position [1,1]: `F5`
- etc...

**Grid-Specific Overrides:**
Any grid can override the default hotkey for a specific position.

Example:
- **Default [0,0]**: `F1`
- **Home [0,0]**: `F1` (uses default)
- **Games [0,0]**: `Ctrl+G` (overridden)
- **Memes [0,0]**: `F1` (uses default)

**Hotkey Priority Rules:**
1. **Only assigned hotkeys work** - If position [0,2] has default `F3`, but position [1,3] is set to `F3`, only [1,3] responds to `F3`
2. **Unbound positions** - Position [0,2] shows as unbound/no hotkey since `F3` is used elsewhere
3. **One hotkey, one button** - Each hotkey can only trigger one button per grid
4. **Multiple hotkeys per button** - A single button can have multiple hotkeys assigned to it
5. **Hotkeys are grid-specific** - `F1` on Home grid and `F1` on Games grid trigger different buttons

**Example Hotkey Conflict Resolution:**
```
Home Grid (4x4):
- Default [0,0]: F1
- Default [0,1]: F2
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
  },tion [2,1]:
- Primary: F5
    "home": {
      "name": "Home",
      "rows": 4,
      "columns": 4,
      "hotkeyOverrides": {
        "1,3": ["F3", "Ctrl+H"]
      },
      "buttons": [
Hotkeys only work on the currently visible grid.
Hotkeys work on the current visible grid level.
## JSON Data Structure Example

```json
{
  "settings": {
    "homeGrid": "home",
    "homeHotkey": "Ctrl+H",
    "defaultAudioOutput": "VB-Audio Virtual Cable",
    "volume": 0.8
  },
  "defaultHotkeyMap": {
    "0,0": "F1",
    "0,1": "F2",
    "0,2": "F3",
    "0,3": "F4",
    "1,0": "F5",
    "1,1": "F6",
    "1,2": "F7",
    "1,3": "F8",
    "2,0": "F9",
    "2,1": "F10",
    "2,2": "F11",
    "2,3": "F12"
  },
  "grids": {
    "home": {
      "name": "Home",
      "rows": 4,
      "columns": 4,
      "hotkeyOverrides": {},
      "buttons": [
        {
          "position": [0, 0],
          "type": "navigate",
          "label": "Games",
          "targetGrid": "games",
          "image": "icons/games.png"
        },
        {
          "position": [0, 1],
          "type": "navigate",
          "label": "Music",
          "targetGrid": "music"
        },
        {
          "position": [0, 2],
          "type": "navigate",
          "label": "Memes",
          "targetGrid": "memes"
        },
        {
          "position": [1, 0],
          "type": "navigate",
          "label": "Alerts",
          "targetGrid": "alerts"
        }
      ]
    },
    "games": {
      "name": "Games",
      "rows": 3,
      "columns": 5,
      "hotkeyOverrides": {
        "0,0": ["Ctrl+Shift+M", "F1"]
      },
      "buttons": [
        {
          "position": [0, 0],
          "type": "navigate",
          "label": "Minecraft",
          "targetGrid": "minecraft",
          "image": "icons/minecraft.png"
        },
        {
          "position": [0, 1],
          "type": "navigate",
          "label": "CSGO",
          "targetGrid": "csgo"
        },
        {
          "position": [0, 3],
          "type": "navigate",
          "label": "→ Memes",
          "targetGrid": "memes",
          "description": "Shortcut to Memes"
        },
        {
          "position": [0, 4],
          "type": "navigate",
          "label": "→ Clips",
          "targetGrid": "clips"
        },
        {
          "position": [1, 1],
          "type": "sound",
          "label": "Victory",
          "audioFile": "C:/Sounds/victory.mp3",
          "image": "icons/trophy.png"
        },
        {
          "position": [1, 2],
          "type": "sound",
          "label": "Defeat",
          "audioFile": "C:/Sounds/defeat.mp3"
        },
        {
          "position": [2, 0],
          "type": "sound",
          "label": "Bruh",
          "audioFile": "C:/Sounds/bruh.mp3"
        }
    "minecraft": {
      "name": "Minecraft",
      "rows": 3,
      "columns": 6,
      "hotkeyOverrides": {
        "1,0": ["F5", "V", "Numpad5"]
      },
      "buttons": [,
      "hotkeyOverrides": {},
      "buttons": [
        {
          "position": [0, 0],
          "type": "sound",
          "label": "Oof",
          "audioFile": "C:/Sounds/Games/minecraft_oof.mp3"
        },
        {
          "position": [0, 4],
          "type": "navigate",
          "label": "→ Games",
          "targetGrid": "games"
        },
        {
          "position": [0, 5],
          "type": "navigate",
          "label": "→ Clips",
          "targetGrid": "clips"
        },
        {
## Usage Scenarios

### Scenario 1: Stream Deck User
You have a 3x5 Stream Deck. You map your default hotkeys `F1-F15` to match the Stream Deck buttons, then override specific positions in heavily-used grids.

### Scenario 2: Gaming Session
1. Open app → Home grid visible
2. Press `F1` (position 0,0) → Navigate to Games
3. Press `Ctrl+Shift+M` (overridden position 0,0 in Games) → Navigate to Minecraft
4. Press `F1` (position 0,0 in Minecraft) → Plays "Oof" sound
5. Click "→ Games" button → Back to Games (direct link)
6. Click "→ Memes" button → Jump to Memes (without going through Home)
7. Press `Ctrl+H` (home hotkey) → Return to Home

### Scenario 3: Non-Hierarchical Navigation
Start at Home → Games → Memes (direct link) → Music (direct link) → Minecraft (somehow linked) → Clips → CSGO

You never had to return to Home. Your grids are connected in a web, not a tree.

### Scenario 4: Organizing New Sounds
1. Download 10 new meme sounds
2. Drag & drop them into the app
3. Navigate to Memes grid (or create new "2025 Memes" grid)
4. Arrange the sounds wherever you want in the grid
5. Set custom grid size (maybe 6x3 for this one)
6. Override hotkeys for your top 3 sounds in this grid
7. Add navigation buttons to link it from Home and Games

### Scenario 6: User Gets Lost
You navigate through several grids and forget where you are. Press the Home hotkey (`Ctrl+H`) to instantly return to the home grid. If you can't reach a grid anymore because you removed all navigation buttons to it, you'll need to edit the JSON config or add a button back manually.

Does this match your vision now?5
3. During a stream, press F1, wait 0.2 seconds, press F3, wait 0.1 seconds, press F5
4. Result: Triple-layered airhorn effect (all three play simultaneously, overlapping)
5. Or: Rapidly click the same button 3 times for the same effect

### Scenario 5: User Gets Lost
You navigate through several grids and forget where you are. Press the Home hotkey (`Ctrl+H`) to instantly return to the home grid. If you can't reach a grid anymore because you removed all navigation buttons to it, you'll need to edit the JSON config or add a button back manually.

Does this match your vision now?
        {
          "position": [0, 0],
          "type": "sound",
          "label": "Bruh",
          "audioFile": "C:/Sounds/bruh.mp3"
        },
        {
          "position": [0, 1],
          "type": "sound",
          "label": "Airhorn",
          "audioFile": "C:/Sounds/airhorn.mp3"
        },
        {
          "position": [0, 2],
          "type": "navigate",
          "label": "→ Music",
          "targetGrid": "music"
        },
        {
          "position": [0, 3],
          "type": "navigate",
          "label": "→ Games",
          "targetGrid": "games"
        },
        {
          "position": [1, 1],
          "type": "sound",
          "label": "Trombone",
          "audioFile": "C:/Sounds/sad_trombone.mp3"
        }
      ]
    }
  }
} }
}
```

## Usage Scenarios

### Scenario 1: Stream Deck User
You have a 3x5 Stream Deck. You set up hotkeys for your top 15 most-used sounds across different grid levels, so you can trigger them without navigating.

### Scenario 2: Gaming Session
1. Open app → Home grid visible
2. Press hotkey `Ctrl+1` → Navigate to Games
3. Click "Minecraft" → Navigate to Minecraft sounds
4. Press `F1` → Plays "Oof" sound
5. Click BACK → Return to Games
6. Press BACK hotkey → Return to Home

### Scenario 3: Organizing New Sounds
1. Download 10 new meme sounds
2. Drag & drop them into the app
3. Create new folder "2025 Memes" in Memes grid
4. Arrange the sounds in the new grid however you want
5. Assign hotkeys to favorites

Does this structure match what you're envisioning?
