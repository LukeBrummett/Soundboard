const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configPath = null) {
    this.config = null;
    this.configPath = configPath;
    
    // Only use ipcRenderer if we're in renderer process
    try {
      const electron = require('electron');
      this.ipcRenderer = electron.ipcRenderer;
    } catch (e) {
      this.ipcRenderer = null;
    }
  }

  async init() {
    // If configPath wasn't provided in constructor, get it via IPC (renderer process)
    if (!this.configPath && this.ipcRenderer) {
      this.configPath = await this.ipcRenderer.invoke('get-config-path');
    }
    await this.load();
  }

  async load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(data);
      } else {
        // Create default config
        this.config = this.getDefaultConfig();
        await this.save();
      }
    } catch (error) {
      console.error('Error loading config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  async save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Error saving config:', error);
    }
  }

  getDefaultConfig() {
    return {
      settings: {
        homeGrid: 'home',
        homeHotkey: 'Home',
        audioOutputDevice: 'default',
        volume: 0.8,
        showStreamDeckFrames: true,
        autoSyncStreamDecks: true
      },
      defaultHotkeyMap: {
        '0,0': ['F1'],
        '0,1': ['F2'],
        '0,2': ['F3'],
        '0,3': ['F4'],
        '1,0': ['F5'],
        '1,1': ['F6'],
        '1,2': ['F7'],
        '1,3': ['F8'],
        '2,0': ['F9'],
        '2,1': ['F10'],
        '2,2': ['F11'],
        '2,3': ['F12']
      },
      streamDecks: [],
      grids: {
        home: {
          name: 'Home',
          rows: 4,
          columns: 4,
          hotkeyOverrides: {},
          streamDeckPositions: {},
          buttons: []
        }
      }
    };
  }

  getConfig() {
    return this.config;
  }

  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  getGrid(gridId) {
    return this.config.grids[gridId];
  }

  updateGrid(gridId, gridData) {
    this.config.grids[gridId] = gridData;
    this.save();
  }

  createGrid(gridId, gridData) {
    this.config.grids[gridId] = {
      name: gridData.name || 'New Grid',
      rows: gridData.rows || 4,
      columns: gridData.columns || 4,
      hotkeyOverrides: {},
      streamDeckPositions: {},
      buttons: []
    };
    this.save();
  }

  deleteGrid(gridId) {
    if (gridId !== this.config.settings.homeGrid) {
      delete this.config.grids[gridId];
      this.save();
    }
  }

  addButton(gridId, button) {
    const grid = this.config.grids[gridId];
    if (grid) {
      // Remove existing button at this position
      grid.buttons = grid.buttons.filter(
        b => b.position[0] !== button.position[0] || b.position[1] !== button.position[1]
      );
      grid.buttons.push(button);
      this.save();
    }
  }

  removeButton(gridId, position) {
    const grid = this.config.grids[gridId];
    if (grid) {
      // Find the button before removing it
      const button = grid.buttons.find(
        b => b.position[0] === position[0] && b.position[1] === position[1]
      );
      
      grid.buttons = grid.buttons.filter(
        b => b.position[0] !== position[0] || b.position[1] !== position[1]
      );
      this.save();
      
      // Return the deleted button so caller can clean up files
      return button;
    }
    return null;
  }

  getHotkeysForGrid(gridId) {
    const grid = this.config.grids[gridId];
    if (!grid) return [];

    const hotkeys = [];
    const usedKeys = new Set();

    // Process overrides first (they take priority)
    for (const [pos, keys] of Object.entries(grid.hotkeyOverrides || {})) {
      keys.forEach(key => {
        hotkeys.push({ key, position: pos.split(',').map(Number) });
        usedKeys.add(key);
      });
    }

    // Process default hotkeys (skip if already used)
    for (const [pos, keys] of Object.entries(this.config.defaultHotkeyMap)) {
      const [row, col] = pos.split(',').map(Number);
      
      // Skip if this position has an override
      if (grid.hotkeyOverrides && grid.hotkeyOverrides[pos]) {
        continue;
      }

      // Only add keys that aren't already used
      keys.forEach(key => {
        if (!usedKeys.has(key)) {
          hotkeys.push({ key, position: [row, col] });
          usedKeys.add(key);
        }
      });
    }

    return hotkeys;
  }

  // Stream Deck management
  addStreamDeck(streamDeck) {
    if (!this.config.streamDecks) {
      this.config.streamDecks = [];
    }
    this.config.streamDecks.push(streamDeck);
    this.save();
  }

  updateStreamDeck(id, updates) {
    const index = this.config.streamDecks.findIndex(sd => sd.id === id);
    if (index !== -1) {
      this.config.streamDecks[index] = { ...this.config.streamDecks[index], ...updates };
      this.save();
    }
  }

  removeStreamDeck(id) {
    this.config.streamDecks = this.config.streamDecks.filter(sd => sd.id !== id);
    
    // Remove all positions for this Stream Deck from all grids
    Object.values(this.config.grids).forEach(grid => {
      if (grid.streamDeckPositions && grid.streamDeckPositions[id]) {
        delete grid.streamDeckPositions[id];
      }
    });
    
    this.save();
  }

  getStreamDecks() {
    return this.config.streamDecks || [];
  }

  updateStreamDeckPosition(gridId, streamDeckId, position) {
    const grid = this.config.grids[gridId];
    if (grid) {
      if (!grid.streamDeckPositions) {
        grid.streamDeckPositions = {};
      }
      grid.streamDeckPositions[streamDeckId] = position;
      this.save();
    }
  }
}

module.exports = ConfigManager;
