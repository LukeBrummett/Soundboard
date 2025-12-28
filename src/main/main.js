const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const ConfigManager = require('../common/config.js');
const StreamDeckManager = require('./streamdeck-manager.js');

// File system utilities
const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

// Get bundled ffmpeg path or fall back to system ffmpeg
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = 'ffmpeg';
}

// Application state
let mainWindow;
let configManager;
let streamDeckManager;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 550,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    backgroundColor: '#1a1a1a',
    show: false,
    autoHideMenuBar: true
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Show window when ready (prevents white flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Capture renderer crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('\n=== RENDERER PROCESS CRASHED ===');
    console.error('Reason:', details.reason);
    console.error('Exit code:', details.exitCode);
    console.error('================================\n');
  });

  mainWindow.webContents.on('crashed', (event, killed) => {
    console.error('\n=== RENDERER CRASHED ===');
    console.error('Killed:', killed);
    console.error('========================\n');
  });

  // Register DevTools toggle (Ctrl+Shift+I)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// ==================== Application Lifecycle ====================

/**
 * Initialize application when Electron is ready
 */
app.whenReady().then(async () => {
  // Initialize configuration
  const configPath = path.join(app.getPath('userData'), 'config.json');
  configManager = new ConfigManager(configPath);
  await configManager.init();
  
  // Create main window
  createWindow();
  
  // Initialize Stream Deck manager
  streamDeckManager = new StreamDeckManager(mainWindow, configManager);
  await streamDeckManager.init();

  // Handle macOS activation
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

/**
 * Cleanup before quit - ensure Stream Decks are properly closed
 */
app.on('before-quit', async (event) => {
  if (streamDeckManager) {
    event.preventDefault();
    await streamDeckManager.close();
    streamDeckManager = null;
    app.quit();
  }
});

/**
 * Quit when all windows are closed (except on macOS)
 */
app.on('window-all-closed', async () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==================== IPC Handlers ====================

/**
 * Register global hotkeys for current grid
 */
ipcMain.on('register-hotkeys', (event, hotkeys) => {
  // Unregister all existing hotkeys except DevTools
  globalShortcut.unregisterAll();
  
  // Re-register DevTools hotkey
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  // Register grid-specific hotkeys
  hotkeys.forEach(({ key, position }) => {
    // Convert Ctrl to CommandOrControl for cross-platform compatibility
    const electronKey = key.replace('Ctrl+', 'CommandOrControl+');
    try {
      globalShortcut.register(electronKey, () => {
        if (mainWindow) {
          mainWindow.webContents.send('hotkey-pressed', position);
        }
      });
    } catch (error) {
      // Hotkey registration can fail if key is already registered
    }
  });
});

/**
 * Get the path to the config file
 */
ipcMain.handle('get-config-path', () => {
  return path.join(app.getPath('userData'), 'config.json');
});

/**
 * Get the application installation path
 */
ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

/**
 * Get the user data directory path
 */
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

/**
 * Copy an audio file to the app's audio library
 * Converts MP4 files to MP3 using ffmpeg
 */
ipcMain.handle('copy-audio-file', async (event, sourcePath) => {
  try {
    const audioDir = path.join(app.getPath('userData'), 'audio');
    
    // Create audio directory if needed
    if (!fs.existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }
    
    const ext = path.extname(sourcePath).toLowerCase();
    const baseName = path.basename(sourcePath, ext);
    const timestamp = Date.now();
    
    // Convert MP4 to MP3 using ffmpeg
    if (ext === '.mp4') {
      const uniqueName = `${baseName}_${timestamp}.mp3`;
      const destPath = path.join(audioDir, uniqueName);
      
      // Use ffmpeg to convert with compatible MP3 encoding settings
      const ffmpegCommand = `"${ffmpegPath}" -y -i "${sourcePath}" -vn -acodec libmp3lame -ar 44100 -ac 2 -b:a 192k -f mp3 "${destPath}"`;
      
      const { stdout, stderr } = await execPromise(ffmpegCommand, { 
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large files
      });
      
      // Wait for file system to fully write the file
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify the converted file exists and has content
      if (!fs.existsSync(destPath)) {
        throw new Error('Converted file was not created');
      }
      
      const stats = fs.statSync(destPath);
      if (stats.size === 0) {
        throw new Error('Converted file is empty');
      }
      
      // Test file accessibility
      const fd = fs.openSync(destPath, 'r');
      fs.closeSync(fd);
      
      return `audio/${uniqueName}`;
    } else {
      // For MP3 and WAV, just copy
      const uniqueName = `${baseName}_${timestamp}${ext}`;
      const destPath = path.join(audioDir, uniqueName);
      await copyFile(sourcePath, destPath);
      
      // Verify the copied file
      if (!fs.existsSync(destPath)) {
        throw new Error('Copied file was not created');
      }
      const stats = fs.statSync(destPath);
      if (stats.size === 0) {
        throw new Error('Copied file is empty');
      }
      
      return `audio/${uniqueName}`;
    }
  } catch (error) {
    throw error;
  }
});

/**
 * Copy an image file to the app's image library
 */
ipcMain.handle('copy-image-file', async (event, sourcePath) => {
  try {
    const imageDir = path.join(app.getPath('userData'), 'images');
    
    // Create images directory if needed
    if (!fs.existsSync(imageDir)) {
      await mkdir(imageDir, { recursive: true });
    }
    
    // Generate unique filename
    const ext = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, ext);
    const timestamp = Date.now();
    const uniqueName = `${baseName}_${timestamp}${ext}`;
    const destPath = path.join(imageDir, uniqueName);
    
    // Copy the file
    await copyFile(sourcePath, destPath);
    
    // Verify the copied file
    if (!fs.existsSync(destPath)) {
      throw new Error('Copied image file was not created');
    }
    const stats = fs.statSync(destPath);
    if (stats.size === 0) {
      throw new Error('Copied image file is empty');
    }
    
    return `images/${uniqueName}`;
  } catch (error) {
    throw error;
  }
});

/**
 * Validate an audio file is readable and properly formatted
 */
ipcMain.handle('validate-audio-file', async (event, relativePath) => {
  try {
    const fullPath = path.join(app.getPath('userData'), relativePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error('File does not exist');
    }
    
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
      throw new Error('File is empty');
    }
    
    // Read file header to verify it's an MP3
    const fd = fs.openSync(fullPath, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    
    // Check for valid MP3 header or ID3 tag
    const isMP3 = buffer.toString('utf8', 0, 3) === 'ID3' || 
                   (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0);
    
    if (!isMP3) {
      throw new Error('File does not appear to be a valid MP3');
    }
    
    return { valid: true, size: stats.size };
  } catch (error) {
    throw error;
  }
});

/**
 * Delete a file from the user data directory
 */
ipcMain.handle('delete-file', async (event, relativePath) => {
  try {
    const fullPath = path.join(app.getPath('userData'), relativePath);
    if (fs.existsSync(fullPath)) {
      const unlink = promisify(fs.unlink);
      await unlink(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    throw error;
  }
});

/**
 * Update all connected Stream Decks with current grid state
 */
ipcMain.handle('update-streamdecks', async () => {
  if (streamDeckManager) {
    // Reload config to get latest changes from renderer
    await configManager.load();
    await streamDeckManager.updateAllDevices();
  }
});

/**
 * Focus the main window
 */
ipcMain.handle('focus-window', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});

/**
 * Test a Stream Deck display with a test pattern
 */
ipcMain.handle('test-streamdeck', async (event, devicePath) => {
  if (streamDeckManager) {
    return await streamDeckManager.testDisplay(devicePath);
  }
  return { success: false, message: 'Stream Deck manager not initialized' };
});

/**
 * Get list of connected Stream Deck devices
 */
ipcMain.handle('get-connected-streamdecks', async () => {
  if (streamDeckManager) {
    return streamDeckManager.getConnectedDevices();
  }
  return [];
});

/**
 * Reinitialize a Stream Deck device after configuration
 */
ipcMain.handle('reinitialize-streamdeck', async (event, devicePath) => {
  if (streamDeckManager) {
    await streamDeckManager.reinitializeDevice(devicePath);
  }
});
