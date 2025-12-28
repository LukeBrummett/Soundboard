class AudioManager {
  constructor() {
    this.sounds = new Map();
    this.volume = 0.8;
    this.ipcRenderer = require('electron').ipcRenderer;
    this.userDataPath = null;
    this.audioOutputDeviceId = 'default';
    this.init();
  }

  async init() {
    this.userDataPath = await this.ipcRenderer.invoke('get-user-data-path');
    // Initialize Howler's AudioContext immediately
    await this.initializeAudioContext();
  }

  async initializeAudioContext() {
    // Force Howler to create AudioContext immediately
    if (typeof Howler !== 'undefined' && !Howler.ctx) {
      console.log('Initializing Howler AudioContext...');
      
      // Create a very short silent sound to force context creation
      const silent = new Howl({
        src: ['data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'],
        volume: 0,
        html5: false
      });
      
      // Play and wait for it to actually start
      const playPromise = new Promise((resolve) => {
        silent.once('play', () => {
          console.log('AudioContext initialized');
          resolve();
        });
        silent.play();
      });
      
      await playPromise;
      silent.unload();
      
      // Give AudioContext time to fully initialize
      await new Promise(resolve => setTimeout(resolve, 150));
      
      console.log('AudioContext ready:', !!Howler.ctx);
    }
  }

  async setAudioOutputDevice(deviceId) {
    this.audioOutputDeviceId = deviceId || 'default';
    console.log('Setting audio output device to:', this.audioOutputDeviceId);
    
    try {
      // Ensure AudioContext is created first
      await this.initializeAudioContext();
      
      if (!Howler.ctx) {
        console.error('Failed to initialize AudioContext');
        return;
      }
      
      // Set the sink ID on Howler's AudioContext
      if (Howler.ctx.setSinkId) {
        const sinkId = deviceId === 'default' ? '' : deviceId;
        await Howler.ctx.setSinkId(sinkId);
        console.log('✓ AudioContext sink ID set successfully to:', deviceId);
        
        // Verify it was set
        if (Howler.ctx.sinkId !== undefined) {
          console.log('  Current sink ID:', Howler.ctx.sinkId || 'default');
        }
      } else {
        console.warn('setSinkId not supported on this AudioContext - audio will use default output');
      }
    } catch (error) {
      console.error('Failed to set AudioContext sink ID:', error);
      console.error('  Device ID attempted:', deviceId);
      console.error('  Error details:', error.message);
    }
  }

  async getAudioOutputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      return audioOutputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Audio Output ${device.deviceId.substring(0, 8)}`
      }));
    } catch (error) {
      console.error('Failed to enumerate audio devices:', error);
      return [];
    }
  }

  resolvePath(audioFile) {
    const path = require('path');
    // If it's already an absolute path, return it
    if (path.isAbsolute(audioFile)) {
      return path.normalize(audioFile);
    }
    // Otherwise, resolve from userData
    if (this.userDataPath) {
      // Convert forward slashes to platform-specific separators
      const normalizedRelative = audioFile.replace(/\//g, path.sep);
      return path.join(this.userDataPath, normalizedRelative);
    }
    return audioFile;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.volume);
  }

  preload(audioFile) {
    const resolvedPath = this.resolvePath(audioFile);
    if (!this.sounds.has(audioFile)) {
      const sound = new Howl({
        src: [resolvedPath],
        preload: true,
        html5: false // Use Web Audio API
      });
      this.sounds.set(audioFile, sound);
    }
  }

  play(audioFile, audioSettings = {}) {
    try {
      if (!audioFile || typeof audioFile !== 'string') {
        console.error('Invalid audio file path:', audioFile);
        return null;
      }

      const resolvedPath = this.resolvePath(audioFile);
      
      // Check if file exists
      const fs = require('fs');
      if (!fs.existsSync(resolvedPath)) {
        throw new Error('Audio file not found: ' + resolvedPath);
      }
      
      const stats = fs.statSync(resolvedPath);
      
      if (stats.size === 0) {
        throw new Error('Audio file is empty (0 bytes)');
      }

      // Apply audio settings with defaults
      const volume = audioSettings.volume !== undefined ? audioSettings.volume : 1.0;
      const rate = audioSettings.rate !== undefined ? audioSettings.rate : 1.0;
      const trimStart = audioSettings.trimStart || 0;
      const trimEnd = audioSettings.trimEnd || null;

      console.log('Playing with volume setting:', volume, '(raw value from slider / 100)');

      // Create a new Howl instance for each play to allow simultaneous playback
      // Use Web Audio API for volume control (allows boosting > 100%)
      const sound = new Howl({
        src: [resolvedPath],
        volume: volume, // Set volume directly - Web Audio API supports > 1.0
        rate: rate,
        html5: false, // Always use Web Audio API - sink ID is set on the context
        sprite: trimEnd ? {
          main: [trimStart * 1000, (trimEnd - trimStart) * 1000]
        } : undefined,
        onloaderror: function(id, error) {
          console.error('Howl load error:', id, error);
        },
        onplayerror: function(id, error) {
          console.error('Howl play error:', id, error);
          sound.once('unlock', function() {
            sound.play();
          });
        },
        onend: function() {
          this.unload();
        }
      });

      console.log('Created Howl with volume:', sound.volume());

      // If we have trimming but no sprite (only trimStart), seek to start position
      if (trimStart > 0 && !trimEnd) {
        sound.once('play', () => {
          sound.seek(trimStart);
        });
      }

      // Play the sound (with sprite if defined)
      if (trimEnd) {
        sound.play('main');
      } else {
        sound.play();
      }

      return sound;
    } catch (error) {
      console.error('AudioManager error:', error);
      throw error;
    }
  }

  stop(soundId) {
    if (soundId) {
      soundId.stop();
    }
  }

  stopAll() {
    Howler.stop();
  }

  unload(audioFile) {
    if (this.sounds.has(audioFile)) {
      this.sounds.get(audioFile).unload();
      this.sounds.delete(audioFile);
    }
  }

  unloadAll() {
    this.sounds.forEach(sound => sound.unload());
    this.sounds.clear();
  }
}

// Don't export in browser context, just make it available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioManager;
}
