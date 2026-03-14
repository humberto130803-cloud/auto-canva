const express = require('express');
const router = express.Router();
const { downloadImageAsBase64 } = require('../services/renderer');
const { storePhoto, setLastBatch } = require('../services/photoStore');

// Minimum image size: 5KB. Real photos compressed at quality=25 at 400x400 are ~5-15KB.
// GPT-hallucinated base64 typically produces 100 bytes to 2KB of garbage data.
const MIN_IMAGE_BYTES = 5000;

/**
 * Parse JPEG dimensions from SOF marker. Returns {width, height} or null.
 * Hallucinated JPEGs have valid FF D8 headers but lack proper SOF markers.
 */
function getJpegDimensions(buffer) {
  if (buffer.length < 10 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < buffer.length - 9) {
    if (buffer[offset] !== 0xFF) return null;
    const marker = buffer[offset + 1];
    // Skip padding 0xFF bytes
    if (marker === 0xFF) { offset++; continue; }
    // SOF markers: C0 (baseline), C1 (extended), C2 (progressive)
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
      const height = (buffer[offset + 5] << 8) | buffer[offset + 6];
      const width = (buffer[offset + 7] << 8) | buffer[offset + 8];
      return { width, height };
    }
    // SOS marker (FF DA) — we've gone too far, no SOF found
    if (marker === 0xDA) return null;
    // EOI marker
    if (marker === 0xD9) return null;
    // Skip markers without length (RST, SOI, EOI)
    if (marker >= 0xD0 && marker <= 0xD9) { offset += 2; continue; }
    // Read segment length and skip
    if (offset + 3 >= buffer.length) return null;
    const segLen = (buffer[offset + 2] << 8) | buffer[offset + 3];
    if (segLen < 2) return null;
    offset += 2 + segLen;
  }
  return null;
}

/**
 * Parse PNG dimensions from IHDR chunk. Returns {width, height} or null.
 */
function getPngDimensions(buffer) {
  if (buffer.length < 24) return null;
  if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4E || buffer[3] !== 0x47) return null;
  const ihdr = buffer.slice(12, 16).toString();
  if (ihdr !== 'IHDR') return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

/**
 * Validate that an image buffer is a real photo (not hallucinated GPT data).
 * Returns { valid: true } or { valid: false, reason: string }
 */
function validateImageBuffer(buffer) {
  // Check minimum size
  if (buffer.length < MIN_IMAGE_BYTES) {
    return { valid: false, reason: `TOO SMALL: ${buffer.length} bytes (minimum ${MIN_IMAGE_BYTES}). Real photos are 5KB-5MB. This is hallucinated data.` };
  }

  // Check magic bytes
  const head = buffer.slice(0, 4);
  const isJPEG = head[0] === 0xFF && head[1] === 0xD8;
  const isPNG = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
  const isGIF = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
  const isWEBP = buffer.length > 12 && buffer.slice(8, 12).toString() === 'WEBP';

  if (!isJPEG && !isPNG && !isGIF && !isWEBP) {
    return { valid: false, reason: `INVALID FORMAT: magic bytes [${head[0]?.toString(16)}, ${head[1]?.toString(16)}, ${head[2]?.toString(16)}, ${head[3]?.toString(16)}] — not JPEG/PNG/GIF/WEBP.` };
  }

  // For JPEG and PNG: validate actual image dimensions via header parsing
  if (isJPEG) {
    const dims = getJpegDimensions(buffer);
    if (!dims) {
      return { valid: false, reason: `CORRUPT JPEG: no valid SOF marker found. The file starts with JPEG magic bytes but has no actual image data. This is hallucinated.` };
    }
    if (dims.width < 10 || dims.height < 10 || dims.width > 20000 || dims.height > 20000) {
      return { valid: false, reason: `INVALID JPEG DIMENSIONS: ${dims.width}x${dims.height}. This is not a real photo.` };
    }
    return { valid: true, dims };
  }

  if (isPNG) {
    const dims = getPngDimensions(buffer);
    if (!dims) {
      return { valid: false, reason: `CORRUPT PNG: no valid IHDR chunk found. This is hallucinated.` };
    }
    if (dims.width < 10 || dims.height < 10 || dims.width > 20000 || dims.height > 20000) {
      return { valid: false, reason: `INVALID PNG DIMENSIONS: ${dims.width}x${dims.height}. This is not a real photo.` };
    }
    return { valid: true, dims };
  }

  // GIF and WEBP: just check size (already checked above)
  return { valid: true };
}

const HALLUCINATION_ERROR = 'HALLUCINATED IMAGE DATA REJECTED. You CANNOT write base64 image data directly — it always produces garbage. You MUST use Code Interpreter (Python) first: run `from PIL import Image; import base64; from io import BytesIO; img = Image.open("/mnt/data/FILENAME"); img.thumbnail((1200,1200)); buf = BytesIO(); img.convert("RGB").save(buf,"JPEG",quality=80); b64=base64.b64encode(buf.getvalue()).decode(); print(len(b64))` — then call the storePhotos ACTION with {"images":[{"data":"THE_BASE64_FROM_PYTHON","mime_type":"image/jpeg"}]}. Process ALL photos the user uploaded.';

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

          // Comprehensive image validation (size + magic bytes + dimensions)
          const validation = validateImageBuffer(buffer);
          if (!validation.valid) {
            console.warn(`[StorePhotos] REJECTED: ${validation.reason} (${buffer.length} bytes)`);
            return res.json({
              success: false,
              photoUrls: [],
              message: HALLUCINATION_ERROR
            });
          }

          const dims = validation.dims;
          const id = storePhoto(buffer, mime);
          const stableUrl = `${baseUrl}/photo/${id}`;
          console.log(`[StorePhotos] Stored base64 image → /photo/${id} (${Math.round(buffer.length / 1024)}KB, ${mime}${dims ? `, ${dims.width}x${dims.height}` : ''})`);
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
          message: `FAILED: All ${urls.length} URLs are /mnt/data/ sandbox paths the server cannot access. FIX: Step A) Use Code Interpreter to read these files, compress with PIL (JPEG, max 1200px, quality=80), then base64-encode. Do NOT use urllib — Code Interpreter has no network. Step B) Call the storePhotos ACTION with {"images": [{"data":"<base64>","mime_type":"image/jpeg"}]}. Send max 3 images per call. The ACTION has network access, Code Interpreter does not.`
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
      message: 'NO PHOTOS RECEIVED. You MUST use Code Interpreter (Python) FIRST to process photos before calling this action. Step 1: In Code Interpreter run: from PIL import Image; import base64, glob; from io import BytesIO; files = glob.glob("/mnt/data/*"); results = []; for fp in files: if fp.lower().endswith((".jpg",".jpeg",".png",".webp")): img = Image.open(fp); img.thumbnail((1200,1200)); buf = BytesIO(); img.convert("RGB").save(buf,"JPEG",quality=80); b64 = base64.b64encode(buf.getvalue()).decode(); results.append(b64); print(f"{fp}: {len(b64)} chars"). Step 2: Call storePhotos ACTION with {"images":[{"data":"PASTE_EACH_B64_HERE","mime_type":"image/jpeg"}]}. Step 3: Use the returned photoUrls in generatePost. Do NOT skip Code Interpreter — you CANNOT write base64 yourself.'
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
