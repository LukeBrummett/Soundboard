const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const { exec } = require('child_process');
const execPromise = promisify(exec);
const ConfigManager = require('../common/config.js');
const StreamDeckManager = require('./streamdeck-manager.js');

// Get bundled ffmpeg path (will be null if not installed)
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = 'ffmpeg'; // Fall back to system ffmpeg
}

const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

let mainWindow;
let configManager;
let streamDeckManager;

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

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Register DevTools toggle (Ctrl+Shift+I only)
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize config manager with config path (main process)
  const configPath = path.join(app.getPath('userData'), 'config.json');
  configManager = new ConfigManager(configPath);
  await configManager.init();
  
  createWindow();
  
  // Initialize Stream Deck manager after window is created
  streamDeckManager = new StreamDeckManager(mainWindow, configManager);
  await streamDeckManager.init();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', async (event) => {
  if (streamDeckManager) {
    event.preventDefault();
    await streamDeckManager.close();
    streamDeckManager = null;
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
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
    // Convert key format if needed (e.g., 'Ctrl+1' -> 'CommandOrControl+1')
    const electronKey = key.replace('Ctrl+', 'CommandOrControl+');
    try {
      globalShortcut.register(electronKey, () => {
        if (mainWindow) {
          mainWindow.webContents.send('hotkey-pressed', position);
        }
      });
    } catch (error) {
      console.error(`Failed to register hotkey ${electronKey}:`, error);
    }
  });
});

ipcMain.handle('get-config-path', () => {
  return path.join(app.getPath('userData'), 'config.json');
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('copy-audio-file', async (event, sourcePath) => {
  try {
    const audioDir = path.join(app.getPath('userData'), 'audio');
    
    // Create audio directory if it doesn't exist
    if (!fs.existsSync(audioDir)) {
      await mkdir(audioDir, { recursive: true });
    }
    
    const ext = path.extname(sourcePath).toLowerCase();
    const baseName = path.basename(sourcePath, ext);
    const timestamp = Date.now();
    
    // If it's MP4, convert to MP3
    if (ext === '.mp4') {
      const uniqueName = `${baseName}_${timestamp}.mp3`;
      const destPath = path.join(audioDir, uniqueName);
      
      console.log(`Converting MP4 to MP3: ${sourcePath} -> ${destPath}`);
      
      // Use bundled ffmpeg to convert MP4 to MP3 with better error handling
      try {
        // More compatible MP3 encoding settings
        const ffmpegCommand = `"${ffmpegPath}" -y -i "${sourcePath}" -vn -acodec libmp3lame -ar 44100 -ac 2 -b:a 192k -f mp3 "${destPath}"`;
        console.log('Running ffmpeg command:', ffmpegCommand);
        
        const { stdout, stderr } = await execPromise(ffmpegCommand, { 
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large files
        });
        
        console.log('ffmpeg stdout:', stdout);
        if (stderr) console.log('ffmpeg stderr:', stderr);
        
        // Wait longer for file system to fully write and release the file
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify the file exists and has size
        if (!fs.existsSync(destPath)) {
          throw new Error('Converted file was not created');
        }
        
        const stats = fs.statSync(destPath);
        if (stats.size === 0) {
          throw new Error('Converted file is empty');
        }
        
        // Try to open and close the file to ensure it's not locked
        try {
          const fd = fs.openSync(destPath, 'r');
          fs.closeSync(fd);
        } catch (e) {
          throw new Error('Converted file is locked or unreadable');
        }
        
        console.log(`Successfully converted MP4 to MP3: ${uniqueName} (${stats.size} bytes)`);
      } catch (error) {
        console.error('ffmpeg conversion failed:', error);
        // Clean up partial file if it exists
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch (e) {
            console.error('Failed to clean up partial file:', e);
          }
        }
        throw new Error(`Failed to convert MP4 to MP3: ${error.message}`);
      }
      
      // Return with forward slashes for consistency across platforms
      return `audio/${uniqueName}`;
    } else {
      // For MP3 and WAV, just copy
      const uniqueName = `${baseName}_${timestamp}${ext}`;
      const destPath = path.join(audioDir, uniqueName);
      await copyFile(sourcePath, destPath);
      
      // Verify the copied file exists and is readable
      if (!fs.existsSync(destPath)) {
        throw new Error('Copied file was not created');
      }
      const stats = fs.statSync(destPath);
      if (stats.size === 0) {
        throw new Error('Copied file is empty');
      }
      console.log(`Successfully copied audio file: ${uniqueName} (${stats.size} bytes)`);
      
      // Return with forward slashes for consistency across platforms
      return `audio/${uniqueName}`;
    }
  } catch (error) {
    console.error('Failed to copy audio file:', error);
    throw error;
  }
});

ipcMain.handle('copy-image-file', async (event, sourcePath) => {
  try {
    const imageDir = path.join(app.getPath('userData'), 'images');
    
    // Create images directory if it doesn't exist
    if (!fs.existsSync(imageDir)) {
      await mkdir(imageDir, { recursive: true });
    }
    
    // Generate unique filename using timestamp + original name
    const ext = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, ext);
    const timestamp = Date.now();
    const uniqueName = `${baseName}_${timestamp}${ext}`;
    const destPath = path.join(imageDir, uniqueName);
    
    // Copy the file
    await copyFile(sourcePath, destPath);
    
    // Verify the copied file exists and is readable
    if (!fs.existsSync(destPath)) {
      throw new Error('Copied image file was not created');
    }
    const stats = fs.statSync(destPath);
    if (stats.size === 0) {
      throw new Error('Copied image file is empty');
    }
    
    // Return relative path with forward slashes for consistency
    return `images/${uniqueName}`;
  } catch (error) {
    console.error('Failed to copy image file:', error);
    throw error;
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('log-to-main', (event, level, ...args) => {
  const prefix = `[RENDERER ${level.toUpperCase()}]`;
  console[level](prefix, ...args);
});

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
    
    // Try to read the file header to ensure it's readable
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
    console.error('Audio file validation failed:', error);
    throw error;
  }
});

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
    console.error('Failed to delete file:', error);
    throw error;
  }
});

ipcMain.handle('update-streamdecks', async () => {
  if (streamDeckManager) {
    // Reload config from disk to get latest changes from renderer
    await configManager.load();
    await streamDeckManager.updateAllDevices();
  }
});

ipcMain.handle('focus-window', () => {
  if (mainWindow) {
    mainWindow.focus();
  }
});

ipcMain.handle('test-streamdeck', async (event, devicePath) => {
  if (streamDeckManager) {
    return await streamDeckManager.testDisplay(devicePath);
  }
  return { success: false, message: 'Stream Deck manager not initialized' };
});

ipcMain.handle('get-connected-streamdecks', async () => {
  if (streamDeckManager) {
    return streamDeckManager.getConnectedDevices();
  }
  return [];
});

ipcMain.handle('reinitialize-streamdeck', async (event, devicePath) => {
  if (streamDeckManager) {
    await streamDeckManager.reinitializeDevice(devicePath);
  }
});
