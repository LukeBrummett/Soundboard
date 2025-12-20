console.log('Loading audio.js...');

class AudioManager {
  constructor() {
    this.sounds = new Map();
    this.volume = 0.8;
    this.ipcRenderer = require('electron').ipcRenderer;
    this.userDataPath = null;
    this.init();
  }

  async init() {
    this.userDataPath = await this.ipcRenderer.invoke('get-user-data-path');
  }

  resolvePath(audioFile) {
    // If it's already an absolute path, return it
    if (require('path').isAbsolute(audioFile)) {
      return audioFile;
    }
    // Otherwise, resolve from userData
    if (this.userDataPath) {
      return require('path').join(this.userDataPath, audioFile);
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
        html5: false // Use Web Audio API for lower latency
      });
      this.sounds.set(audioFile, sound);
    }
  }

  play(audioFile) {
    try {
      if (!audioFile || typeof audioFile !== 'string') {
        console.error('Invalid audio file path:', audioFile);
        return null;
      }

      const resolvedPath = this.resolvePath(audioFile);

      // Create a new Howl instance for each play to allow simultaneous playback
      const sound = new Howl({
        src: [resolvedPath],
        volume: this.volume,
        html5: false,
        onloaderror: function(id, error) {
          console.error('Error loading audio file:', resolvedPath, error);
        },
        onplayerror: function(id, error) {
          console.error('Error playing audio:', error);
        },
        onend: function() {
          // Clean up after playback
          this.unload();
        }
      });

      sound.play();
      return sound;
    } catch (error) {
      console.error('Error playing audio:', error);
      return null;
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
