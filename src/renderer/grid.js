class GridManager {
  constructor(configManager, audioManager) {
    this.config = configManager;
    this.audio = audioManager;
    this.ipcRenderer = require('electron').ipcRenderer;
    this.currentGrid = null;
    this.gridElement = document.getElementById('grid');
    this.copiedButton = null;
    this.isLocked = false;
    this.userDataPath = null;
    this.streamDeckFrames = [];
    this.draggingFrame = null;
    
    this.setupEventListeners();
    
    // Reposition frames on window resize (real-time repositioning)
    window.addEventListener('resize', () => {
      requestAnimationFrame(() => {
        this.repositionFrames();
      });
    });
  }

  async initPaths() {
    this.userDataPath = await this.ipcRenderer.invoke('get-user-data-path');
  }

  resolvePath(filePath) {
    if (!filePath) return null;
    const path = require('path');
    // If it's already an absolute path, return it normalized
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }
    // Otherwise, resolve from userData
    if (this.userDataPath) {
      // Convert forward slashes to platform-specific separators
      const normalizedRelative = filePath.replace(/\//g, path.sep);
      return path.join(this.userDataPath, normalizedRelative);
    }
    return filePath;
  }

  setupEventListeners() {
    // Home button
    document.getElementById('home-btn').addEventListener('click', () => {
      this.navigateToHome();
    });

    // Listen for lock toggle
    this.ipcRenderer.on('toggle-lock', () => {
      const isLocked = this.toggleLock();
      const lockBtn = document.getElementById('lock-btn');
      lockBtn.textContent = isLocked ? '🔒' : '🔓';
      lockBtn.title = isLocked ? 'Unlock Grid (Ctrl+L)' : 'Lock Grid (Ctrl+L)';
    });

    // Listen for hotkey presses
    this.ipcRenderer.on('hotkey-pressed', (event, position) => {
      this.handleHotkeyPress(position);
    });

    // Listen for Stream Deck button presses
    this.ipcRenderer.on('streamdeck-button-press', (event, position) => {
      this.handleHotkeyPress(position);
    });

    // Context menu
    this.setupContextMenu();

    // Drag and drop
    this.setupDragAndDrop();
  }

  async init() {
    // Wait for paths to be initialized before rendering
    await this.initPaths();
    const config = this.config.getConfig();
    await this.navigateToGrid(config.settings.homeGrid);
  }

  async navigateToHome() {
    const config = this.config.getConfig();
    await this.navigateToGrid(config.settings.homeGrid);
  }

  async navigateToGrid(gridId) {
    const grid = this.config.getGrid(gridId);
    if (!grid) {
      console.error('Grid not found:', gridId);
      return;
    }

    this.currentGrid = gridId;
    
    // Show/hide delete button based on whether this is home grid
    const config = this.config.getConfig();
    const deleteBtn = document.getElementById('delete-grid-btn');
    if (gridId === config.settings.homeGrid) {
      deleteBtn.style.display = 'none';
    } else {
      deleteBtn.style.display = '';
    }
    
    // Render grid
    this.renderGrid(grid);
    
    // Update Stream Decks
    await this.ipcRenderer.invoke('update-streamdecks');
    
    // Register hotkeys for this grid
    this.registerHotkeys(gridId);
  }

  renderGrid(grid) {
    this.gridElement.innerHTML = '';
    
    // Set grid layout
    this.gridElement.style.gridTemplateColumns = `repeat(${grid.columns}, 1fr)`;
    this.gridElement.style.gridTemplateRows = `repeat(${grid.rows}, 1fr)`;

    // Create button map for quick lookup
    const buttonMap = new Map();
    grid.buttons.forEach(button => {
      const key = `${button.position[0]},${button.position[1]}`;
      buttonMap.set(key, button);
    });

    // Render all grid positions
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.columns; col++) {
        const key = `${row},${col}`;
        const button = buttonMap.get(key);
        const buttonElement = this.createButtonElement(button, [row, col]);
        this.gridElement.appendChild(buttonElement);
      }
    }
    
    // Update Stream Deck frames after grid is rendered
    setTimeout(() => {
      this.updateStreamDeckFrames();
      this.updateStreamDecks();
      
      // Ensure frames are positioned after layout settles
      requestAnimationFrame(() => {
        this.repositionFrames();
      });
    }, 0);
  }

  createButtonElement(button, position) {
    const div = document.createElement('div');
    div.className = 'grid-button';
    div.dataset.row = position[0];
    div.dataset.col = position[1];

    if (!button) {
      // Empty button
      div.classList.add('empty');
      if (this.isLocked) {
        div.classList.add('locked');
      }
      div.innerHTML = '<span class="button-label">+</span>';
    } else {
      // Button with content
      div.classList.add(button.type);

      // Type icon
      const typeIcon = document.createElement('span');
      typeIcon.className = 'button-type-icon';
      typeIcon.textContent = button.type === 'sound' ? '🎵' : '📁';
      div.appendChild(typeIcon);

      // Image
      if (button.image) {
        const img = document.createElement('img');
        img.className = 'button-image';
        img.src = this.resolvePath(button.image);
        img.alt = button.label;
        div.appendChild(img);
      }

      // Label (optional)
      if (button.label) {
        const label = document.createElement('span');
        label.className = 'button-label';
        label.textContent = button.label;
        div.appendChild(label);
      }

      // Hotkey indicator
      const hotkey = this.getHotkeyForPosition(position);
      if (hotkey) {
        const hotkeySpan = document.createElement('span');
        hotkeySpan.className = 'button-hotkey';
        hotkeySpan.textContent = hotkey;
        div.appendChild(hotkeySpan);
      }
    }

    // Click handler
    div.addEventListener('click', () => {
      this.handleButtonClick(button, div);
    });

    // Right-click context menu
    div.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.isLocked) {
        this.showContextMenu(e, button, position);
      }
    });

    // Drag and drop to reorder buttons (only when button exists)
    if (button) {
      div.draggable = true;
      
      div.addEventListener('dragstart', (e) => {
        if (this.isLocked) {
          e.preventDefault();
          return;
        }
        div.classList.add('dragging');
        this.draggedButton = { button, position };
        e.dataTransfer.effectAllowed = 'move';
        // Set dummy data to distinguish from file drops
        e.dataTransfer.setData('text/plain', 'button-drag');
      });

      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        this.draggedButton = null;
      });
    }

    // Drop target (all cells can be drop targets when not locked)
    div.addEventListener('dragover', (e) => {
      if (this.draggedButton && !this.isLocked) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        div.classList.add('drop-target');
      }
    });

    div.addEventListener('dragleave', () => {
      div.classList.remove('drop-target');
    });

    div.addEventListener('drop', (e) => {
      div.classList.remove('drop-target');
      
      if (this.draggedButton && !this.isLocked) {
        e.preventDefault();
        e.stopPropagation();
        const targetPosition = [parseInt(div.dataset.row), parseInt(div.dataset.col)];
        this.swapButtons(this.draggedButton.position, targetPosition);
      }
    });

    return div;
  }

  swapButtons(fromPosition, toPosition) {
    const grid = this.config.getGrid(this.currentGrid);
    if (!grid) return;

    // Find buttons at both positions
    const fromButton = grid.buttons.find(
      b => b.position[0] === fromPosition[0] && b.position[1] === fromPosition[1]
    );
    const toButton = grid.buttons.find(
      b => b.position[0] === toPosition[0] && b.position[1] === toPosition[1]
    );

    // If dragging to the same position, do nothing
    if (fromPosition[0] === toPosition[0] && fromPosition[1] === toPosition[1]) {
      return;
    }

    // Remove both buttons from the grid
    grid.buttons = grid.buttons.filter(
      b => !(
        (b.position[0] === fromPosition[0] && b.position[1] === fromPosition[1]) ||
        (b.position[0] === toPosition[0] && b.position[1] === toPosition[1])
      )
    );

    // Swap positions
    if (fromButton) {
      fromButton.position = toPosition;
      grid.buttons.push(fromButton);
    }
    if (toButton) {
      toButton.position = fromPosition;
      grid.buttons.push(toButton);
    }

    // Save and re-render
    this.config.updateGrid(this.currentGrid, grid);
    this.renderGrid(grid);
    this.updateStreamDecks();
  }

  handleButtonClick(button, element) {
    console.log('[Grid] handleButtonClick called:', button ? button.type : 'empty');
    
    if (!button) {
      // Empty button - show add sound dialog
      if (this.isLocked) {
        return; // Don't show dialog when locked
      }
      const position = [parseInt(element.dataset.row), parseInt(element.dataset.col)];
      this.showAddSoundDialog(position);
      return;
    }

    if (button.type === 'sound') {
      console.log('[Grid] Playing sound button:', button.label, button.audioFile);
      
      // Play sound with audio settings
      try {
        element.classList.add('playing');
        const result = this.audio.play(button.audioFile, button.audioSettings);
        console.log('[Grid] Audio.play() returned:', result);
        setTimeout(() => element.classList.remove('playing'), 500);
      } catch (error) {
        console.error('[Grid] Error playing audio:', error);
        console.error('[Grid] Stack:', error.stack);
        element.classList.remove('playing');
        alert('Failed to play audio: ' + error.message);
      }
    } else if (button.type === 'navigate') {
      // Navigate to target grid
      this.navigateToGrid(button.targetGrid);
    }
  }

  handleHotkeyPress(position) {
    const grid = this.config.getGrid(this.currentGrid);
    if (!grid) return;

    const button = grid.buttons.find(
      b => b.position[0] === position[0] && b.position[1] === position[1]
    );

    if (button) {
      // Find the button element and trigger click
      const buttonElement = this.gridElement.querySelector(
        `[data-row="${position[0]}"][data-col="${position[1]}"]`
      );
      if (buttonElement) {
        this.handleButtonClick(button, buttonElement);
      }
    }
  }

  getHotkeyForPosition(position) {
    const grid = this.config.getGrid(this.currentGrid);
    const key = `${position[0]},${position[1]}`;
    
    // Check for override
    if (grid.hotkeyOverrides && grid.hotkeyOverrides[key]) {
      return grid.hotkeyOverrides[key][0]; // Show first hotkey
    }

    // Check default map
    const hotkeys = this.config.getHotkeysForGrid(this.currentGrid);
    const hotkey = hotkeys.find(h => h.position[0] === position[0] && h.position[1] === position[1]);
    
    return hotkey ? hotkey.key : null;
  }

  registerHotkeys(gridId) {
    const hotkeys = this.config.getHotkeysForGrid(gridId);
    this.ipcRenderer.send('register-hotkeys', hotkeys);
  }

  setupContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    
    // Hide context menu when clicking elsewhere
    document.addEventListener('click', () => {
      contextMenu.classList.add('hidden');
    });

    // Handle context menu actions
    contextMenu.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action) {
        this.handleContextMenuAction(action);
      }
    });
  }

  showContextMenu(event, button, position) {
    const contextMenu = document.getElementById('context-menu');
    
    // Show/hide menu items based on whether there's a button
    const editItem = contextMenu.querySelector('[data-action="edit"]');
    const editSoundItem = document.getElementById('edit-sound-item');
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');
    const copyItem = contextMenu.querySelector('[data-action="copy"]');
    const addSeparator = document.getElementById('add-separator');
    const addSoundItem = contextMenu.querySelector('[data-action="add-sound"]');
    const addNavigateItem = contextMenu.querySelector('[data-action="add-navigate"]');
    const pasteItem = document.getElementById('paste-item');
    const pasteSeparator = document.getElementById('paste-separator');
    
    let hasTopSection = false;
    let hasBottomSection = false;
    
    // Show/hide paste based on clipboard state
    if (this.copiedButton) {
      pasteItem.style.display = '';
      pasteSeparator.style.display = '';
      hasTopSection = true;
    } else {
      pasteItem.style.display = 'none';
      pasteSeparator.style.display = 'none';
    }
    
    if (button) {
      // Existing button - show edit, delete, copy
      editItem.style.display = '';
      deleteItem.style.display = '';
      copyItem.style.display = '';
      addSeparator.style.display = 'none';
      addSoundItem.style.display = 'none';
      addNavigateItem.style.display = 'none';
      
      // Show Edit Sound only for sound buttons
      if (button.type === 'sound') {
        editSoundItem.style.display = '';
      } else {
        editSoundItem.style.display = 'none';
      }
      
      hasTopSection = true;
    } else {
      // Empty button - show add options
      editItem.style.display = 'none';
      editSoundItem.style.display = 'none';
      deleteItem.style.display = 'none';
      copyItem.style.display = 'none';
      addSoundItem.style.display = '';
      addNavigateItem.style.display = '';
      hasBottomSection = true;
    }
    
    // Hide separators if only one section has items
    if (hasTopSection && !hasBottomSection) {
      addSeparator.style.display = 'none';
    } else if (!hasTopSection && hasBottomSection) {
      pasteSeparator.style.display = 'none';
      addSeparator.style.display = 'none';
    } else if (hasTopSection && hasBottomSection) {
      // Show middle separator only when both sections exist
      addSeparator.style.display = '';
    }
    
    // Don't show menu if no items are visible
    if (!hasTopSection && !hasBottomSection) {
      return;
    }
    
    // Initially position the menu
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.classList.remove('hidden');
    
    // Get menu dimensions after showing it
    const menuRect = contextMenu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    // Adjust horizontal position if menu would go off screen
    let left = event.clientX;
    if (left + menuRect.width > windowWidth) {
      left = windowWidth - menuRect.width - 5; // 5px margin
    }
    
    // Adjust vertical position if menu would go off screen
    let top = event.clientY;
    if (top + menuRect.height > windowHeight) {
      top = windowHeight - menuRect.height - 5; // 5px margin
    }
    
    // Apply adjusted position
    contextMenu.style.left = `${left}px`;
    contextMenu.style.top = `${top}px`;
    
    // Store current context
    this.contextMenuData = { button, position };
  }

  async handleContextMenuAction(action) {
    const { button, position } = this.contextMenuData;

    switch (action) {
      case 'add-sound':
        this.showAddSoundDialog(position);
        break;
      case 'add-navigate':
        this.showAddNavigateDialog(position);
        break;
      case 'edit':
        if (button) {
          if (button.type === 'sound') {
            this.showAddSoundDialog(position, button);
          } else {
            this.showAddNavigateDialog(position, button);
          }
        }
        break;
      case 'edit-sound':
        if (button && button.type === 'sound') {
          this.showEditSoundDialog(position, button);
        }
        break;
      case 'delete':
        if (button) {
          const deletedButton = this.config.removeButton(this.currentGrid, position);
          
          // Delete associated files
          if (deletedButton) {
            if (deletedButton.audioFile) {
              try {
                await this.ipcRenderer.invoke('delete-file', deletedButton.audioFile);
              } catch (error) {
                console.error('Failed to delete audio file:', error);
              }
            }
            if (deletedButton.image) {
              try {
                await this.ipcRenderer.invoke('delete-file', deletedButton.image);
              } catch (error) {
                console.error('Failed to delete image file:', error);
              }
            }
          }
          
          this.renderGrid(this.config.getGrid(this.currentGrid));
          this.updateStreamDecks();
        }
        break;
      case 'copy':
        if (button) {
          this.copiedButton = JSON.parse(JSON.stringify(button));
        }
        break;
      case 'paste':
        if (this.copiedButton) {
          const newButton = JSON.parse(JSON.stringify(this.copiedButton));
          newButton.position = position;
          this.config.addButton(this.currentGrid, newButton);
          this.copiedButton = null; // Clear clipboard after paste
          this.renderGrid(this.config.getGrid(this.currentGrid));
          this.updateStreamDecks();
        }
        break;
    }
  }

  showAddSoundDialog(position, existingButton = null) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = existingButton ? 'Edit Sound Button' : 'Add Sound Button';
    
    // Store for later use in save
    this.editingButton = existingButton;
    
    // Get current hotkey and audio settings
    const currentHotkey = this.getHotkeyForPosition(position);
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Label</label>
        <input type="text" id="button-label" value="${existingButton?.label || ''}" placeholder="Button name">
      </div>
      <div class="form-group">
        <label>Hotkey (optional)</label>
        <input type="text" id="button-hotkey" value="${currentHotkey || ''}" placeholder="Press a key combination" readonly>
        <small>Click and press desired key combination (e.g., Ctrl+Shift+A, F5, Alt+1)</small>
      </div>
      <div class="form-group">
        <label>Audio File</label>
        <input type="file" id="audio-file" accept=".mp3,.wav,.mp4">
        <small>${existingButton?.audioFile || 'Select an MP3, WAV, or MP4 file'}</small>
      </div>
      <div class="form-group">
        <label>Image (optional)</label>
        <input type="file" id="button-image" accept="image/*">
        <small>${existingButton?.image || 'Select an image for the button'}</small>
      </div>
      <div class="form-group">
        <label>Description (optional)</label>
        <textarea id="button-description" placeholder="Button description">${existingButton?.description || ''}</textarea>
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="save-sound-btn">Save</button>
      </div>
    `;

    modal.classList.remove('hidden');
    
    // Set up hotkey capture
    const hotkeyInput = document.getElementById('button-hotkey');
    hotkeyInput.addEventListener('keydown', (e) => {
      e.preventDefault();
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      
      // Get the actual key (not the modifier)
      if (!['Control', 'Alt', 'Shift'].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
        hotkeyInput.value = parts.join('+');
      }
    });
    
    // Add event listeners for buttons
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('save-sound-btn').addEventListener('click', () => this.saveSoundButton(position));
  }

  showAddNavigateDialog(position, existingButton = null) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = existingButton ? 'Edit Navigation Button' : 'Add Navigation Button';
    
    // Store for later use in save
    this.editingButton = existingButton;
    
    // Get current hotkey for this position
    const currentHotkey = this.getHotkeyForPosition(position);
    
    const config = this.config.getConfig();
    const gridOptions = Object.entries(config.grids)
      .map(([id, grid]) => `<option value="${id}" ${existingButton?.targetGrid === id ? 'selected' : ''}>${grid.name}</option>`)
      .join('');

    modalBody.innerHTML = `
      <div class="form-group">
        <label>Label</label>
        <input type="text" id="button-label" value="${existingButton?.label || ''}" placeholder="Button name">
      </div>
      <div class="form-group">
        <label>Hotkey (optional)</label>
        <input type="text" id="button-hotkey" value="${currentHotkey || ''}" placeholder="Press a key combination" readonly>
        <small>Click and press desired key combination (e.g., Ctrl+Shift+A, F5, Alt+1)</small>
      </div>
      <div class="form-group">
        <label>Target Grid</label>
        <select id="target-grid">
          <option value="__create_new__">➕ Create New Grid...</option>
          ${gridOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Image (optional)</label>
        <input type="file" id="button-image" accept="image/*">
        <small>${existingButton?.image || 'Select an image for the button'}</small>
      </div>
      <div class="form-group">
        <label>Description (optional)</label>
        <textarea id="button-description" placeholder="Button description">${existingButton?.description || ''}</textarea>
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="save-navigate-btn">Save</button>
      </div>
    `;

    modal.classList.remove('hidden');
    
    // Set up hotkey capture
    const hotkeyInput = document.getElementById('button-hotkey');
    hotkeyInput.addEventListener('keydown', (e) => {
      e.preventDefault();
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      
      // Get the actual key (not the modifier)
      if (!['Control', 'Alt', 'Shift'].includes(e.key)) {
        parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
        hotkeyInput.value = parts.join('+');
      }
    });
    
    // Add event listeners for buttons
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('save-navigate-btn').addEventListener('click', () => this.saveNavigateButton(position));
  }

  async saveSoundButton(position) {
    const label = document.getElementById('button-label').value;
    const hotkey = document.getElementById('button-hotkey').value.trim();
    const audioFileInput = document.getElementById('audio-file');
    const imageInput = document.getElementById('button-image');
    const description = document.getElementById('button-description').value;
    const saveBtn = document.getElementById('save-sound-btn');

    let audioFile = this.editingButton?.audioFile;
    if (audioFileInput.files.length > 0) {
      try {
        const ext = require('path').extname(audioFileInput.files[0].name).toLowerCase();
        
        // Show loading state for MP4 conversion
        if (ext === '.mp4') {
          saveBtn.disabled = true;
          saveBtn.textContent = 'Converting MP4...';
        }
        
        // Copy the audio file to app's audio library
        audioFile = await this.ipcRenderer.invoke('copy-audio-file', audioFileInput.files[0].path);
        
        console.log('Copied audio file, relative path:', audioFile);
        
        // Immediately verify we can resolve and access the file
        const resolvedPath = this.resolvePath(audioFile);
        console.log('Resolved to absolute path:', resolvedPath);
        
        const fs = require('fs');
        if (!fs.existsSync(resolvedPath)) {
          throw new Error('File was copied but cannot be found at expected location: ' + resolvedPath);
        }
        console.log('File exists and is accessible');
        
        // Validate the audio file can be read (especially for converted MP4s)
        if (ext === '.mp4') {
          saveBtn.textContent = 'Validating...';
          try {
            await this.ipcRenderer.invoke('validate-audio-file', audioFile);
            console.log('Audio file validation passed');
          } catch (validationError) {
            console.error('Audio file validation failed:', validationError);
            throw new Error('Converted audio file is invalid or corrupted');
          }
        }
        
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      } catch (error) {
        console.error('Failed to copy audio file:', error);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
        alert('Failed to process audio file: ' + error.message);
        return;
      }
    }

    if (!audioFile) {
      alert('Please select an audio file');
      return;
    }

    const button = {
      position,
      type: 'sound',
      label: label || undefined,
      audioFile,
      description: description || undefined,
      audioSettings: this.editingButton?.audioSettings || {
        volume: 1.0,
        rate: 1.0,
        trimStart: 0,
        trimEnd: null
      }
    };

    if (imageInput.files.length > 0) {
      try {
        button.image = await this.ipcRenderer.invoke('copy-image-file', imageInput.files[0].path);
      } catch (error) {
        console.error('Failed to copy image:', error);
      }
    } else if (this.editingButton?.image) {
      button.image = this.editingButton.image;
    }

    this.config.addButton(this.currentGrid, button);
    
    // Save hotkey override
    const grid = this.config.getGrid(this.currentGrid);
    const key = `${position[0]},${position[1]}`;
    if (hotkey) {
      if (!grid.hotkeyOverrides) grid.hotkeyOverrides = {};
      grid.hotkeyOverrides[key] = [hotkey];
    } else {
      // Remove override if hotkey is empty
      if (grid.hotkeyOverrides && grid.hotkeyOverrides[key]) {
        delete grid.hotkeyOverrides[key];
      }
    }
    this.config.updateGrid(this.currentGrid, grid);
    
    this.editingButton = null;
    this.renderGrid(this.config.getGrid(this.currentGrid));
    this.registerHotkeys(this.currentGrid);
    this.updateStreamDecks();
    this.closeModal();
  }

  async showEditSoundDialog(position, button) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = 'Edit Sound Settings';
    
    const audioSettings = button.audioSettings || {};
    const volume = audioSettings.volume !== undefined ? audioSettings.volume : 1.0;
    const rate = audioSettings.rate !== undefined ? audioSettings.rate : 1.0;
    const trimStart = audioSettings.trimStart || 0;
    const trimEnd = audioSettings.trimEnd || 0;
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label style="font-weight: 600; margin-bottom: 10px; display: block;">Button: ${button.label || 'Untitled'}</label>
        <small style="opacity: 0.7;">Editing audio settings for this sound button</small>
      </div>
      <div class="form-group">
        <label>Volume: <span id="audio-volume-value">${Math.round(volume * 100)}%</span></label>
        <input type="range" id="audio-volume" min="0" max="300" value="${volume * 100}" style="width: 100%;">
        <small>Adjust this sound's volume (0-300%, independent of master volume)</small>
      </div>
      <div class="form-group">
        <label>Playback Rate: <span id="audio-rate-value">${rate}x</span></label>
        <input type="range" id="audio-rate" min="0.5" max="2" step="0.1" value="${rate}" style="width: 100%;">
        <small>Change speed/pitch (0.5x = slower/lower, 2x = faster/higher)</small>
      </div>
      <div class="form-group">
        <label>Trim Start (seconds): <span id="trim-start-value">${trimStart}s</span></label>
        <input type="range" id="trim-start" min="0" max="60" step="0.1" value="${trimStart}" style="width: 100%;" disabled>
        <small>Skip the beginning of the audio (loading duration...)</small>
      </div>
      <div class="form-group">
        <label>Trim End (seconds): <span id="trim-end-value">${trimEnd > 0 ? trimEnd + 's' : 'Full length'}</span></label>
        <input type="range" id="trim-end" min="0" max="60" step="0.1" value="${trimEnd}" style="width: 100%;" disabled>
        <small>Cut off at this time (0 = play until end)</small>
      </div>
      <div class="button-group" style="margin-top: 20px;">
        <button type="button" class="btn btn-secondary" id="test-audio-btn">🔊 Test Sound</button>
        <div style="flex: 1;"></div>
        <button class="btn btn-secondary" id="cancel-btn">Cancel</button>
        <button class="btn btn-primary" id="save-edit-sound-btn">Save</button>
      </div>
    `;

    modal.classList.remove('hidden');
    
    // Load audio duration
    const trimStartSlider = document.getElementById('trim-start');
    const trimEndSlider = document.getElementById('trim-end');
    
    console.log('Loading audio duration for:', button.audioFile);
    console.log('Trim start slider max before:', trimStartSlider.max);
    
    await this.loadAudioDuration(button.audioFile, trimStartSlider, trimEndSlider);
    
    console.log('Trim start slider max after:', trimStartSlider.max);
    
    // Set up audio settings sliders
    const volumeSlider = document.getElementById('audio-volume');
    const volumeValue = document.getElementById('audio-volume-value');
    volumeSlider.addEventListener('input', (e) => {
      volumeValue.textContent = e.target.value + '%';
    });
    
    const rateSlider = document.getElementById('audio-rate');
    const rateValue = document.getElementById('audio-rate-value');
    rateSlider.addEventListener('input', (e) => {
      rateValue.textContent = parseFloat(e.target.value).toFixed(1) + 'x';
    });
    
    const trimStartValue = document.getElementById('trim-start-value');
    trimStartSlider.addEventListener('input', (e) => {
      trimStartValue.textContent = parseFloat(e.target.value).toFixed(1) + 's';
    });
    
    const trimEndValue = document.getElementById('trim-end-value');
    trimEndSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      trimEndValue.textContent = val > 0 ? val.toFixed(1) + 's' : 'Full length';
    });
    
    // Test audio button
    document.getElementById('test-audio-btn').addEventListener('click', () => {
      const settings = {
        volume: parseFloat(volumeSlider.value) / 100,
        rate: parseFloat(rateSlider.value),
        trimStart: parseFloat(trimStartSlider.value),
        trimEnd: parseFloat(trimEndSlider.value) || null
      };
      this.audio.play(button.audioFile, settings);
    });
    
    // Add event listeners for buttons
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('save-edit-sound-btn').addEventListener('click', () => {
      this.saveEditedSound(position, button);
    });
  }

  saveEditedSound(position, button) {
    const volumeSlider = document.getElementById('audio-volume');
    const rateSlider = document.getElementById('audio-rate');
    const trimStartSlider = document.getElementById('trim-start');
    const trimEndSlider = document.getElementById('trim-end');
    
    const audioVolume = parseFloat(volumeSlider.value) / 100;
    const audioRate = parseFloat(rateSlider.value);
    const trimStart = parseFloat(trimStartSlider.value);
    const trimEnd = parseFloat(trimEndSlider.value);
    
    // Update button's audio settings
    button.audioSettings = {
      volume: audioVolume,
      rate: audioRate,
      trimStart: trimStart,
      trimEnd: trimEnd > 0 ? trimEnd : null
    };
    
    // Save to config
    const grid = this.config.getGrid(this.currentGrid);
    const existingButton = grid.buttons.find(
      b => b.position[0] === position[0] && b.position[1] === position[1]
    );
    if (existingButton) {
      existingButton.audioSettings = button.audioSettings;
      this.config.updateGrid(this.currentGrid, grid);
    }
    
    this.renderGrid(grid);
    this.closeModal();
  }

  async saveNavigateButton(position) {
    const label = document.getElementById('button-label').value;
    const hotkey = document.getElementById('button-hotkey').value.trim();
    let targetGrid = document.getElementById('target-grid').value;
    const imageInput = document.getElementById('button-image');
    const description = document.getElementById('button-description').value;

    // Handle "Create New Grid" option
    if (targetGrid === '__create_new__') {
      // Temporarily close this modal and show the create grid dialog
      this.closeModal();
      
      // Import the app instance to call showAddGridDialog
      if (typeof app !== 'undefined' && app.showAddGridDialog) {
        app.showAddGridDialog();
      }
      return;
    }

    const button = {
      position,
      type: 'navigate',
      label: label || undefined,
      targetGrid,
      description: description || undefined
    };

    if (imageInput.files.length > 0) {
      try {
        button.image = await this.ipcRenderer.invoke('copy-image-file', imageInput.files[0].path);
      } catch (error) {
        console.error('Failed to copy image:', error);
      }
    } else if (this.editingButton?.image) {
      button.image = this.editingButton.image;
    }

    this.config.addButton(this.currentGrid, button);
    
    // Save hotkey override
    const grid = this.config.getGrid(this.currentGrid);
    const key = `${position[0]},${position[1]}`;
    if (hotkey) {
      if (!grid.hotkeyOverrides) grid.hotkeyOverrides = {};
      grid.hotkeyOverrides[key] = [hotkey];
    } else {
      // Remove override if hotkey is empty
      if (grid.hotkeyOverrides && grid.hotkeyOverrides[key]) {
        delete grid.hotkeyOverrides[key];
      }
    }
    this.config.updateGrid(this.currentGrid, grid);
    
    this.editingButton = null;
    this.renderGrid(this.config.getGrid(this.currentGrid));
    this.registerHotkeys(this.currentGrid);
    this.updateStreamDecks();
    this.closeModal();
  }

  closeModal() {
    document.getElementById('modal').classList.add('hidden');
  }

  setupDragAndDrop() {
    const gridContainer = document.getElementById('grid-container');
    
    gridContainer.addEventListener('dragover', (e) => {
      // Only handle external file drops (not button drags)
      if (e.dataTransfer.types.includes('Files') && !e.dataTransfer.types.includes('text/plain')) {
        if (this.isLocked) {
          return; // Don't allow file drops when locked
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });

    gridContainer.addEventListener('drop', async (e) => {
      // Only handle external file drops (not button drags)
      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) {
        return;
      }
      
      e.preventDefault();
      
      if (this.isLocked) {
        return; // Don't allow file drops when locked
      }
      
      const files = Array.from(e.dataTransfer.files);
      const audioFiles = files.filter(f => 
        f.name.endsWith('.mp3') || f.name.endsWith('.wav')
      );

      if (audioFiles.length > 0) {
        await this.showDropImportDialog(audioFiles);
      }
    });
  }

  async showDropImportDialog(audioFiles) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = `Import ${audioFiles.length} Sound${audioFiles.length > 1 ? 's' : ''}`;
    
    const grid = this.config.getGrid(this.currentGrid);
    const existingPositions = new Set(
      grid.buttons.map(b => `${b.position[0]},${b.position[1]}`)
    );
    
    // Find first available positions
    const availablePositions = [];
    for (let row = 0; row < grid.rows && availablePositions.length < audioFiles.length; row++) {
      for (let col = 0; col < grid.columns && availablePositions.length < audioFiles.length; col++) {
        if (!existingPositions.has(`${row},${col}`)) {
          availablePositions.push([row, col]);
        }
      }
    }

    if (availablePositions.length < audioFiles.length) {
      console.warn(`Only ${availablePositions.length} empty slots available. Some files won't be imported.`);
    }

    const filesToImport = audioFiles.slice(0, availablePositions.length);
    
    modalBody.innerHTML = `
      <div class="form-group">
        <p>Importing ${filesToImport.length} audio file(s) to the first available positions:</p>
        <ul style="max-height: 200px; overflow-y: auto; margin: 10px 0;">
          ${filesToImport.map((f, i) => `
            <li style="margin: 5px 0;">
              <strong>${f.name}</strong> → Position [${availablePositions[i][0]}, ${availablePositions[i][1]}]
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" id="cancel-import">Cancel</button>
        <button class="btn btn-primary" id="confirm-import">Import</button>
      </div>
    `;

    modal.classList.remove('hidden');
    
    document.getElementById('cancel-import').addEventListener('click', () => this.closeModal());
    document.getElementById('confirm-import').addEventListener('click', async () => {
      await this.importDroppedFiles(filesToImport, availablePositions);
      this.closeModal();
    });
  }

  async importDroppedFiles(audioFiles, positions) {
    for (let i = 0; i < audioFiles.length; i++) {
      const file = audioFiles[i];
      const position = positions[i];
      
      try {
        // Copy the audio file
        const audioFile = await this.ipcRenderer.invoke('copy-audio-file', file.path);
        
        // Create button with filename as label
        const button = {
          position,
          type: 'sound',
          label: file.name.replace(/\.(mp3|wav)$/i, ''), // Remove extension
          audioFile
        };
        
        this.config.addButton(this.currentGrid, button);
      } catch (error) {
        console.error(`Failed to import ${file.name}:`, error);
      }
    }
    
    // Re-render grid with new buttons
    this.renderGrid(this.config.getGrid(this.currentGrid));
    this.updateStreamDecks();
  }

  toggleLock() {
    this.isLocked = !this.isLocked;
    const grid = this.config.getGrid(this.currentGrid);
    if (grid) {
      this.renderGrid(grid);
    }
    return this.isLocked;
  }

  async updateStreamDecks() {
    // Debounce to prevent rapid-fire updates
    if (this.updateStreamDecksTimeout) {
      clearTimeout(this.updateStreamDecksTimeout);
    }
    
    this.updateStreamDecksTimeout = setTimeout(async () => {
      try {
        await this.ipcRenderer.invoke('update-streamdecks');
      } catch (error) {
        console.error('Error updating Stream Decks:', error);
      }
    }, 100); // Wait 100ms after last call
  }

  // Stream Deck Frame Management
  updateStreamDeckFrames() {
    // Remove existing frames
    this.streamDeckFrames.forEach(frame => {
      if (frame.element && frame.element.parentNode) {
        frame.element.parentNode.removeChild(frame.element);
      }
    });
    this.streamDeckFrames = [];

    const config = this.config.getConfig();
    if (!config.settings.showStreamDeckFrames) {
      return;
    }

    const streamDecks = this.config.getStreamDecks();
    const grid = this.config.getGrid(this.currentGrid);
    if (!grid) return;
    
    streamDecks.forEach(streamDeck => {
      const savedPosition = grid.streamDeckPositions && grid.streamDeckPositions[streamDeck.id];
      const position = savedPosition || { row: 0, col: 0 };

      const frame = this.createStreamDeckFrame(streamDeck, position);
      this.streamDeckFrames.push(frame);
      this.gridElement.parentElement.appendChild(frame.element);
    });
  }

  createStreamDeckFrame(streamDeck, position) {
    const frame = document.createElement('div');
    frame.className = 'streamdeck-frame';
    frame.dataset.streamdeckId = streamDeck.id;
    frame.dataset.rows = streamDeck.rows;
    frame.dataset.columns = streamDeck.columns;
    
    // Position frame based on grid coordinates
    this.positionFrame(frame, position);
    
    // Add title bar (always present but transparent until dragging)
    const titleBar = document.createElement('div');
    titleBar.className = 'streamdeck-frame-title';
    titleBar.textContent = streamDeck.name;
    frame.appendChild(titleBar);
    
    // Add draggable border overlays
    const borderSize = 15;
    const borders = ['top', 'right', 'bottom', 'left'];
    borders.forEach(side => {
      const border = document.createElement('div');
      border.className = 'streamdeck-drag-border';
      border.style.position = 'absolute';
      border.style.pointerEvents = 'auto';
      border.style.cursor = 'move';
      border.style.zIndex = '100';
      
      if (side === 'top') {
        border.style.top = `-${borderSize}px`;
        border.style.left = '0';
        border.style.right = '0';
        border.style.height = borderSize + 'px';
      } else if (side === 'bottom') {
        border.style.bottom = `-${borderSize}px`;
        border.style.left = '0';
        border.style.right = '0';
        border.style.height = borderSize + 'px';
      } else if (side === 'left') {
        border.style.left = `-${borderSize}px`;
        border.style.top = '0';
        border.style.bottom = '0';
        border.style.width = borderSize + 'px';
      } else if (side === 'right') {
        border.style.right = `-${borderSize}px`;
        border.style.top = '0';
        border.style.bottom = '0';
        border.style.width = borderSize + 'px';
      }
      
      frame.appendChild(border);
    });
    
    // Make frame draggable
    this.makeFrameDraggable(frame, streamDeck);
    
    return {
      element: frame,
      streamDeck: streamDeck,
      position: position
    };
  }
  
  positionFrame(frameElement, position) {
    const rows = parseInt(frameElement.dataset.rows);
    const columns = parseInt(frameElement.dataset.columns);
    
    // Find the target button at the position
    const targetButton = this.gridElement.querySelector(
      `[data-row="${position.row}"][data-col="${position.col}"]`
    );
    
    if (!targetButton) return;
    
    const buttonRect = targetButton.getBoundingClientRect();
    const containerRect = this.gridElement.parentElement.getBoundingClientRect();
    const buttonSize = buttonRect.width;
    const gap = 10;
    const padding = 5;
    
    // Calculate frame dimensions
    const width = columns * buttonSize + (columns - 1) * gap + (padding * 2);
    const height = rows * buttonSize + (rows - 1) * gap + (padding * 2);
    
    frameElement.style.width = width + 'px';
    frameElement.style.height = height + 'px';
    frameElement.style.left = (buttonRect.left - containerRect.left - padding) + 'px';
    frameElement.style.top = (buttonRect.top - containerRect.top - padding) + 'px';
  }

  makeFrameDraggable(frameElement, streamDeck) {
    let isDragging = false;
    let grabOffsetX = 0;
    let grabOffsetY = 0;
    const streamDeckId = streamDeck.id;
    
    const borders = frameElement.querySelectorAll('.streamdeck-drag-border');
    
    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      // Calculate where frame's top-left should be
      const containerRect = this.gridElement.parentElement.getBoundingClientRect();
      const frameLeft = e.clientX - containerRect.left - grabOffsetX;
      const frameTop = e.clientY - containerRect.top - grabOffsetY;
      
      frameElement.style.left = frameLeft + 'px';
      frameElement.style.top = frameTop + 'px';
    };
    
    const onMouseUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      frameElement.style.opacity = '0.5';
      const titleBar = frameElement.querySelector('.streamdeck-frame-title');
      if (titleBar) titleBar.classList.remove('visible');
      
      // Find closest valid grid position using frame's top-left
      const containerRect = this.gridElement.parentElement.getBoundingClientRect();
      const frameTopLeftX = e.clientX - grabOffsetX;
      const frameTopLeftY = e.clientY - grabOffsetY;
      
      let closestButton = null;
      let closestDistance = Infinity;
      const grid = this.config.getGrid(this.currentGrid);
      
      this.gridElement.querySelectorAll('.grid-button').forEach(button => {
        const row = parseInt(button.dataset.row);
        const col = parseInt(button.dataset.col);
        
        // Check if frame would fit within grid bounds
        if (row + streamDeck.rows > grid.rows || col + streamDeck.columns > grid.columns) {
          return;
        }
        
        const buttonRect = button.getBoundingClientRect();
        
        const distance = Math.sqrt(
          Math.pow(frameTopLeftX - buttonRect.left, 2) +
          Math.pow(frameTopLeftY - buttonRect.top, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestButton = { row, col };
        }
      });
      
      if (closestButton) {
        // Snap to grid position
        this.positionFrame(frameElement, closestButton);
        
        // Save position
        this.config.updateStreamDeckPosition(this.currentGrid, streamDeckId, closestButton);
        this.updateStreamDecks();
      }
      
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    
    borders.forEach(border => {
      border.addEventListener('mousedown', (e) => {
        isDragging = true;
        
        // Calculate offset from mouse to frame's top-left
        const frameRect = frameElement.getBoundingClientRect();
        grabOffsetX = e.clientX - frameRect.left;
        grabOffsetY = e.clientY - frameRect.top;
        
        frameElement.style.opacity = '1';
        const titleBar = frameElement.querySelector('.streamdeck-frame-title');
        if (titleBar) titleBar.classList.add('visible');
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        e.preventDefault();
        e.stopPropagation();
      });
    });
  }
  
  async loadAudioDuration(audioPath, trimStartSlider, trimEndSlider) {
    console.log('loadAudioDuration called with:', audioPath);
    console.log('Howl available?', typeof Howl !== 'undefined');
    
    // Resolve the audio path (same as AudioManager does)
    const path = require('path');
    const fs = require('fs');
    let resolvedPath = audioPath;
    if (!path.isAbsolute(audioPath)) {
      const userDataPath = await this.ipcRenderer.invoke('get-user-data-path');
      // Convert forward slashes to platform-specific separators
      const normalizedRelative = audioPath.replace(/\//g, path.sep);
      resolvedPath = path.join(userDataPath, normalizedRelative);
    }
    
    console.log('Resolved path:', resolvedPath);
    
    // Verify file exists before trying to load
    if (!fs.existsSync(resolvedPath)) {
      console.error('Audio file does not exist:', resolvedPath);
      throw new Error('Audio file not found: ' + resolvedPath);
    }
    
    return new Promise((resolve) => {
      // Use Howler to load audio since it works in Electron
      // Use Web Audio API for gain control
      const sound = new Howl({
        src: [resolvedPath],
        preload: true,
        html5: false,
        onload: function() {
          const duration = sound.duration();
          console.log('Audio loaded, duration:', duration);
          
          // Set max values based on actual duration
          trimStartSlider.max = duration;
          trimEndSlider.max = duration;
          
          console.log('Set slider max to:', duration);
          console.log('Slider max is now:', trimStartSlider.max);
          
          // Enable the sliders
          trimStartSlider.disabled = false;
          trimEndSlider.disabled = false;
          
          // Update small text to show duration
          const trimStartSmall = trimStartSlider.parentElement.querySelector('small');
          const trimEndSmall = trimEndSlider.parentElement.querySelector('small');
          if (trimStartSmall) {
            trimStartSmall.textContent = `Skip the beginning of the audio (max: ${duration.toFixed(1)}s)`;
          }
          if (trimEndSmall) {
            trimEndSmall.textContent = `Cut off at this time (0 = play until end, max: ${duration.toFixed(1)}s)`;
          }
          
          // Update display if values exceed duration
          const trimStartValue = document.getElementById('trim-start-value');
          const trimEndValue = document.getElementById('trim-end-value');
          if (trimStartValue && parseFloat(trimStartSlider.value) > duration) {
            trimStartSlider.value = 0;
            trimStartValue.textContent = '0s';
          }
          if (trimEndValue && parseFloat(trimEndSlider.value) > duration) {
            trimEndSlider.value = 0;
            trimEndValue.textContent = 'Full length';
          }
          
          // Unload the sound to free memory
          sound.unload();
          resolve(duration);
        },
        onloaderror: function(id, err) {
          console.error('Failed to load audio metadata:', err);
          // Enable sliders anyway with default max
          trimStartSlider.disabled = false;
          trimEndSlider.disabled = false;
          const trimStartSmall = trimStartSlider.parentElement.querySelector('small');
          const trimEndSmall = trimEndSlider.parentElement.querySelector('small');
          if (trimStartSmall) {
            trimStartSmall.textContent = 'Skip the beginning of the audio';
          }
          if (trimEndSmall) {
            trimEndSmall.textContent = 'Cut off at this time (0 = play until end)';
          }
          resolve(null);
        }
      });
    });
  }
  
  // Reposition frames when window is resized
  repositionFrames() {
    this.streamDeckFrames.forEach(frame => {
      const streamDeckId = frame.element.dataset.streamdeckId;
      const grid = this.config.getGrid(this.currentGrid);
      if (!grid || !grid.streamDeckPositions) return;
      
      const position = grid.streamDeckPositions[streamDeckId];
      if (position) {
        this.positionFrame(frame.element, position);
      }
    });
  }
}

// Don't export in browser context, just make it available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridManager;
}
