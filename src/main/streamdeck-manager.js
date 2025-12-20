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
      console.log('Opening Stream Deck:', deviceInfo);
      const device = await openStreamDeck(deviceInfo.path);
      
      // Find matching config by serial number or model
      const config = this.configManager.getConfig();
      const { getModelByProductId } = require('../common/streamdeck-models.js');
      const model = getModelByProductId(deviceInfo.productId);
      
      // Try to find existing Stream Deck config by model match
      let streamDeckConfig = null;
      if (config.streamDecks) {
        streamDeckConfig = config.streamDecks.find(sd => 
          sd.modelId === model?.id && !Array.from(this.devices.values()).find(d => d.streamDeckId === sd.id)
        );
      }
      
      if (!streamDeckConfig && model) {
        // Auto-create new Stream Deck config
        streamDeckConfig = {
          id: Date.now().toString(),
          name: `${model.name} ${this.devices.size + 1}`,
          model: model.name,
          modelId: model.id,
          rows: model.rows,
          columns: model.columns
        };
        this.configManager.addStreamDeck(streamDeckConfig);
        console.log('Auto-created Stream Deck config:', streamDeckConfig);
      }
      
      const deviceData = {
        device,
        streamDeckId: streamDeckConfig?.id,
        config: streamDeckConfig,
        deviceInfo
      };
      
      this.devices.set(deviceInfo.path, deviceData);
      
      // Clear all buttons
      device.clearPanel();
      
      // Set up button press handlers
      device.on('down', (keyIndex) => {
        this.handleButtonPress(deviceInfo.path, keyIndex);
      });
      
      device.on('error', (error) => {
        console.error('Stream Deck error:', error);
      });
      
      console.log('Stream Deck opened successfully:', streamDeckConfig?.name);
      
      // Initial render
      await this.updateDevice(deviceInfo.path);
      
    } catch (error) {
      console.error('Error opening Stream Deck:', error);
    }
  }

  handleButtonPress(devicePath, keyIndex) {
    const deviceData = this.devices.get(devicePath);
    if (!deviceData || !deviceData.streamDeckId) return;
    
    const config = this.configManager.getConfig();
    const currentGrid = this.mainWindow.webContents.executeJavaScript('app.grid.currentGrid');
    
    currentGrid.then(gridId => {
      const grid = config.grids[gridId];
      if (!grid || !grid.streamDeckPositions) return;
      
      const framePosition = grid.streamDeckPositions[deviceData.streamDeckId];
      if (!framePosition) return;
      
      // Convert key index to row/col for the Stream Deck
      const sdConfig = deviceData.config;
      const sdRow = Math.floor(keyIndex / sdConfig.columns);
      const sdCol = keyIndex % sdConfig.columns;
      
      // Calculate grid position
      const gridRow = framePosition.row + sdRow;
      const gridCol = framePosition.col + sdCol;
      
      // Check if position is within grid bounds
      if (gridRow >= grid.rows || gridCol >= grid.columns) return;
      
      // Trigger button press via renderer
      this.mainWindow.webContents.send('streamdeck-button-press', [gridRow, gridCol]);
    }).catch(error => {
      console.error('Error handling Stream Deck button press:', error);
    });
  }

  async updateDevice(devicePath) {
    const deviceData = this.devices.get(devicePath);
    if (!deviceData || !deviceData.streamDeckId) return;
    
    try {
      const config = this.configManager.getConfig();
      const currentGrid = await this.mainWindow.webContents.executeJavaScript('app.grid.currentGrid');
      const grid = config.grids[currentGrid];
      
      if (!grid || !grid.streamDeckPositions) return;
      
      const framePosition = grid.streamDeckPositions[deviceData.streamDeckId];
      if (!framePosition) {
        // No frame positioned, clear the device
        deviceData.device.clearPanel();
        return;
      }
      
      const sdConfig = deviceData.config;
      const userDataPath = await this.mainWindow.webContents.executeJavaScript(
        'require("electron").ipcRenderer.invoke("get-user-data-path")'
      );
      
      // Render each button
      for (let sdRow = 0; sdRow < sdConfig.rows; sdRow++) {
        for (let sdCol = 0; sdCol < sdConfig.columns; sdCol++) {
          const keyIndex = sdRow * sdConfig.columns + sdCol;
          const gridRow = framePosition.row + sdRow;
          const gridCol = framePosition.col + sdCol;
          
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
              await this.renderButtonImage(deviceData.device, keyIndex, imagePath, button.label);
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

  async renderButtonImage(device, keyIndex, imagePath, label) {
    try {
      const iconSize = device.ICON_SIZE || 72;
      
      let imageBuffer = await sharp(imagePath)
        .resize(iconSize, iconSize, { fit: 'cover' })
        .raw()
        .toBuffer();
      
      // Convert to RGB format if needed
      await device.fillKeyBuffer(keyIndex, imageBuffer);
    } catch (error) {
      console.error('Error rendering button image:', error);
      // Fallback to text
      await this.renderButtonText(device, keyIndex, label || '?');
    }
  }

  async renderButtonText(device, keyIndex, text) {
    try {
      const iconSize = device.ICON_SIZE || 72;
      
      // Create a simple colored button with text
      const svg = `
        <svg width="${iconSize}" height="${iconSize}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${iconSize}" height="${iconSize}" fill="#3b82f6"/>
          <text x="50%" y="50%" font-size="16" font-family="Arial" fill="white" 
                text-anchor="middle" dominant-baseline="middle">${text.substring(0, 12)}</text>
        </svg>
      `;
      
      const imageBuffer = await sharp(Buffer.from(svg))
        .resize(iconSize, iconSize)
        .raw()
        .toBuffer();
      
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

  close() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    for (const deviceData of this.devices.values()) {
      try {
        deviceData.device.close();
      } catch (error) {
        console.error('Error closing Stream Deck:', error);
      }
    }
    
    this.devices.clear();
  }
}

module.exports = StreamDeckManager;
