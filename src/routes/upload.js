const express = require('express');
const router = express.Router();
const { storePhoto, getStats } = require('../services/photoStore');

// Accept raw binary uploads with content-type
router.post('/', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], limit: '15mb' }), (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: 'No image data received' });
    }

    const mime = req.headers['content-type'] || 'image/jpeg';
    const id = storePhoto(req.body, mime);
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const photoUrl = `${baseUrl}/photo/${id}`;

    console.log(`[Upload] Stored photo ${id} (${Math.round(req.body.length / 1024)}KB, ${mime})`);

    return res.json({
      success: true,
      id,
      url: photoUrl,
      expiresIn: '30 minutes'
    });
  } catch (err) {
    console.error('[Upload] Error:', err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// Multipart form upload (for the HTML upload page)
router.post('/multi', express.json({ limit: '50mb' }), (req, res) => {
  try {
    const { photos } = req.body; // Array of { data: base64, mime: string, name: string }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: 'No photos provided' });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const results = [];

    for (const photo of photos) {
      if (!photo.data) continue;

      // Remove data URI prefix if present
      let base64Data = photo.data;
      if (base64Data.startsWith('data:')) {
        base64Data = base64Data.split(',')[1];
      }

      const buffer = Buffer.from(base64Data, 'base64');
      const mime = photo.mime || 'image/jpeg';
      const id = storePhoto(buffer, mime);
      const photoUrl = `${baseUrl}/photo/${id}`;

      console.log(`[Upload] Stored ${photo.name || 'unnamed'} → ${id} (${Math.round(buffer.length / 1024)}KB)`);

      results.push({
        id,
        url: photoUrl,
        name: photo.name || `photo-${results.length + 1}`
      });
    }

    const stats = getStats();
    console.log(`[PhotoStore] ${stats.count} photos stored, ${stats.memoryMB}MB memory`);

    return res.json({
      success: true,
      count: results.length,
      photos: results
    });
  } catch (err) {
    console.error('[Upload] Error:', err);
    return res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

module.exports = router;
