console.log('Loading app.js...');

class App {
  constructor() {
    const ConfigManager = require('../common/config');
    this.config = new ConfigManager();
    this.audio = new AudioManager();
    this.grid = null;
  }

  async init() {
    try {
      // Initialize config
      await this.config.init();
      
      // Set initial volume
      const config = this.config.getConfig();
      this.audio.setVolume(config.settings.volume);

      // Initialize grid manager
      this.grid = new GridManager(this.config, this.audio);
      await this.grid.init();

      // Setup additional UI handlers
      this.setupUIHandlers();

      console.log('App initialized successfully');
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }

  setupUIHandlers() {
    // Modal close button
    document.getElementById('modal-close').addEventListener('click', () => {
      this.grid.closeModal();
    });

    // Close modal on background click
    document.getElementById('modal').addEventListener('click', (e) => {
      if (e.target.id === 'modal') {
        this.grid.closeModal();
      }
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.showSettingsDialog();
    });

    // Add grid button
    document.getElementById('add-grid-btn').addEventListener('click', () => {
      this.showAddGridDialog();
    });

    // Lock button
    document.getElementById('lock-btn').addEventListener('click', () => {
      const isLocked = this.grid.toggleLock();
      const lockBtn = document.getElementById('lock-btn');
      lockBtn.textContent = isLocked ? '🔒' : '🔓';
      lockBtn.title = isLocked ? 'Unlock Grid (Ctrl+L)' : 'Lock Grid (Ctrl+L)';
    });

    // Delete grid button
    document.getElementById('delete-grid-btn').addEventListener('click', () => {
      this.deleteCurrentGrid();
    });
  }

  showSettingsDialog() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    const config = this.config.getConfig();
    const settings = config.settings;
    const streamDecks = this.config.getStreamDecks();

    modalTitle.textContent = 'Settings';
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Master Volume</label>
        <input type="range" id="volume-slider" min="0" max="100" value="${settings.volume * 100}" 
               style="width: 100%;">
        <span id="volume-value">${Math.round(settings.volume * 100)}%</span>
      </div>
      <div class="form-group">
        <label>Home Grid</label>
        <select id="home-grid">
          ${Object.entries(config.grids).map(([id, grid]) => 
            `<option value="${id}" ${settings.homeGrid === id ? 'selected' : ''}>${grid.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Home Hotkey</label>
        <input type="text" id="home-hotkey" value="${settings.homeHotkey}" placeholder="e.g., Ctrl+H">
        <small>Press the key combination you want to use</small>
      </div>
      <div class="form-group">
        <label>Show Stream Deck Frames</label>
        <input type="checkbox" id="show-frames" ${settings.showStreamDeckFrames ? 'checked' : ''}>
      </div>
      <div class="form-group">
        <label>Stream Decks</label>
        <div id="streamdeck-list">
          ${streamDecks.length === 0 ? '<p style="color: #888; font-style: italic;">No Stream Decks configured</p>' : ''}
          ${streamDecks.map(sd => `
            <div class="streamdeck-item" data-id="${sd.id}" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: #2a2a2a; margin-bottom: 8px; border-radius: 4px;">
              <span style="flex: 1;">${sd.name} (${sd.model})</span>
              <button class="btn btn-danger btn-sm" onclick="app.removeStreamDeck('${sd.id}')">Remove</button>
            </div>
          `).join('')}
        </div>
        <button class="btn btn-secondary" onclick="app.showAddStreamDeckDialog()" style="margin-top: 8px;">Add Stream Deck</button>
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" onclick="app.grid.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.saveSettings()">Save</button>
      </div>
    `;

    // Volume slider live update
    const volumeSlider = document.getElementById('volume-slider');
    const volumeValue = document.getElementById('volume-value');
    volumeSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      volumeValue.textContent = value + '%';
      this.audio.setVolume(value / 100);
    });

    modal.classList.remove('hidden');
  }

  saveSettings() {
    const volume = parseInt(document.getElementById('volume-slider').value) / 100;
    const homeGrid = document.getElementById('home-grid').value;
    const homeHotkey = document.getElementById('home-hotkey').value;
    const showFrames = document.getElementById('show-frames').checked;

    const config = this.config.getConfig();
    config.settings.volume = volume;
    config.settings.homeGrid = homeGrid;
    config.settings.homeHotkey = homeHotkey;
    config.settings.showStreamDeckFrames = showFrames;

    this.config.updateConfig(config);
    this.audio.setVolume(volume);
    
    this.grid.closeModal();
  }

