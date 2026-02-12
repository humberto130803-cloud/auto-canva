const express = require('express');
const router = express.Router();
const { generateImage } = require('../services/renderer');
const { LAYOUTS, POST_TYPES, THEME_NAMES, SIZE_NAMES } = require('../services/templateEngine');

router.post('/', async (req, res) => {
  try {
    const { template, property, openHouse } = req.body;

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

    console.log(`[Generate] ${layout} / ${postType} / ${colorTheme} / ${size}`);
    const result = await generateImage(template, property, openHouse);

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
