const express = require('express');
const router = express.Router();
const { generateImage } = require('../services/renderer');
const { LAYOUTS, POST_TYPES, THEME_NAMES, SIZE_NAMES } = require('../services/templateEngine');

/**
 * Extract photo URLs from openaiFileIdRefs if present.
 * ChatGPT sends uploaded files through this mechanism with temporary download URLs.
 * See: https://platform.openai.com/docs/actions/sending-files
 */
function extractPhotosFromFileRefs(body) {
  const refs = body.openaiFileIdRefs;
  if (!refs || !Array.isArray(refs) || refs.length === 0) return null;

  const photoUrls = [];
  for (const ref of refs) {
    if (ref.download_url) {
      photoUrls.push(ref.download_url);
      console.log(`[FileRef] Got file: ${ref.name || 'unnamed'} (${ref.mime_type || 'unknown'}) — ${ref.download_url.substring(0, 80)}...`);
    }
  }
  return photoUrls.length > 0 ? photoUrls : null;
}

router.post('/', async (req, res) => {
  try {
    const { template, property, openHouse, labels } = req.body;

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
      // Merge: fileRef photos take priority, then append any existing property.photos
      const existingPhotos = property.photos || [];
      property.photos = [...fileRefPhotos, ...existingPhotos];
      console.log(`[Generate] Using ${fileRefPhotos.length} photos from openaiFileIdRefs + ${existingPhotos.length} from property.photos`);
    }

    console.log(`[Generate] ${layout} / ${postType} / ${colorTheme} / ${size} — ${(property.photos || []).length} photos`);
    const result = await generateImage(template, property, openHouse, labels);

    if (result.type === 'carousel') {
      return res.json({
        success: true,
        type: 'carousel',
        slideCount: result.urls.length,
        urls: result.urls,
        openai_image_urls: result.images_base64
      });
    }

    return res.json({
      success: true,
      type: 'single',
      url: result.url,
      openai_image_url: result.image_base64
    });
  } catch (err) {
    console.error('[Generate] Error:', err);
    return res.status(500).json({ error: 'Image generation failed', details: err.message });
  }
});

module.exports = router;
