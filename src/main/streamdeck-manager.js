const { listStreamDecks, openStreamDeck } = require('@elgato-stream-deck/node');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

class StreamDeckManager {
  constructor(mainWindow, configManager) {
    this.mainWindow = mainWindow;
    this.configManager = configManager;
    this.devices = new Map(); // devicePath -> { device, streamDeckId, config }
    this.scanInterval = null;
    this.animations = new Map(); // devicePath+keyIndex -> { frames, currentFrame, interval }
    this.renderingFlags = new Map(); // Track which keys are currently rendering to prevent overlaps
  }

  async init() {
    console.log('Initializing Stream Deck Manager...');
    await this.scanForDevices();
    
    // Scan every 5 seconds for newly connected devices
    this.scanInterval = setInterval(() => {
      this.scanForDevices();
    }, 5000);
  }

  async scanForDevices() {
    try {
      const connectedDevices = await listStreamDecks();
      
      // Open newly connected devices
      for (const deviceInfo of connectedDevices) {
        if (!this.devices.has(deviceInfo.path)) {
          await this.openDevice(deviceInfo);
        }
      }
      
      // Remove disconnected devices
      const connectedPaths = new Set(connectedDevices.map(d => d.path));
      for (const [devicePath, deviceData] of this.devices.entries()) {
        if (!connectedPaths.has(devicePath)) {
          console.log('Stream Deck disconnected:', devicePath);
          deviceData.device.close();
          this.devices.delete(devicePath);
        }
      }
    } catch (error) {
      console.error('Error scanning for Stream Decks:', error);
    }
  }

  async openDevice(deviceInfo) {
    try {
      const device = await openStreamDeck(deviceInfo.path);
      
      // Get model from the device MODEL property
      const modelName = device.MODEL || deviceInfo.model;
      
      // Find matching config by serial number or model
      const config = this.configManager.getConfig();
      const { getModelByName } = require('../common/streamdeck-models.js');
      const model = getModelByName(modelName);
      
      // Try to find existing Stream Deck config
      let streamDeckConfig = null;
      if (config.streamDecks) {
        streamDeckConfig = config.streamDecks.find(sd => 
          sd.modelId === model?.id && !Array.from(this.devices.values()).find(d => d.streamDeckId === sd.id)
        );
      }
      
      const deviceData = {
        device,
        streamDeckId: streamDeckConfig?.id,
        config: streamDeckConfig,
        deviceInfo: { ...deviceInfo, model: modelName, modelSpec: model }
      };
      
      this.devices.set(deviceInfo.path, deviceData);
      
      // Only interact with the device if it's configured
      if (streamDeckConfig) {
        // Clear all buttons
        device.clearPanel();
        
        // Set up button press handlers
        device.on('down', (keyIndex) => {
          this.handleButtonPress(deviceInfo.path, keyIndex);
        });
        
        // Initial render
        await this.updateDevice(deviceInfo.path);
      }
      
      // Set up error handler regardless of config
      device.on('error', (error) => {
        console.error('Stream Deck error:', error);
      });
      
    } catch (error) {
      console.error('Error opening Stream Deck:', error);
    }
  }

