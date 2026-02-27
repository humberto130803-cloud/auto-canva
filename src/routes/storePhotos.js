const express = require('express');
const router = express.Router();
const { downloadImageAsBase64 } = require('../services/renderer');
const { storePhoto } = require('../services/photoStore');

/**
 * POST /api/store-photos
 *
 * Called IMMEDIATELY after user uploads photos in ChatGPT.
 * Receives photos via openaiFileIdRefs, downloads them from
 * the signed download_link URLs, and stores them in memory.
 * Returns stable /photo/{id} URLs that last 30 minutes.
 *
 * This must be called BEFORE generatePost so photos are stored
 * while the download_links are still valid (~5 min).
 */
router.post('/', async (req, res) => {
  try {
    const refs = req.body.openaiFileIdRefs;
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    console.log(`[StorePhotos] Request body keys: ${Object.keys(req.body).join(', ')}`);

    if (!refs || !Array.isArray(refs) || refs.length === 0) {
      console.warn('[StorePhotos] No openaiFileIdRefs in request');
      return res.json({
        success: false,
        photoUrls: [],
        message: 'No photos received. The user should re-upload photos directly in their next message and you should call storePhotos again immediately.'
      });
    }

    console.log(`[StorePhotos] Received ${refs.length} file ref(s)`);
    console.log(`[StorePhotos] Raw:`, JSON.stringify(refs).substring(0, 500));

    // Extract download URLs from refs
    const downloads = [];
    for (const ref of refs) {
      if (typeof ref === 'string') {
        if (ref.startsWith('http')) {
          downloads.push({ url: ref, name: 'photo' });
        }
        continue;
      }
      const url = ref.download_link || ref.download_url || ref.url;
      if (url) {
        downloads.push({ url, name: ref.name || 'photo' });
        console.log(`[StorePhotos] File: ${ref.name || 'unnamed'} (${ref.mime_type || '?'}) — ${url.substring(0, 100)}...`);
      }
    }

    if (downloads.length === 0) {
      return res.json({
        success: false,
        photoUrls: [],
        message: 'File refs received but no download URLs found.'
      });
    }

    // Download all photos in parallel and store them
    const results = await Promise.all(
      downloads.map(async ({ url, name }) => {
        try {
          const dataUri = await downloadImageAsBase64(url);
          const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
          if (match) {
            const buffer = Buffer.from(match[2], 'base64');
            const id = storePhoto(buffer, match[1]);
            const stableUrl = `${baseUrl}/photo/${id}`;
            console.log(`[StorePhotos] Stored ${name} → /photo/${id} (${Math.round(buffer.length / 1024)}KB)`);
            return stableUrl;
          }
          return null;
        } catch (err) {
          console.error(`[StorePhotos] Failed to download ${name}: ${err.message}`);
          return null;
        }
      })
    );

    const photoUrls = results.filter(Boolean);
    console.log(`[StorePhotos] Stored ${photoUrls.length}/${downloads.length} photos`);

    return res.json({
      success: true,
      photoUrls,
      message: photoUrls.length > 0
        ? `${photoUrls.length} photo(s) stored. Use these URLs in property.photos for all generatePost calls.`
        : 'Photos could not be downloaded. Ask user to re-upload or use the upload page.'
    });
  } catch (err) {
    console.error('[StorePhotos] Error:', err);
    return res.status(500).json({
      success: false,
      photoUrls: [],
      message: `Error storing photos: ${err.message}`
    });
  }
});

module.exports = router;
