/**
 * In-memory photo store with TTL.
 * Photos uploaded via /api/upload are stored here temporarily.
 * They are served via /photo/:id and cleaned up after TTL expires.
 */

const { v4: uuidv4 } = require('uuid');

// Store: { id: { buffer, mime, createdAt } }
const photos = new Map();

// TTL: 30 minutes
const TTL_MS = 30 * 60 * 1000;

/**
 * Store a photo buffer and return its unique ID.
 */
function storePhoto(buffer, mime) {
  const id = uuidv4();
  photos.set(id, {
    buffer,
    mime: mime || 'image/jpeg',
    createdAt: Date.now()
  });
  return id;
}

/**
 * Get a stored photo by ID.
 */
function getPhoto(id) {
  const photo = photos.get(id);
  if (!photo) return null;

  // Check if expired
  if (Date.now() - photo.createdAt > TTL_MS) {
    photos.delete(id);
    return null;
  }

  return photo;
}

/**
 * Get photo as base64 data URI.
 */
function getPhotoAsDataUri(id) {
  const photo = getPhoto(id);
  if (!photo) return null;
  return `data:${photo.mime};base64,${photo.buffer.toString('base64')}`;
}

/**
 * Cleanup expired photos.
 */
function cleanupExpiredPhotos() {
  const now = Date.now();
  let deleted = 0;
  for (const [id, photo] of photos) {
    if (now - photo.createdAt > TTL_MS) {
      photos.delete(id);
      deleted++;
    }
  }
  if (deleted > 0) {
    console.log(`[PhotoStore] Cleaned up ${deleted} expired photo(s). ${photos.size} remaining.`);
  }
}

/**
 * Get store stats.
 */
function getStats() {
  return {
    count: photos.size,
    memoryMB: Math.round([...photos.values()].reduce((sum, p) => sum + p.buffer.length, 0) / 1024 / 1024 * 100) / 100
  };
}

module.exports = { storePhoto, getPhoto, getPhotoAsDataUri, cleanupExpiredPhotos, getStats };
