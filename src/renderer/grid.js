console.log('Loading grid.js...');

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
    
    this.initPaths();
    this.setupEventListeners();
  }

  async initPaths() {
    this.userDataPath = await this.ipcRenderer.invoke('get-user-data-path');
  }

  resolvePath(filePath) {
    if (!filePath) return null;
    const path = require('path');
    // If it's already an absolute path, return it
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    // Otherwise, resolve from userData
    if (this.userDataPath) {
      return path.join(this.userDataPath, filePath);
    }
    return filePath;
  }

  setupEventListeners() {
    // Home button
    document.getElementById('home-btn').addEventListener('click', () => {
      this.navigateToHome();
    });

    // Listen for home hotkey from main process
    this.ipcRenderer.on('navigate-home', () => {
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
    setTimeout(() => this.updateStreamDeckFrames(), 0);
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
      // Play sound
      element.classList.add('playing');
      this.audio.play(button.audioFile);
      setTimeout(() => element.classList.remove('playing'), 500);
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
      hasTopSection = true;
    } else {
      // Empty button - show add options
      editItem.style.display = 'none';
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
    
    modalBody.innerHTML = `
      <div class="form-group">
        <label>Label</label>
        <input type="text" id="button-label" value="${existingButton?.label || ''}" placeholder="Button name">
      </div>
      <div class="form-group">
        <label>Audio File</label>
        <input type="file" id="audio-file" accept=".mp3,.wav">
        <small>${existingButton?.audioFile || 'Select an MP3 or WAV file'}</small>
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
        <label>Target Grid</label>
        <select id="target-grid">
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
    
    // Add event listeners for buttons
    document.getElementById('cancel-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('save-navigate-btn').addEventListener('click', () => this.saveNavigateButton(position));
  }

  async saveSoundButton(position) {
    const label = document.getElementById('button-label').value;
    const audioFileInput = document.getElementById('audio-file');
    const imageInput = document.getElementById('button-image');
    const description = document.getElementById('button-description').value;

    let audioFile = this.editingButton?.audioFile;
    if (audioFileInput.files.length > 0) {
      try {
        // Copy the audio file to app's audio library
        audioFile = await this.ipcRenderer.invoke('copy-audio-file', audioFileInput.files[0].path);
      } catch (error) {
        alert('Failed to copy audio file: ' + error.message);
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
    this.editingButton = null;
    this.renderGrid(this.config.getGrid(this.currentGrid));
    this.closeModal();
  }

  async saveNavigateButton(position) {
    const label = document.getElementById('button-label').value;
    const targetGrid = document.getElementById('target-grid').value;
    const imageInput = document.getElementById('button-image');
    const description = document.getElementById('button-description').value;

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
    this.editingButton = null;
    this.renderGrid(this.config.getGrid(this.currentGrid));
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
      alert(`Only ${availablePositions.length} empty slots available. Some files won't be imported.`);
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
        alert(`Failed to import ${file.name}: ${error.message}`);
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
    try {
      await this.ipcRenderer.invoke('update-streamdecks');
    } catch (error) {
      console.error('Error updating Stream Decks:', error);
    }
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
    
    // Set grid layout for cells
    frame.style.gridTemplateColumns = `repeat(${streamDeck.columns}, 1fr)`;
    frame.style.gridTemplateRows = `repeat(${streamDeck.rows}, 1fr)`;
    
    // Calculate size based on button size
    const buttonElements = this.gridElement.querySelectorAll('.grid-button');
    if (buttonElements.length > 0) {
      const buttonRect = buttonElements[0].getBoundingClientRect();
      const buttonSize = buttonRect.width;
      const gap = 10; // Gap between buttons
      const padding = 5; // Frame padding - reduced to position border in gaps
      const titleHeight = 30; // Title bar height
      
      const width = streamDeck.columns * buttonSize + (streamDeck.columns - 1) * gap + (padding * 2);
      const height = streamDeck.rows * buttonSize + (streamDeck.rows - 1) * gap + (padding * 2);
      
      frame.style.width = width + 'px';
      frame.style.height = height + 'px';
      
      // Position based on grid button positions
      const targetButton = this.gridElement.querySelector(
        `[data-row="${position.row}"][data-col="${position.col}"]`
      );
      if (targetButton) {
        const targetRect = targetButton.getBoundingClientRect();
        const gridRect = this.gridElement.getBoundingClientRect();
        const containerRect = this.gridElement.parentElement.getBoundingClientRect();
        frame.style.left = (targetRect.left - containerRect.left - padding) + 'px';
        frame.style.top = (targetRect.top - containerRect.top - padding) + 'px';
      } else {
        // Default to top-left corner (0,0) if button not found
        const firstButton = this.gridElement.querySelector('[data-row="0"][data-col="0"]');
        if (firstButton) {
          const firstRect = firstButton.getBoundingClientRect();
          const containerRect = this.gridElement.parentElement.getBoundingClientRect();
          frame.style.left = (firstRect.left - containerRect.left - padding) + 'px';
          frame.style.top = (firstRect.top - containerRect.top - padding) + 'px';
        }
      }
    }
    
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
    this.makeFrameDraggable(frame, streamDeck.id);
    
    return {
      element: frame,
      streamDeck: streamDeck,
      position: position
    };
  }

  makeFrameDraggable(frameElement, streamDeckId) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    
    // Add drag handlers to all border elements
    const borders = frameElement.querySelectorAll('.streamdeck-drag-border');
    borders.forEach(border => {
      border.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        const rect = frameElement.getBoundingClientRect();
        const containerRect = this.gridElement.parentElement.getBoundingClientRect();
        startLeft = rect.left - containerRect.left;
        startTop = rect.top - containerRect.top;
        
        frameElement.style.opacity = '1';
        // Get fresh reference to title bar
        const titleBar = frameElement.querySelector('.streamdeck-frame-title');
        if (titleBar) titleBar.classList.add('visible');
        e.preventDefault();
        e.stopPropagation();
      });
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      frameElement.style.left = (startLeft + deltaX) + 'px';
      frameElement.style.top = (startTop + deltaY) + 'px';
    });
    
    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      
      frameElement.style.opacity = '0.5';
      // Get fresh reference to title bar in case frame was recreated
      const titleBar = frameElement.querySelector('.streamdeck-frame-title');
      if (titleBar) titleBar.classList.remove('visible');
      
      // Find closest grid button to snap to (use top-left corner of frame)
      const frameRect = frameElement.getBoundingClientRect();
      const gridRect = this.gridElement.getBoundingClientRect();
      
      // Get frame's top-left relative to grid
      const frameLeft = frameRect.left;
      const frameTop = frameRect.top;
      
      let closestButton = null;
      let closestDistance = Infinity;
      
      this.gridElement.querySelectorAll('.grid-button').forEach(button => {
        const buttonRect = button.getBoundingClientRect();
        
        // Calculate distance from frame's top-left to button's top-left
        const distance = Math.sqrt(
          Math.pow(frameLeft - buttonRect.left, 2) +
          Math.pow(frameTop - buttonRect.top, 2)
        );
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestButton = button;
        }
      });
      
      if (closestButton) {
        const row = parseInt(closestButton.dataset.row);
        const col = parseInt(closestButton.dataset.col);
        
        // Snap to button position
        const buttonRect = closestButton.getBoundingClientRect();
        const containerRect = this.gridElement.parentElement.getBoundingClientRect();
        const padding = 5;
        frameElement.style.left = (buttonRect.left - containerRect.left - padding) + 'px';
        frameElement.style.top = (buttonRect.top - containerRect.top - padding) + 'px';
        
        // Save position
        this.config.updateStreamDeckPosition(this.currentGrid, streamDeckId, { row, col });
      }
    });
  }
}

// Don't export in browser context, just make it available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GridManager;
}
