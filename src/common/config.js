const fs = require('fs');
const path = require('path');

/**
 * ConfigManager - Handles loading, saving, and managing application configuration
 * 
 * This class manages all persistent settings including:
 * - Application settings (volume, home grid, Stream Deck frames)
 * - Hotkey mappings for each grid position
 * - Grid definitions (buttons, layouts, Stream Deck positions)
 * - Stream Deck device configurations
 */
class ConfigManager {
  constructor(configPath = null) {
    this.config = null;
    this.configPath = configPath;
    
    // Detect if we're in renderer process (can use IPC) or main process
    try {
      const electron = require('electron');
      this.ipcRenderer = electron.ipcRenderer;
    } catch (e) {
      this.ipcRenderer = null;
    }
  }

  /**
   * Initialize the config manager
   * In renderer process: gets config path from main via IPC
   * In main process: uses path provided in constructor
   */
  async init() {
    if (!this.configPath && this.ipcRenderer) {
      this.configPath = await this.ipcRenderer.invoke('get-config-path');
    }
    await this.load();
  }

  /**
   * Load configuration from disk
   * Creates default config if file doesn't exist
   */
  async load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        this.config = JSON.parse(data);
      } else {
        this.config = this.getDefaultConfig();
        await this.save();
      }
    } catch (error) {
      // On error, use default config
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * Save current configuration to disk
   */
  async save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      // Silently fail - user will see effects on next load
    }
  }

  /**
   * Get default configuration structure
   * Used for new installations or when config is corrupted
   */
  getDefaultConfig() {
    return {
      settings: {
        homeGrid: 'home',           // Grid to show on startup
        homeHotkey: 'Home',          // Key to return to home grid
        audioOutputDevice: 'default', // Audio output device ID
        volume: 0.8,                 // Master volume (0.0 to 1.0)
        showStreamDeckFrames: true,  // Show overlay frames for Stream Decks
        autoSyncStreamDecks: true    // Automatically update Stream Decks
      },
      // Default hotkey assignments for first 12 grid positions (4x3)
      defaultHotkeyMap: {
        '0,0': ['F1'], '0,1': ['F2'], '0,2': ['F3'], '0,3': ['F4'],
        '1,0': ['F5'], '1,1': ['F6'], '1,2': ['F7'], '1,3': ['F8'],
        '2,0': ['F9'], '2,1': ['F10'], '2,2': ['F11'], '2,3': ['F12']
      },
      streamDecks: [], // Connected Stream Deck devices
      grids: {
        home: {
          name: 'Home',
          rows: 4,
          columns: 4,
          hotkeyOverrides: {},      // Position-specific hotkey overrides
          streamDeckPositions: {},   // Where Stream Deck frames are positioned
          buttons: []                // Button definitions
        }
      }
    };
  }

  /** Get entire configuration object */
  getConfig() {
    return this.config;
  }

  /** Update configuration with partial updates */
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    this.save();
  }

  /** Get a specific grid by ID */
  getGrid(gridId) {
    return this.config.grids[gridId];
  }

  /** Update a grid's data */
  updateGrid(gridId, gridData) {
    this.config.grids[gridId] = gridData;
    this.save();
  }

  /** Create a new grid */
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

  /** Delete a grid (cannot delete home grid) */
  deleteGrid(gridId) {
    if (gridId !== this.config.settings.homeGrid) {
      delete this.config.grids[gridId];
      this.save();
    }
  }

  /**
   * Add or update a button in a grid
   * If a button already exists at the position, it will be replaced
   */
  addButton(gridId, button) {
    const grid = this.config.grids[gridId];
    if (!grid) return;
    
    // Remove existing button at this position
    grid.buttons = grid.buttons.filter(
      b => b.position[0] !== button.position[0] || b.position[1] !== button.position[1]
    );
    grid.buttons.push(button);
    this.save();
  }

  /**
   * Remove a button from a grid
   * Returns the removed button so caller can clean up associated files
   */
  removeButton(gridId, position) {
    const grid = this.config.grids[gridId];
    if (!grid) return null;
    
    const button = grid.buttons.find(
      b => b.position[0] === position[0] && b.position[1] === position[1]
    );
    
    grid.buttons = grid.buttons.filter(
      b => b.position[0] !== position[0] || b.position[1] !== position[1]
    );
    this.save();
    
    return button;
  }

  /**
   * Get all hotkeys for a grid
   * Merges default hotkeys with grid-specific overrides
   * Grid overrides take priority
   */
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

    // Process default hotkeys (skip if already used by an override)
    for (const [pos, keys] of Object.entries(this.config.defaultHotkeyMap)) {
      const [row, col] = pos.split(',').map(Number);
      
      // Skip positions that have overrides
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

  // ==================== Stream Deck Management ====================

  /** Add a new Stream Deck configuration */
  addStreamDeck(streamDeck) {
    if (!this.config.streamDecks) {
      this.config.streamDecks = [];
    }
    this.config.streamDecks.push(streamDeck);
    this.save();
  }

  /** Update an existing Stream Deck configuration */
  updateStreamDeck(id, updates) {
    const index = this.config.streamDecks.findIndex(sd => sd.id === id);
    if (index !== -1) {
      this.config.streamDecks[index] = { ...this.config.streamDecks[index], ...updates };
      this.save();
    }
  }

  /**
   * Remove a Stream Deck and clean up all its positions from all grids
   */
  removeStreamDeck(id) {
    this.config.streamDecks = this.config.streamDecks.filter(sd => sd.id !== id);
    
    // Remove this Stream Deck's positions from all grids
    Object.values(this.config.grids).forEach(grid => {
      if (grid.streamDeckPositions && grid.streamDeckPositions[id]) {
        delete grid.streamDeckPositions[id];
      }
    });
    
    this.save();
  }

  /** Get all configured Stream Decks */
  getStreamDecks() {
    return this.config.streamDecks || [];
  }

  /** Update where a Stream Deck frame is positioned on a grid */
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
