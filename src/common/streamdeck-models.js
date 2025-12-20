// Stream Deck device models and their specifications
const STREAMDECK_MODELS = {
  MINI: {
    id: 'mini',
    name: 'Stream Deck Mini',
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

// Get model by product ID
function getModelByProductId(productId) {
  return Object.values(STREAMDECK_MODELS).find(m => m.productId === productId);
}

// Get model by ID
function getModelById(id) {
  return Object.values(STREAMDECK_MODELS).find(m => m.id === id);
}

module.exports = {
  STREAMDECK_MODELS,
  getModelByProductId,
  getModelById
};
