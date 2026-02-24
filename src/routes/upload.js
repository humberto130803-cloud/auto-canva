const express = require('express');
const router = express.Router();
const { storePhoto, getStats } = require('../services/photoStore');
const { downloadImageAsBase64 } = require('../services/renderer');

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

// POST /from-urls — download photos from URLs and store them as stable /photo/{id} URLs
router.post('/from-urls', express.json(), async (req, res) => {
  try {
    const { urls } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'No URLs provided. Send { urls: ["..."] }' });
    }

    if (urls.length > 20) {
      return res.status(400).json({ error: 'Too many URLs (max 20)' });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const results = [];

    // Download all URLs in parallel
    const downloads = await Promise.allSettled(
      urls.map(async (url) => {
        const dataUri = await downloadImageAsBase64(url);
        // Parse data URI to get buffer and mime
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
        if (!match) throw new Error('Invalid data URI from download');
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        return { buffer, mime };
      })
    );

    for (let i = 0; i < downloads.length; i++) {
      const result = downloads[i];
      if (result.status === 'fulfilled') {
        const { buffer, mime } = result.value;
        const id = storePhoto(buffer, mime);
        const photoUrl = `${baseUrl}/photo/${id}`;
        console.log(`[Upload/from-urls] Stored photo ${id} (${Math.round(buffer.length / 1024)}KB, ${mime})`);
        results.push({ id, url: photoUrl });
      } else {
        console.error(`[Upload/from-urls] Failed to download URL ${i}: ${result.reason.message}`);
        results.push({ error: result.reason.message, sourceUrl: urls[i] });
      }
    }

    const stats = getStats();
    console.log(`[PhotoStore] ${stats.count} photos stored, ${stats.memoryMB}MB memory`);

    return res.json({
      success: true,
      photos: results
    });
  } catch (err) {
    console.error('[Upload/from-urls] Error:', err);
    return res.status(500).json({ error: 'Upload from URLs failed', details: err.message });
  }
});

module.exports = router;
