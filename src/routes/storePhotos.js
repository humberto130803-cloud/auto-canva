const express = require('express');
const router = express.Router();
const { downloadImageAsBase64 } = require('../services/renderer');
const { storePhoto, setLastBatch } = require('../services/photoStore');

/**
 * POST /api/store-photos
 *
 * Accepts photos via THREE methods (in priority order):
 *
 * 1. `images` — array of { data: "base64...", mime_type: "image/jpeg" }
 *    Used by Code Interpreter when openaiFileIdRefs fails.
 *    Most reliable method.
 *
 * 2. `openaiFileIdRefs` — auto-injected by ChatGPT with download_link URLs.
 *    Works when ChatGPT properly populates file references.
 *
 * 3. `urls` — plain array of image URL strings.
 *    Used when GPT extracts photo URLs from a listing page.
 *
 * Returns stable /photo/{id} URLs that last 30 minutes.
 */
router.post('/', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    console.log(`[StorePhotos] Request body keys: ${Object.keys(req.body).join(', ')}`);
    console.log(`[StorePhotos] Body size: ~${Math.round(JSON.stringify(req.body).length / 1024)}KB`);

    // === METHOD 1: Base64 images (from Code Interpreter) ===
    const images = req.body.images;
    if (images && Array.isArray(images) && images.length > 0) {
      console.log(`[StorePhotos] Method: base64 images (${images.length} image(s))`);

      const photoUrls = [];
      for (const img of images) {
        try {
          let base64Data = img.data || img.base64 || '';
          const mime = img.mime_type || img.mimeType || 'image/jpeg';

          // Strip data URI prefix if present
          if (base64Data.startsWith('data:')) {
            const match = base64Data.match(/^data:[^;]+;base64,(.+)$/s);
            if (match) base64Data = match[1];
          }

          if (!base64Data) {
            console.warn(`[StorePhotos] Empty base64 data, skipping`);
            continue;
          }

          const buffer = Buffer.from(base64Data, 'base64');
          if (buffer.length < 500) {
            console.warn(`[StorePhotos] Image too small (${buffer.length} bytes), skipping`);
            continue;
          }

          const id = storePhoto(buffer, mime);
          const stableUrl = `${baseUrl}/photo/${id}`;
          console.log(`[StorePhotos] Stored base64 image → /photo/${id} (${Math.round(buffer.length / 1024)}KB, ${mime})`);
          photoUrls.push(stableUrl);
        } catch (err) {
          console.error(`[StorePhotos] Failed to process base64 image: ${err.message}`);
        }
      }

      if (photoUrls.length > 0) {
        setLastBatch(photoUrls);
        return res.json({
          success: true,
          photoUrls,
          message: `${photoUrls.length} photo(s) stored successfully. Use these URLs in property.photos for generatePost.`
        });
      }
    }

    // === METHOD 2: openaiFileIdRefs (auto-injected by ChatGPT) ===
    const refs = req.body.openaiFileIdRefs;
    if (refs && Array.isArray(refs) && refs.length > 0) {
      console.log(`[StorePhotos] Method: openaiFileIdRefs (${refs.length} ref(s))`);
      console.log(`[StorePhotos] Raw:`, JSON.stringify(refs).substring(0, 500));

      const downloads = [];
      for (const ref of refs) {
        if (typeof ref === 'string') {
          if (ref.startsWith('http')) {
            downloads.push({ url: ref, name: 'photo' });
          } else {
            console.log(`[StorePhotos] Skipping non-URL string ref: ${ref.substring(0, 80)}`);
          }
          continue;
        }
        const url = ref.download_link || ref.download_url || ref.url;
        if (url) {
          downloads.push({ url, name: ref.name || 'photo' });
          console.log(`[StorePhotos] File: ${ref.name || 'unnamed'} (${ref.mime_type || '?'}) — ${url.substring(0, 100)}...`);
        } else {
          console.log(`[StorePhotos] Ref has no download link. Keys: ${Object.keys(ref).join(', ')}. Full: ${JSON.stringify(ref).substring(0, 300)}`);
        }
      }

      if (downloads.length > 0) {
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
        console.log(`[StorePhotos] Stored ${photoUrls.length}/${downloads.length} photos via openaiFileIdRefs`);

        if (photoUrls.length > 0) {
          setLastBatch(photoUrls);
          return res.json({
            success: true,
            photoUrls,
            message: `${photoUrls.length} photo(s) stored. Use these URLs in property.photos for all generatePost calls.`
          });
        }
      }
    }

    // === METHOD 3: Plain URL array ===
    const urls = req.body.urls;
    if (urls && Array.isArray(urls) && urls.length > 0) {
      console.log(`[StorePhotos] Method: plain URLs (${urls.length} URL(s))`);

      // Detect /mnt/data/ sandbox paths and reject immediately with clear instructions
      const sandboxPaths = urls.filter(u => u && (u.startsWith('/mnt/') || u.startsWith('/tmp/') || u.startsWith('/var/')));
      if (sandboxPaths.length > 0 && sandboxPaths.length === urls.length) {
        console.warn(`[StorePhotos] ALL ${urls.length} URLs are sandbox paths — rejecting`);
        return res.json({
          success: false,
          photoUrls: [],
          message: `FAILED: All ${urls.length} URLs are /mnt/data/ sandbox paths the server cannot access. FIX: Step A) Use Code Interpreter to read these files and base64-encode them (do NOT use urllib - Code Interpreter has no network). Use PIL to compress to JPEG. Step B) Call the storePhotos ACTION with {"images": [{"data":"<base64>","mime_type":"image/jpeg"}]}. The ACTION has network access, Code Interpreter does not.`
        });
      }

      const results = await Promise.all(
        urls.map(async (url) => {
          if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
          try {
            const dataUri = await downloadImageAsBase64(url);
            const match = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
            if (match) {
              const buffer = Buffer.from(match[2], 'base64');
              const id = storePhoto(buffer, match[1]);
              const stableUrl = `${baseUrl}/photo/${id}`;
              console.log(`[StorePhotos] Stored URL → /photo/${id} (${Math.round(buffer.length / 1024)}KB)`);
              return stableUrl;
            }
            return null;
          } catch (err) {
            console.error(`[StorePhotos] Failed to download URL: ${err.message}`);
            return null;
          }
        })
      );

      const photoUrls = results.filter(Boolean);
      if (photoUrls.length > 0) {
        setLastBatch(photoUrls);
        return res.json({
          success: true,
          photoUrls,
          message: `${photoUrls.length} photo(s) stored from URLs. Use these in property.photos for generatePost.`
        });
      }
    }

    // === No photos from any method ===
    console.warn('[StorePhotos] No photos received from any method');
    return res.json({
      success: false,
      photoUrls: [],
      message: 'PHOTO UPLOAD FAILED. FIX with two steps: Step A) Use Code Interpreter to read /mnt/data/ files and base64-encode them using PIL (compress to JPEG, max 1200px). Do NOT use urllib/requests — Code Interpreter has NO network access. Step B) Call the storePhotos ACTION (not from Code Interpreter) with {"images": [{"data":"<base64>","mime_type":"image/jpeg"},...]}. The action has network access. Do NOT call generatePost until storePhotos returns valid photoUrls starting with https://.'
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
