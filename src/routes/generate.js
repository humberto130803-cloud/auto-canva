const express = require('express');
const router = express.Router();
const { generateImage } = require('../services/renderer');
const { LAYOUTS, POST_TYPES, THEME_NAMES, SIZE_NAMES } = require('../services/templateEngine');

/**
 * Extract photo URLs from openaiFileIdRefs if present.
 * ChatGPT sends uploaded files as JSON objects with:
 *   { name, id, mime_type, download_link }
 * download_link is a signed URL valid for ~5 minutes.
 * See: https://platform.openai.com/docs/actions/sending-files
 */
function extractPhotosFromFileRefs(body) {
  const refs = body.openaiFileIdRefs;
  if (!refs || !Array.isArray(refs) || refs.length === 0) return null;

  console.log(`[FileRef] Received ${refs.length} file ref(s). Raw type: ${typeof refs[0]}`);
  console.log(`[FileRef] Raw payload:`, JSON.stringify(refs).substring(0, 500));

  const photoUrls = [];
  for (const ref of refs) {
    // Handle both possible field names and formats
    if (typeof ref === 'string') {
      // Sometimes it arrives as a plain URL string
      if (ref.startsWith('http')) {
        photoUrls.push(ref);
        console.log(`[FileRef] Got plain URL string: ${ref.substring(0, 100)}...`);
      }
      continue;
    }

    // Object format: { name, id, mime_type, download_link }
    const url = ref.download_link || ref.download_url || ref.url;
    if (url) {
      photoUrls.push(url);
      console.log(`[FileRef] Got file: ${ref.name || 'unnamed'} (${ref.mime_type || 'unknown'}) — ${url.substring(0, 100)}...`);
    } else {
      console.log(`[FileRef] Ref has no download link. Keys: ${Object.keys(ref).join(', ')}`);
      console.log(`[FileRef] Full ref:`, JSON.stringify(ref).substring(0, 300));
    }
  }

  return photoUrls.length > 0 ? photoUrls : null;
}

router.post('/', async (req, res) => {
  try {
    const { template, property, openHouse, labels } = req.body;

    // Log the full request body keys for debugging
    console.log(`[Generate] Request body keys: ${Object.keys(req.body).join(', ')}`);
    if (req.body.openaiFileIdRefs) {
      console.log(`[Generate] openaiFileIdRefs present: ${Array.isArray(req.body.openaiFileIdRefs) ? req.body.openaiFileIdRefs.length + ' items' : typeof req.body.openaiFileIdRefs}`);
    }

    // Validate required fields
    if (!template) {
      return res.status(400).json({ error: 'Missing "template" configuration' });
    }
    if (!property) {
      return res.status(400).json({ error: 'Missing "property" data' });
    }

    const { layout, postType, colorTheme, size } = template;

    // Validate template options
    if (!layout || !LAYOUTS.includes(layout)) {
      return res.status(400).json({
        error: `Invalid layout. Must be one of: ${LAYOUTS.join(', ')}`,
        provided: layout
      });
    }
    if (!postType || !POST_TYPES.includes(postType)) {
      return res.status(400).json({
        error: `Invalid postType. Must be one of: ${POST_TYPES.join(', ')}`,
        provided: postType
      });
    }
    if (!colorTheme || !THEME_NAMES.includes(colorTheme)) {
      return res.status(400).json({
        error: `Invalid colorTheme. Must be one of: ${THEME_NAMES.join(', ')}`,
        provided: colorTheme
      });
    }
    if (!size || !SIZE_NAMES.includes(size)) {
      return res.status(400).json({
        error: `Invalid size. Must be one of: ${SIZE_NAMES.join(', ')}`,
        provided: size
      });
    }

    // Validate property has at minimum a title
    if (!property.title) {
      return res.status(400).json({ error: 'Property must have at least a "title"' });
    }

    // Extract photos from openaiFileIdRefs if present (ChatGPT file uploads)
    const fileRefPhotos = extractPhotosFromFileRefs(req.body);
    if (fileRefPhotos) {
      const existingPhotos = property.photos || [];
      property.photos = [...fileRefPhotos, ...existingPhotos];
      console.log(`[Generate] Using ${fileRefPhotos.length} photos from openaiFileIdRefs + ${existingPhotos.length} from property.photos`);
    }

    // Also log what photo URLs we have
    if (property.photos && property.photos.length > 0) {
      property.photos.forEach((url, i) => {
        console.log(`[Generate] Photo ${i + 1}: ${url ? url.substring(0, 120) : 'null'}...`);
      });
    }

    console.log(`[Generate] ${layout} / ${postType} / ${colorTheme} / ${size} — ${(property.photos || []).length} photos`);
    const result = await generateImage(template, property, openHouse, labels);

    if (result.type === 'carousel') {
      return res.json({
        success: true,
        type: 'carousel',
        slideCount: result.urls.length,
        urls: result.urls
      });
    }

    return res.json({
      success: true,
      type: 'single',
      url: result.url
    });
  } catch (err) {
    console.error('[Generate] Error:', err);
    return res.status(500).json({ error: 'Image generation failed', details: err.message });
  }
});

module.exports = router;
