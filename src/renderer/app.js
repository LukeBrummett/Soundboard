class App {
  constructor() {
    const ConfigManager = require('../common/config');
    this.config = new ConfigManager();
    this.audio = new AudioManager();
    this.grid = null;
    
    // Add global error handlers
    window.addEventListener('error', (event) => {
      console.error('Uncaught error:', event.error);
      console.error('Stack:', event.error?.stack);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      console.error('Stack:', event.reason?.stack);
    });
  }

  async init() {
    try {
      // Initialize config
      await this.config.init();
      
      // Set initial volume
      const config = this.config.getConfig();
      this.audio.setVolume(config.settings.volume);
      
      // Set audio output device if configured
      console.log('Config settings:', config.settings);
      if (config.settings.audioOutputDevice) {
        console.log('Setting audio output device to:', config.settings.audioOutputDevice);
        await this.audio.setAudioOutputDevice(config.settings.audioOutputDevice);
      } else {
        console.log('No audio output device configured, using default');
      }

      // Initialize grid manager
      this.grid = new GridManager(this.config, this.audio);
      await this.grid.init();

      // Setup additional UI handlers
      this.setupUIHandlers();
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }

  setupUIHandlers() {
    // Modal close button
    document.getElementById('modal-close').addEventListener('click', () => {
      this.grid.closeModal();
    });

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => {
      this.showSettingsDialog();
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

  async showSettingsDialog() {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    const config = this.config.getConfig();
    const settings = config.settings;
    const streamDecks = this.config.getStreamDecks();
    
    // Get available audio output devices
    const audioDevices = await this.audio.getAudioOutputDevices();
    const currentDevice = settings.audioOutputDevice || 'default';

    modalTitle.textContent = 'Settings';
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Master Volume</label>
        <input type="range" id="volume-slider" min="0" max="100" value="${settings.volume * 100}" 
               style="width: 100%;">
        <span id="volume-value">${Math.round(settings.volume * 100)}%</span>
      </div>
      <div class="form-group">
        <label>Audio Output Device</label>
        <select id="audio-output-device">
          <option value="default" ${currentDevice === 'default' ? 'selected' : ''}>System Default</option>
          ${audioDevices.map(device => 
            `<option value="${device.deviceId}" ${currentDevice === device.deviceId ? 'selected' : ''}>${device.label}</option>`
          ).join('')}
        </select>
        <small style="opacity: 0.7; display: block; margin-top: 4px;">Select the audio device to output sound to (e.g., virtual audio cable for streaming)</small>
      </div>
      <div class="form-group">
        <label>Home Grid</label>
        <select id="home-grid">
          ${Object.entries(config.grids).map(([id, grid]) => 
            `<option value="${id}" ${settings.homeGrid === id ? 'selected' : ''}>${grid.name}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
        <label style="margin-bottom: 0;">Show Stream Deck Frames</label>
        <input type="checkbox" id="show-frames" ${settings.showStreamDeckFrames ? 'checked' : ''} style="width: auto;">
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
        <button class="btn btn-secondary" onclick="app.testStreamDeck()" style="margin-top: 8px; margin-left: 8px;">Test Stream Deck</button>
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

  async saveSettings() {
    const volume = parseInt(document.getElementById('volume-slider').value) / 100;
    const homeGrid = document.getElementById('home-grid').value;
    const showFrames = document.getElementById('show-frames').checked;
    const audioOutputDevice = document.getElementById('audio-output-device').value;

    const config = this.config.getConfig();
    config.settings.volume = volume;
    config.settings.homeGrid = homeGrid;
    config.settings.showStreamDeckFrames = showFrames;
    config.settings.audioOutputDevice = audioOutputDevice;
    
    // Apply audio output device
    await this.audio.setAudioOutputDevice(audioOutputDevice);

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

    }

    // Validate ID format
    if (!/^[a-z0-9_]+$/.test(id)) {

    }

    // Check if ID already exists
    const config = this.config.getConfig();
    if (config.grids[id]) {
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
      return;
    }

    // Confirm deletion
    // Direct deletion without confirmation

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

  async showAddStreamDeckDialog() {
    const { ipcRenderer } = require('electron');
    
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    // Clear any existing content first
    modalBody.innerHTML = '';
    
    modalTitle.textContent = 'Add Stream Deck';
    
    // Show modal before fetching to prevent lag
    modal.classList.remove('hidden');
    
    // Fetch connected devices
    const connectedDevices = await ipcRenderer.invoke('get-connected-streamdecks');
    
    if (connectedDevices.length === 0) {
      modalBody.innerHTML = `
        <p style="color: #888; text-align: center; padding: 20px;">
          No Stream Deck devices detected.<br><br>
          Please connect a Stream Deck and try again.
        </p>
        <div class="button-group">
          <button class="btn btn-secondary" onclick="app.showSettingsDialog()">Back</button>
          <button class="btn btn-primary" onclick="app.showAddStreamDeckDialog()">Refresh</button>
        </div>
      `;
    } else {
      const unconfiguredDevices = connectedDevices.filter(d => !d.isConfigured);
      
      if (unconfiguredDevices.length === 0) {
        modalBody.innerHTML = `
          <p style="color: #888; text-align: center; padding: 20px;">
            All connected Stream Decks are already configured.
          </p>
          <div class="button-group">
            <button class="btn btn-secondary" onclick="app.showSettingsDialog()">Back</button>
          </div>
        `;
      } else {
        modalBody.innerHTML = `
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="streamdeck-name" placeholder="e.g., My Stream Deck">
          </div>
          <div class="form-group">
            <label>Select Device</label>
            <select id="streamdeck-device">
              ${unconfiguredDevices.map(device => 
                `<option value="${device.path}">${device.model} (${device.rows}x${device.columns}) - Serial: ${device.serialNumber || 'N/A'}</option>`
              ).join('')}
            </select>
            <small style="color: #888; display: block; margin-top: 4px;">
              ${unconfiguredDevices.length} unconfigured device${unconfiguredDevices.length !== 1 ? 's' : ''} found
            </small>
          </div>
          <div class="button-group">
            <button class="btn btn-secondary" onclick="app.showSettingsDialog()">Back</button>
            <button class="btn btn-primary" onclick="app.addStreamDeck()">Add</button>
          </div>
        `;
      }
    }
    
    // Focus the name input after DOM is ready
    setTimeout(async () => {
      const nameInput = document.getElementById('streamdeck-name');
      if (nameInput) {
        // Ensure window has focus first
        await ipcRenderer.invoke('focus-window');
        nameInput.focus();
        nameInput.select();
      }
    }, 100);
  }

  async addStreamDeck() {
    const { ipcRenderer } = require('electron');
    
    const name = document.getElementById('streamdeck-name').value.trim();
    const devicePath = document.getElementById('streamdeck-device').value;
    
    if (!name) {
      return;
    }

    // Get the device info
    const connectedDevices = await ipcRenderer.invoke('get-connected-streamdecks');
    const device = connectedDevices.find(d => d.path === devicePath);
    
    if (!device) {
      return;
    }
    
    const streamDeck = {
      id: Date.now().toString(),
      name: name,
      model: device.model,
      modelId: device.modelId,
      rows: device.rows,
      columns: device.columns,
      devicePath: device.path,
      serialNumber: device.serialNumber
    };

    this.config.addStreamDeck(streamDeck);
    
    // Initialize the device now that it's configured
    await ipcRenderer.invoke('reinitialize-streamdeck', device.path);
    
    // Refresh frames if they're visible
    if (this.grid.streamDeckFrames) {
      this.grid.updateStreamDeckFrames();
    }
    
    this.showSettingsDialog();
  }

  removeStreamDeck(id) {
    this.config.removeStreamDeck(id);
    
    // Refresh frames
    if (this.grid.streamDeckFrames) {
      this.grid.updateStreamDeckFrames();
    }
    
    this.showSettingsDialog();
  }

  async testStreamDeck() {
    const { ipcRenderer } = require('electron');
    
    // Get connected devices
    const connectedDevices = await ipcRenderer.invoke('get-connected-streamdecks');
    
    if (connectedDevices.length === 0) {
      return;
    }
    
    // Show device selection modal
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    modalTitle.textContent = 'Test Stream Deck';
    modalBody.innerHTML = `
      <p>Select a device to test. A red/blue alternating pattern will be displayed.</p>
      <div class="form-group">
        <label>Select Device</label>
        <select id="test-device">
          ${connectedDevices.map(device => {
            const label = device.isConfigured 
              ? `${device.configuredName} (${device.model})` 
              : `${device.model} - Serial: ${device.serialNumber || 'N/A'}`;
            return `<option value="${device.path}">${label}</option>`;
          }).join('')}
        </select>
      </div>
      <div id="test-results" style="margin-top: 16px;"></div>
      <div class="button-group">
        <button class="btn btn-secondary" onclick="app.showSettingsDialog()">Close</button>
        <button class="btn btn-primary" onclick="app.runStreamDeckTest()">Run Test</button>
      </div>
    `;
    
    modal.classList.remove('hidden');
  }
  
  async runStreamDeckTest() {
    const { ipcRenderer } = require('electron');
    const devicePath = document.getElementById('test-device').value;
    const resultsDiv = document.getElementById('test-results');
    
    // Show loading state
    resultsDiv.innerHTML = `<p style="color: #888; font-style: italic;">Running test...</p>`;
    
    try {
      const result = await ipcRenderer.invoke('test-streamdeck', devicePath);
      
      if (result.success) {
        const device = result.results[0];
        resultsDiv.innerHTML = `
          <div style="padding: 12px; background: #2a4a2a; border: 1px solid #4a8a4a; border-radius: 4px;">
            <div style="color: #6aff6a; font-weight: bold; margin-bottom: 8px;">✓ Test Successful</div>
            <div style="color: #ccc; font-size: 13px;">
              <div>Device: ${device.name}</div>
              <div>Model: ${device.model}</div>
              <div>Status: ${device.message}</div>
            </div>
          </div>
        `;
      } else {
        const device = result.results[0];
        resultsDiv.innerHTML = `
          <div style="padding: 12px; background: #4a2a2a; border: 1px solid #8a4a4a; border-radius: 4px;">
            <div style="color: #ff6a6a; font-weight: bold; margin-bottom: 8px;">✗ Test Failed</div>
            <div style="color: #ccc; font-size: 13px;">
              <div>Device: ${device.name}</div>
              <div>Error: ${device.message}</div>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Test error:', error);
      resultsDiv.innerHTML = `
        <div style="padding: 12px; background: #4a2a2a; border: 1px solid #8a4a4a; border-radius: 4px;">
          <div style="color: #ff6a6a; font-weight: bold; margin-bottom: 8px;">✗ Test Error</div>
          <div style="color: #ccc; font-size: 13px;">${error.message}</div>
        </div>
      `;
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
