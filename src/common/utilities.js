/**
 * Utility Functions
 * 
 * Common helper functions used across the application
 */

/**
 * Resolve a file path - converts relative paths to absolute
 * @param {string} filePath - File path (relative or absolute)
 * @param {string} userDataPath - User data directory path
 * @returns {string} Absolute file path
 */
function resolvePath(filePath, userDataPath) {
  if (!filePath) return null;
  
  const path = require('path');
  
  // If already absolute, just normalize it
  if (path.isAbsolute(filePath)) {
    return path.normalize(filePath);
  }
  
  // Otherwise, resolve from userData directory
  if (userDataPath) {
    const normalizedRelative = filePath.replace(/\//g, path.sep);
    return path.join(userDataPath, normalizedRelative);
  }
  
  return filePath;
}

/**
 * Escape XML special characters for SVG rendering
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Generate a unique ID based on timestamp
 * @returns {string} Unique ID
 */
function generateId() {
  return Date.now().toString();
}

/**
 * Calculate grid row/column from Stream Deck key index
 * @param {number} keyIndex - Key index on Stream Deck
 * @param {number} columns - Number of columns on Stream Deck
 * @returns {object} {row, col}
 */
function keyIndexToPosition(keyIndex, columns) {
  return {
    row: Math.floor(keyIndex / columns),
    col: keyIndex % columns
  };
}

/**
 * Calculate Stream Deck key index from grid position
 * @param {number} row - Row number
 * @param {number} col - Column number
 * @param {number} columns - Number of columns on Stream Deck
 * @returns {number} Key index
 */
function positionToKeyIndex(row, col, columns) {
  return row * columns + col;
}

/**
 * Check if a position is within grid bounds
 * @param {number} row - Row number
 * @param {number} col - Column number
 * @param {object} grid - Grid configuration
 * @returns {boolean} True if within bounds
 */
function isWithinBounds(row, col, grid) {
  return row >= 0 && row < grid.rows && col >= 0 && col < grid.columns;
}

/**
 * Convert hotkey string to Electron accelerator format
 * @param {string} key - Hotkey string (e.g., 'Ctrl+A')
 * @returns {string} Electron accelerator (e.g., 'CommandOrControl+A')
 */
function toElectronAccelerator(key) {
  return key.replace('Ctrl+', 'CommandOrControl+');
}

/**
 * Wait for a specified number of milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  resolvePath,
  escapeXml,
  debounce,
  generateId,
  keyIndexToPosition,
  positionToKeyIndex,
  isWithinBounds,
  toElectronAccelerator,
  delay
};