  handleButtonPress(devicePath, keyIndex) {
    const deviceData = this.devices.get(devicePath);
    if (!deviceData || !deviceData.streamDeckId) {
      return;
    }
    
    // Check if window is ready
    if (!this.mainWindow || this.mainWindow.isDestroyed() || !this.mainWindow.webContents) {
      return;
    }
    
    const config = this.configManager.getConfig();
    
    // Try to get current grid, with error handling
    this.mainWindow.webContents.executeJavaScript('app && app.grid && app.grid.currentGrid')
      .then(gridId => {
        // If app isn't ready yet, use home grid
        if (!gridId) {
          gridId = config.settings.homeGrid;
        }
        
        const grid = config.grids[gridId];
        if (!grid || !grid.streamDeckPositions) {
          return;
        }
        
        const framePosition = grid.streamDeckPositions[deviceData.streamDeckId];
        if (!framePosition) {
          return;
        }
        
        // Extract row/col from keyIndex object (or use index if it's a number)
        const sdRow = typeof keyIndex === 'object' ? keyIndex.row : Math.floor(keyIndex / deviceData.config.columns);
        const sdCol = typeof keyIndex === 'object' ? keyIndex.column : keyIndex % deviceData.config.columns;
        
        // Calculate grid position
        const gridRow = framePosition.row + sdRow;
        const gridCol = framePosition.col + sdCol;
        
        // Check if position is within grid bounds
        if (gridRow >= grid.rows || gridCol >= grid.columns) {
          return;
        }
        
        // Trigger button press via renderer
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('streamdeck-button-press', [gridRow, gridCol]);
        }
      })
      .catch(error => {
        // Silently ignore errors when frame is disposed (e.g., during modal transitions)
      });
  }

  async updateDevice(devicePath) {
    const deviceData = this.devices.get(devicePath);
    
    if (!deviceData || !deviceData.streamDeckId) {
      return;
    }
    
    // Stop all animations for this device before updating
    const animationKeys = Array.from(this.animations.keys()).filter(key => key.startsWith(devicePath + '-'));
    animationKeys.forEach(key => this.stopAnimation(key));
    
    try {
      const config = this.configManager.getConfig();
      
      // Get current grid - handle case where app isn't initialized yet
      let currentGrid;
      try {
        currentGrid = await this.mainWindow.webContents.executeJavaScript('app && app.grid && app.grid.currentGrid');
        if (!currentGrid) {
          // App not ready yet, use home grid
          currentGrid = config.settings.homeGrid;
        }
      } catch (error) {
        console.log('App not ready yet, using home grid');
        currentGrid = config.settings.homeGrid;
      }
      
      const grid = config.grids[currentGrid];
      
      if (!grid || !grid.streamDeckPositions) {
        return;
      }
      
      const framePosition = grid.streamDeckPositions[deviceData.streamDeckId];
      
      if (!framePosition) {
        // No frame positioned, clear the device
        deviceData.device.clearPanel();
        return;
      }
      
      const sdConfig = deviceData.config;
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      
      // Render each button
      for (let sdRow = 0; sdRow < sdConfig.rows; sdRow++) {
        for (let sdCol = 0; sdCol < sdConfig.columns; sdCol++) {
          const keyIndex = sdRow * sdConfig.columns + sdCol;
          const gridRow = framePosition.row + sdRow;
          const gridCol = framePosition.col + sdCol;
          
          // Stop any animation for this specific key before rendering
          const animationKey = `${devicePath}-${keyIndex}`;
          this.stopAnimation(animationKey);
          
          // Check if position is within grid bounds
          if (gridRow >= grid.rows || gridCol >= grid.columns) {
            await deviceData.device.fillKeyColor(keyIndex, 0, 0, 0);
            continue;
          }
          
          // Find button at this position
          const button = grid.buttons.find(
            b => b.position[0] === gridRow && b.position[1] === gridCol
          );
          
          if (button && button.image) {
            // Render button image
            const imagePath = path.isAbsolute(button.image) 
              ? button.image 
              : path.join(userDataPath, button.image);
            
            if (fs.existsSync(imagePath)) {
              await this.renderButtonImage(deviceData.device, keyIndex, imagePath, button.label, devicePath);
            } else {
              await this.renderButtonText(deviceData.device, keyIndex, button.label || '');
            }
          } else if (button && button.type === 'navigate') {
            // Navigate button
            await this.renderButtonText(deviceData.device, keyIndex, button.label || '→');
          } else if (button) {
            // Button with no image
            await this.renderButtonText(deviceData.device, keyIndex, button.label || '');
          } else {
            // Empty position
            await deviceData.device.fillKeyColor(keyIndex, 32, 32, 32);
          }
        }
      }
    } catch (error) {
      console.error('Error updating Stream Deck:', error);
    }
  }

  async renderButtonImage(device, keyIndex, imagePath, label, devicePath) {
    try {
      const iconSize = device.ICON_SIZE || 80;
      const ext = path.extname(imagePath).toLowerCase();
      
      // Check if it's a GIF
      if (ext === '.gif') {
        await this.renderAnimatedGif(device, keyIndex, imagePath, iconSize, devicePath);
      } else {
        // Static image
        const imageBuffer = await sharp(imagePath)
          .resize(iconSize, iconSize, { fit: 'cover' })
          .removeAlpha()
          .raw()
          .toBuffer();
        
        await device.fillKeyBuffer(keyIndex, imageBuffer);
      }
    } catch (error) {
      console.error('Error rendering button image:', error);
      // Fallback to text
      await this.renderButtonText(device, keyIndex, label || '?');
    }
  }

  async renderAnimatedGif(device, keyIndex, imagePath, iconSize, devicePath) {
    const animationKey = `${devicePath}-${keyIndex}`;
    
    // Check if already rendering this key to prevent concurrent starts
    if (this.renderingFlags.get(animationKey)) {
      return;
    }
    
    // Set flag IMMEDIATELY before any async work
    this.renderingFlags.set(animationKey, true);
    
    // Stop existing animation for this key
    this.stopAnimation(animationKey);
    
    try {
      // Get GIF metadata to determine number of frames
      const metadata = await sharp(imagePath).metadata();
      const frameCount = metadata.pages || 1;
      
      if (frameCount === 1) {
        // Not animated, render as static
        const imageBuffer = await sharp(imagePath)
          .resize(iconSize, iconSize, { fit: 'cover' })
          .removeAlpha()
          .raw()
          .toBuffer();
        await device.fillKeyBuffer(keyIndex, imageBuffer);
        return;
      }
      
      // Skip frames to improve performance - only use every 2nd or 3rd frame
      const frameSkip = frameCount > 30 ? 3 : (frameCount > 15 ? 2 : 1);
      const framesToExtract = [];
      for (let i = 0; i < frameCount; i += frameSkip) {
        framesToExtract.push(i);
      }
      
      // Limit to max 20 frames for performance
      const maxFrames = 20;
      const finalFrames = framesToExtract.slice(0, maxFrames);
      
      // Extract frames
      const frames = [];
      for (const frameIndex of finalFrames) {
        const frameBuffer = await sharp(imagePath, { page: frameIndex })
          .resize(iconSize, iconSize, { fit: 'cover' })
          .removeAlpha()
          .raw()
          .toBuffer();
        frames.push(frameBuffer);
      }
      
      // Use longer delay for smoother animation (minimum 60ms)
      const baseDelay = (metadata.delay && metadata.delay[0]) || 100;
      const delay = Math.max(60, baseDelay * frameSkip);
      
      // Start animation - always start from frame 0
      const animationData = { frames, currentFrame: 0, interval: null, active: true };
      this.animations.set(animationKey, animationData);
      
      const interval = setInterval(() => {
        const anim = this.animations.get(animationKey);
        if (!anim || !anim.active || !this.devices.has(devicePath)) {
          this.stopAnimation(animationKey);
          return;
        }
        
        device.fillKeyBuffer(keyIndex, frames[anim.currentFrame]).catch(err => {
          console.error('Error updating GIF frame:', err);
          this.stopAnimation(animationKey);
        });
        
        anim.currentFrame = (anim.currentFrame + 1) % frames.length;
      }, delay);
      
      animationData.interval = interval;
      
      // Show first frame immediately
      await device.fillKeyBuffer(keyIndex, frames[0]);
      
    } catch (error) {
      console.error('Error rendering animated GIF:', error);
      throw error;
    } finally {
      this.renderingFlags.delete(animationKey);
    }
  }

  stopAnimation(animationKey) {
    const animation = this.animations.get(animationKey);
    if (animation) {
      animation.active = false;
      if (animation.interval) {
        clearInterval(animation.interval);
      }
      this.animations.delete(animationKey);
    }
    // Don't delete rendering flag here - it's managed by renderAnimatedGif
  }

  stopAllAnimations() {
    for (const [key, animation] of this.animations.entries()) {
      if (animation.interval) {
        clearInterval(animation.interval);
      }
    }
    this.animations.clear();
  }

  async renderButtonText(device, keyIndex, text) {
    try {
      const iconSize = device.ICON_SIZE || 80;
      
      // Determine font size based on text length
      let fontSize = 16;
      let maxCharsPerLine = 8;
      
      if (text.length > 20) {
        fontSize = 10;
        maxCharsPerLine = 12;
      } else if (text.length > 12) {
        fontSize = 12;
        maxCharsPerLine = 10;
      }
      
      // Word wrap text
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (testLine.length <= maxCharsPerLine) {
          currentLine = testLine;
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      
      // Limit to 4 lines
      const displayLines = lines.slice(0, 4);
      
      // Calculate text positioning
      const lineHeight = fontSize + 2;
      const totalHeight = displayLines.length * lineHeight;
      const startY = (iconSize - totalHeight) / 2 + fontSize;
      
      // Create text elements
      const textElements = displayLines.map((line, i) => {
        const y = startY + (i * lineHeight);
        // Escape XML special characters
        const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<text x="50%" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="bold" fill="white" text-anchor="middle">${escapedLine}</text>`;
      }).join('\n');
      
      const svg = `
        <svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${iconSize}" height="${iconSize}" fill="#3b82f6"/>
          ${textElements}
        </svg>
      `;
      
      const imageBuffer = await sharp(Buffer.from(svg))
        .resize(iconSize, iconSize)
        .toFormat('raw')
        .toColorspace('srgb')
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: false });
      
      await device.fillKeyBuffer(keyIndex, imageBuffer);
    } catch (error) {
      console.error('Error rendering button text:', error);
      await device.fillKeyColor(keyIndex, 59, 130, 246);
    }
  }

  async updateAllDevices() {
    for (const devicePath of this.devices.keys()) {
      await this.updateDevice(devicePath);
    }
  }

  async reinitializeDevice(devicePath) {
    const deviceData = this.devices.get(devicePath);
    if (!deviceData) {
      return;
    }

    // Reload config to get the newly added Stream Deck
    const config = this.configManager.getConfig();
    const model = deviceData.deviceInfo.modelSpec;
    
    // Find the config for this device
    let streamDeckConfig = null;
    if (config.streamDecks) {
      streamDeckConfig = config.streamDecks.find(sd => 
        sd.modelId === model?.id && !Array.from(this.devices.values()).find(d => d.streamDeckId === sd.id && d !== deviceData)
      );
    }

    if (streamDeckConfig) {
      console.log('Initializing newly configured Stream Deck:', streamDeckConfig.name);
      
      // Update device data
      deviceData.streamDeckId = streamDeckConfig.id;
      deviceData.config = streamDeckConfig;
      
      // Clear and set up display
      deviceData.device.clearPanel();
      
      // Set up button press handler
      deviceData.device.on('down', (keyIndex) => {
        this.handleButtonPress(devicePath, keyIndex);
      });
      
      // Initial render
      await this.updateDevice(devicePath);
      
      console.log('Stream Deck initialized successfully');
    }
  }

  getConnectedDevices() {
    const devices = [];
    for (const [devicePath, deviceData] of this.devices.entries()) {
      const { deviceInfo, config, streamDeckId } = deviceData;
      const model = deviceInfo.modelSpec;
      
      devices.push({
        path: devicePath,
        productId: model?.productId,
        serialNumber: deviceInfo.serialNumber,
        model: model ? model.name : 'Unknown',
        modelId: model ? model.id : null,
        rows: model ? model.rows : 0,
        columns: model ? model.columns : 0,
        isConfigured: !!streamDeckId,
        configuredName: config?.name
      });
    }
    return devices;
  }

  async testDisplay(devicePath = null) {
    console.log('\n=== Stream Deck Test ===');
    console.log('Connected devices:', this.devices.size);
    
    if (this.devices.size === 0) {
      return {
        success: false,
        message: 'No Stream Deck devices connected',
        deviceCount: 0
      };
    }
    
    const results = [];
    const devicesToTest = devicePath ? [[devicePath, this.devices.get(devicePath)]] : Array.from(this.devices.entries());
    
    for (const [path, deviceData] of devicesToTest) {
      if (!deviceData) continue;
      
      try {
        const { device, config, deviceInfo } = deviceData;
        const model = deviceInfo.modelSpec;
        
        console.log(`\nTesting device: ${config?.name || model?.name || 'Unknown'}`);
        console.log(`Model: ${model?.name}`);
        console.log(`Size: ${model?.rows}x${model?.columns}`);
        console.log(`Path: ${path}`);
        
        // Clear the device
        await device.clearPanel();
        console.log('✓ Cleared panel');
        
        // Fill with test pattern (alternating colors)
        const totalKeys = model.rows * model.columns;
        for (let i = 0; i < totalKeys; i++) {
          const color = i % 2 === 0 ? [255, 0, 0] : [0, 0, 255]; // Red and Blue
          await device.fillKeyColor(i, ...color);
        }
        console.log('✓ Displayed test pattern (red/blue alternating)');
        
        results.push({
          name: config?.name || model?.name || 'Unknown',
          model: model?.name,
          path: path,
          success: true,
          message: 'Test pattern displayed successfully'
        });
        
      } catch (error) {
        console.error('✗ Test failed:', error.message);
        results.push({
          name: deviceData.config?.name || deviceData.deviceInfo?.modelSpec?.name || 'Unknown',
          path: path,
          success: false,
          message: error.message
        });
      }
    }
    
    console.log('\n======================\n');
    
    return {
      success: results.every(r => r.success),
      deviceCount: devicesToTest.length,
      results
    };
  }

  async close() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    // Stop all GIF animations
    this.stopAllAnimations();
    
    const closePromises = [];
    for (const deviceData of this.devices.values()) {
      const promise = (async () => {
        try {
          // Clear the panel before closing
          await deviceData.device.clearPanel();
          deviceData.device.close();
        } catch (error) {
          console.error('Error closing Stream Deck:', error);
        }
      })();
      closePromises.push(promise);
    }
    
    await Promise.all(closePromises);
    this.devices.clear();
  }
}

module.exports = StreamDeckManager;
