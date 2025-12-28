/**
 * AudioManager - Handles all audio playback functionality
 * 
 * Uses Howler.js library for audio playback with Web Audio API
 * Supports:
 * - Multiple simultaneous sounds
 * - Volume control (including boost >100%)
 * - Playback rate adjustment
 * - Audio trimming (start/end points)
 * - Custom audio output device selection
 */
class AudioManager {
  constructor() {
    this.sounds = new Map();  // Cache of preloaded sounds
    this.volume = 0.8;        // Master volume (0.0-1.0)
    this.ipcRenderer = require('electron').ipcRenderer;
    this.userDataPath = null;
    this.audioOutputDeviceId = 'default';
    this.init();
  }

  /**
   * Initialize audio manager - get user data path and setup audio context
   */
  async init() {
    this.userDataPath = await this.ipcRenderer.invoke('get-user-data-path');
    await this.initializeAudioContext();
  }

  /**
   * Initialize Howler's AudioContext immediately
   * This prevents issues with audio not playing on first click
   */
  async initializeAudioContext() {
    if (typeof Howler !== 'undefined' && !Howler.ctx) {
      // Create a very short silent sound to force AudioContext creation
      const silent = new Howl({
        src: ['data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'],
        volume: 0,
        html5: false
      });
      
      // Play and wait for context to initialize
      const playPromise = new Promise((resolve) => {
        silent.once('play', resolve);
        silent.play();
      });
      
      await playPromise;
      silent.unload();
      
      // Give AudioContext time to fully initialize
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }

  /**
   * Set the audio output device
   * Uses Web Audio API's setSinkId() to route audio to specific device
   * @param {string} deviceId - Device ID from enumerate devices, or 'default'
   */
  async setAudioOutputDevice(deviceId) {
    this.audioOutputDeviceId = deviceId || 'default';
    
    try {
      // Ensure AudioContext exists first
      await this.initializeAudioContext();
      
      if (!Howler.ctx) {
        return; // Cannot set sink without AudioContext
      }
      
      // Set the sink ID on Howler's AudioContext
      if (Howler.ctx.setSinkId) {
        const sinkId = deviceId === 'default' ? '' : deviceId;
        await Howler.ctx.setSinkId(sinkId);
      }
    } catch (error) {
      // setSinkId may fail if device is unavailable
      // Audio will continue to work with default device
    }
  }

  /**
   * Get list of available audio output devices
   * @returns {Array} Array of {deviceId, label} objects
   */
  async getAudioOutputDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => device.kind === 'audiooutput');
      return audioOutputs.map(device => ({
        deviceId: device.deviceId,
        label: device.label || `Audio Output ${device.deviceId.substring(0, 8)}`
      }));
    } catch (error) {
      return [];
    }
  }

  /**
   * Resolve a file path - convert relative to absolute
   * @param {string} audioFile - File path (relative or absolute)
   * @returns {string} Absolute file path
   */
  resolvePath(audioFile) {
    const path = require('path');
    
    // If already absolute, just normalize
    if (path.isAbsolute(audioFile)) {
      return path.normalize(audioFile);
    }
    
    // Otherwise, resolve from userData directory
    if (this.userDataPath) {
      const normalizedRelative = audioFile.replace(/\//g, path.sep);
      return path.join(this.userDataPath, normalizedRelative);
    }
    
    return audioFile;
  }

  /**
   * Set master volume
   * @param {number} volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    Howler.volume(this.volume);
  }

  /**
   * Preload an audio file for faster playback
   * @param {string} audioFile - Path to audio file
   */
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

  /**
   * Play an audio file with optional settings
   * @param {string} audioFile - Path to audio file
   * @param {object} audioSettings - Playback settings
   * @param {number} audioSettings.volume - Volume (0.0-3.0, allows boost)
   * @param {number} audioSettings.rate - Playback rate (0.5-2.0)
   * @param {number} audioSettings.trimStart - Start time in seconds
   * @param {number} audioSettings.trimEnd - End time in seconds (null = play to end)
   * @returns {Howl} Howl instance for controlling playback
   */
  play(audioFile, audioSettings = {}) {
    try {
      if (!audioFile || typeof audioFile !== 'string') {
        throw new Error('Invalid audio file path');
      }

      const resolvedPath = this.resolvePath(audioFile);
      
      // Verify file exists
      const fs = require('fs');
      if (!fs.existsSync(resolvedPath)) {
        throw new Error('Audio file not found: ' + resolvedPath);
      }
      
      const stats = fs.statSync(resolvedPath);
      if (stats.size === 0) {
        throw new Error('Audio file is empty (0 bytes)');
      }

      // Extract settings with defaults
      const volume = audioSettings.volume !== undefined ? audioSettings.volume : 1.0;
      const rate = audioSettings.rate !== undefined ? audioSettings.rate : 1.0;
      const trimStart = audioSettings.trimStart || 0;
      const trimEnd = audioSettings.trimEnd || null;

      // Create new Howl instance for each play (allows simultaneous playback)
      const sound = new Howl({
        src: [resolvedPath],
        volume: volume,
        rate: rate,
        html5: true,     // Use HTML5 Audio (workaround for Web Audio crashes)
        // Use sprite for trimming if both start and end are specified
        sprite: trimEnd ? {
          main: [trimStart * 1000, (trimEnd - trimStart) * 1000]
        } : undefined,
        onloaderror: function(id, error) {
          console.error('[Audio] Load error:', error, 'Path:', resolvedPath);
        },
        onplayerror: function(id, error) {
          console.error('[Audio] Play error:', error, 'Path:', resolvedPath);
          // Attempt to unlock audio context and retry
          this.once('unlock', function() {
            this.play();
          });
        },
        onend: function() {
          this.unload();  // Free memory after playback
        }
      });

      // Set audio output device for HTML5 audio
      const deviceId = this.audioOutputDeviceId;
      sound.once('load', async () => {
        try {
          if (sound._sounds && sound._sounds[0] && sound._sounds[0]._node) {
            const audioElement = sound._sounds[0]._node;
            if (audioElement.setSinkId && deviceId && deviceId !== 'default') {
              await audioElement.setSinkId(deviceId);
            }
          }
        } catch (error) {
          console.error('[Audio] Failed to set output device:', error.message);
        }
      });

      // If only trimStart (no trimEnd), seek to start position manually
      if (trimStart > 0 && !trimEnd) {
        sound.once('play', () => {
          sound.seek(trimStart);
        });
      }

      // Start playback (use sprite if defined)
      if (trimEnd) {
        sound.play('main');
      } else {
        sound.play();
      }

      return sound;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Stop a specific sound
   * @param {Howl} soundId - Howl instance returned from play()
   */
  stop(soundId) {
    if (soundId) {
      soundId.stop();
    }
  }

  /**
   * Stop all currently playing sounds
   */
  stopAll() {
    Howler.stop();
  }

  /**
   * Unload a specific cached sound from memory
   * @param {string} audioFile - Path to audio file
   */
  unload(audioFile) {
    if (this.sounds.has(audioFile)) {
      this.sounds.get(audioFile).unload();
      this.sounds.delete(audioFile);
    }
  }

  /**
   * Unload all cached sounds from memory
   */
  unloadAll() {
    this.sounds.forEach(sound => sound.unload());
    this.sounds.clear();
  }
}

// Make available globally (browser context)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioManager;
}