  showAddGridDialog() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = 'Create New Grid';
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Grid Name</label>
        <input type="text" id="grid-name" placeholder="e.g., My Sounds" autofocus>
      </div>
      <div class="form-group">
        <label>Grid ID (unique identifier)</label>
        <input type="text" id="grid-id" placeholder="e.g., my_sounds">
        <small>Lowercase letters, numbers, and underscores only</small>
      </div>
      <div class="form-group">
        <label>Rows</label>
        <input type="number" id="grid-rows" value="4" min="1" max="10">
      </div>
      <div class="form-group">
        <label>Columns</label>
        <input type="number" id="grid-cols" value="4" min="1" max="10">
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" onclick="app.grid.closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="app.createGrid()">Create</button>
      </div>
    `;

    // Auto-generate ID from name
    const nameInput = document.getElementById('grid-name');
    const idInput = document.getElementById('grid-id');
    nameInput.addEventListener('input', (e) => {
      const name = e.target.value;
      const id = name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
      idInput.value = id;
    });

    modal.classList.remove('hidden');
  }

  createGrid() {
    const name = document.getElementById('grid-name').value.trim();
    const id = document.getElementById('grid-id').value.trim();
    const rows = parseInt(document.getElementById('grid-rows').value);
    const cols = parseInt(document.getElementById('grid-cols').value);

    if (!name || !id) {
      alert('Please provide both a name and ID for the grid');
      return;
    }

    // Validate ID format
    if (!/^[a-z0-9_]+$/.test(id)) {
      alert('Grid ID can only contain lowercase letters, numbers, and underscores');
      return;
    }

    // Check if ID already exists
    const config = this.config.getConfig();
    if (config.grids[id]) {
      alert('A grid with this ID already exists');
      return;
    }

    // Create the grid
    this.config.createGrid(id, { name, rows, columns: cols });
    
    this.grid.closeModal();
    
    // Navigate to the new grid
    this.grid.navigateToGrid(id);
  }

  async deleteCurrentGrid() {
    const currentGrid = this.grid.currentGrid;
    const config = this.config.getConfig();
    const grid = config.grids[currentGrid];

    // Can't delete home grid
    if (currentGrid === config.settings.homeGrid) {
      alert('Cannot delete the home grid');
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the grid "${grid.name}"? This will delete all buttons and their audio files.`)) {
      return;
    }

    // Delete all button files in this grid
    if (grid.buttons && grid.buttons.length > 0) {
      for (const button of grid.buttons) {
        if (button.audioFile) {
          try {
            await this.grid.ipcRenderer.invoke('delete-file', button.audioFile);
          } catch (error) {
            console.error('Failed to delete audio file:', error);
          }
        }
        if (button.image) {
          try {
            await this.grid.ipcRenderer.invoke('delete-file', button.image);
          } catch (error) {
            console.error('Failed to delete image file:', error);
          }
        }
      }
    }

    // Find and delete all navigation buttons pointing to this grid in other grids
    for (const [gridId, otherGrid] of Object.entries(config.grids)) {
      if (gridId === currentGrid) continue; // Skip the grid being deleted
      
      if (otherGrid.buttons && otherGrid.buttons.length > 0) {
        const buttonsToDelete = otherGrid.buttons.filter(
          btn => btn.type === 'navigate' && btn.targetGrid === currentGrid
        );
        
        // Delete files for navigation buttons
        for (const button of buttonsToDelete) {
          if (button.image) {
            try {
              await this.grid.ipcRenderer.invoke('delete-file', button.image);
            } catch (error) {
              console.error('Failed to delete navigation button image:', error);
            }
          }
        }
        
        // Remove the navigation buttons from the grid
        otherGrid.buttons = otherGrid.buttons.filter(
          btn => !(btn.type === 'navigate' && btn.targetGrid === currentGrid)
        );
      }
    }

    // Save the updated config with removed navigation buttons
    this.config.updateConfig(config);

    // Delete the grid itself
    this.config.deleteGrid(currentGrid);

    // Navigate to home
    await this.grid.navigateToHome();
  }

  showAddStreamDeckDialog() {
    const { STREAMDECK_MODELS } = require('../common/streamdeck-models.js');
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = 'Add Stream Deck';
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Name</label>
        <input type="text" id="streamdeck-name" placeholder="e.g., My Stream Deck" autofocus>
      </div>
      <div class="form-group">
        <label>Model</label>
        <select id="streamdeck-model">
          ${Object.values(STREAMDECK_MODELS).map(model => 
            `<option value="${model.id}">${model.name} (${model.rows}x${model.columns})</option>`
          ).join('')}
        </select>
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" onclick="app.showSettingsDialog()">Back</button>
        <button class="btn btn-primary" onclick="app.addStreamDeck()">Add</button>
      </div>
    `;

    modal.classList.remove('hidden');
    
    // Focus the name input after modal is shown
    setTimeout(() => {
      const nameInput = document.getElementById('streamdeck-name');
      if (nameInput) nameInput.focus();
    }, 0);
  }

  addStreamDeck() {
    const name = document.getElementById('streamdeck-name').value.trim();
    const modelId = document.getElementById('streamdeck-model').value;
    
    if (!name) {
      alert('Please enter a name for the Stream Deck');
      return;
    }

    const { getModelById } = require('../common/streamdeck-models.js');
    const model = getModelById(modelId);
    
    const streamDeck = {
      id: Date.now().toString(),
      name: name,
      model: model.name,
      modelId: modelId,
      rows: model.rows,
      columns: model.columns
    };

    this.config.addStreamDeck(streamDeck);
    
    // Refresh frames if they're visible
    if (this.grid.streamDeckFrames) {
      this.grid.updateStreamDeckFrames();
    }
    
    this.showSettingsDialog();
  }

  removeStreamDeck(id) {
    if (confirm('Remove this Stream Deck? Frame positions will be lost.')) {
      this.config.removeStreamDeck(id);
      
      // Refresh frames
      if (this.grid.streamDeckFrames) {
        this.grid.updateStreamDeckFrames();
      }
      
      this.showSettingsDialog();
    }
  }
}

// Create and initialize app
const app = new App();

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Make app globally accessible for inline handlers
window.app = app;
