/**
 * Stream Deck Device Models
 * 
 * This module defines specifications for all supported Elgato Stream Deck models.
 * Each model has unique dimensions, button counts, and product IDs that are used
 * for device identification and rendering.
 */

/**
 * Stream Deck model specifications
 * Each entry contains:
 * - id: Internal identifier
 * - name: Display name
 * - rows/columns: Grid layout
 * - keyCount: Total number of buttons
 * - iconSize: Button image size in pixels
 * - productId: USB product ID for device detection
 */
const STREAMDECK_MODELS = {
  MINI: {
    id: 'mini',
    name: 'Stream Deck Mini',
    rows: 2,
    columns: 3,
    keyCount: 6,
    iconSize: 80,
    productId: 0x0090
  },
  MINI_V2: {
    id: 'mini-v2',
    name: 'Stream Deck Mini V2',
    rows: 2,
    columns: 3,
    keyCount: 6,
    iconSize: 80,
    productId: 0x0063
  },
  REGULAR: {
    id: 'regular',
    name: 'Stream Deck (Regular)',
    rows: 3,
    columns: 5,
    keyCount: 15,
    iconSize: 72,
    productId: 0x0060
  },
  XL: {
    id: 'xl',
    name: 'Stream Deck XL',
    rows: 4,
    columns: 8,
    keyCount: 32,
    iconSize: 96,
    productId: 0x006C
  },
  PLUS: {
    id: 'plus',
    name: 'Stream Deck Plus',
    rows: 2,
    columns: 4,
    keyCount: 8,
    iconSize: 120,
    productId: 0x0084
  },
  MK2: {
    id: 'mk2',
    name: 'Stream Deck MK.2',
    rows: 3,
    columns: 5,
    keyCount: 15,
    iconSize: 72,
    productId: 0x0080
  }
};

/**
 * Find a Stream Deck model by its USB product ID
 * @param {number} productId - USB product ID
 * @returns {object|undefined} Model specification or undefined
 */
function getModelByProductId(productId) {
  return Object.values(STREAMDECK_MODELS).find(m => m.productId === productId);
}

/**
 * Find a Stream Deck model by its internal ID
 * @param {string} id - Model ID (e.g., 'mini', 'regular', 'xl')
 * @returns {object|undefined} Model specification or undefined
 */
function getModelById(id) {
  return Object.values(STREAMDECK_MODELS).find(m => m.id === id);
}

/**
 * Find a Stream Deck model by its name
 * @param {string} modelName - Model name from device
 * @returns {object|undefined} Model specification or undefined
 */
function getModelByName(modelName) {
  return Object.values(STREAMDECK_MODELS).find(m => m.id === modelName);
}

module.exports = {
  STREAMDECK_MODELS,
  getModelByProductId,
  getModelById,
  getModelByName
};
