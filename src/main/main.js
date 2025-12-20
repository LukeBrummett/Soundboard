const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const ConfigManager = require('../common/config.js');
const StreamDeckManager = require('./streamdeck-manager.js');

const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);

let mainWindow;
let configManager;
let streamDeckManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
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

  // Register global Home hotkey (Ctrl+H)
  globalShortcut.register('CommandOrControl+H', () => {
    if (mainWindow) {
      mainWindow.webContents.send('navigate-home');
    }
  });

  // Register global Lock hotkey (Ctrl+L)
  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-lock');
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

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (streamDeckManager) {
    streamDeckManager.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.on('register-hotkeys', (event, hotkeys) => {
  // Unregister all existing hotkeys
  globalShortcut.unregisterAll();
  
  // Re-register Home hotkey
  globalShortcut.register('CommandOrControl+H', () => {
    if (mainWindow) {
      mainWindow.webContents.send('navigate-home');
    }
  });

  // Re-register Lock hotkey
  globalShortcut.register('CommandOrControl+L', () => {
    if (mainWindow) {
      mainWindow.webContents.send('toggle-lock');
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
    
    // Generate unique filename using timestamp + original name
    const ext = path.extname(sourcePath);
    const baseName = path.basename(sourcePath, ext);
    const timestamp = Date.now();
    const uniqueName = `${baseName}_${timestamp}${ext}`;
    const destPath = path.join(audioDir, uniqueName);
    
    // Copy the file
    await copyFile(sourcePath, destPath);
    
    // Return relative path from userData
    return path.join('audio', uniqueName);
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
    
    // Return relative path from userData
    return path.join('images', uniqueName);
  } catch (error) {
    console.error('Failed to copy image file:', error);
    throw error;
  }
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
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
    await streamDeckManager.updateAllDevices();
  }
});
