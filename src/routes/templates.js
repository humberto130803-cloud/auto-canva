const express = require('express');
const router = express.Router();
const { LAYOUTS, POST_TYPES, THEME_NAMES, SIZE_NAMES, SIZES } = require('../services/templateEngine');
const { generateImage } = require('../services/renderer');

// GET /templates — list all available template options
router.get('/', (req, res) => {
  res.json({
    layouts: LAYOUTS.map(l => ({
      id: l,
      name: formatName(l),
      description: getLayoutDescription(l),
      photoCount: getPhotoCount(l)
    })),
    postTypes: POST_TYPES.map(p => ({
      id: p,
      name: formatName(p),
      description: getPostTypeDescription(p)
    })),
    colorThemes: THEME_NAMES.map(t => ({
      id: t,
      name: formatName(t),
      description: getThemeDescription(t)
    })),
    sizes: SIZE_NAMES.map(s => ({
      id: s,
      name: formatName(s),
      dimensions: SIZES[s]
    }))
  });
});

// GET /templates/preview/:combo — generate a preview with sample data
// combo format: layout-postType-colorTheme-size e.g. "hero-single_new-listing_dark_instagram-post"
router.get('/preview/:combo', async (req, res) => {
  try {
    const parts = req.params.combo.split('_');
    if (parts.length !== 4) {
      return res.status(400).json({
        error: 'Invalid combo format. Use: layout_postType_colorTheme_size',
        example: 'hero-single_new-listing_dark_instagram-post'
      });
    }

    const [layout, postType, colorTheme, size] = parts;

    const sampleProperty = {
      title: 'Luxury Ocean View Apartment',
      price: '$350,000',
      oldPrice: '$395,000',
      location: 'Punta Pacifica, Panama City',
      bedrooms: 3,
      bathrooms: 2,
      area: '185 m²',
      features: ['Ocean View', 'Pool', 'Gym', '24hr Security'],
      description: 'Stunning 3-bedroom apartment with panoramic ocean views in one of Panama City\'s most prestigious neighborhoods.',
      photos: [
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
        'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80',
        'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
        'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80'
      ]
    };

    const sampleOpenHouse = {
      date: 'Saturday, March 15',
      time: '10:00 AM - 2:00 PM'
    };

    const templateConfig = { layout, postType, colorTheme, size };
    const result = await generateImage(templateConfig, sampleProperty, sampleOpenHouse);

    return res.json({ success: true, preview: result });
  } catch (err) {
    console.error('[Preview] Error:', err);
    return res.status(500).json({ error: 'Preview generation failed', details: err.message });
  }
});

function formatName(id) {
  return id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getLayoutDescription(layout) {
  const desc = {
    'hero-single': '1 large hero image with text overlay — perfect for showcasing the best photo',
    'split-duo': '2 photos side by side with info bar at bottom',
    'feature-trio': '1 large photo on left, 2 stacked on right — great for showing multiple angles',
    'grid-quad': '4 photos in a grid with info banner at top',
    'grid-six': '6 photos in a 3×2 grid with minimal text overlay',
    'carousel-slides': 'Multiple slide images for Instagram carousel (cover + photos + details)'
  };
  return desc[layout] || '';
}

function getPhotoCount(layout) {
  const counts = {
    'hero-single': 1,
    'split-duo': 2,
    'feature-trio': 3,
    'grid-quad': 4,
    'grid-six': 6,
    'carousel-slides': 'variable (all photos used)'
  };
  return counts[layout];
}

function getPostTypeDescription(postType) {
  const desc = {
    'new-listing': 'Highlights a new property listing with a "NEW LISTING" badge',
    'open-house': 'Promotes an open house event with date and time',
    'just-sold': 'Celebrates a sold property with a "SOLD" stamp',
    'price-drop': 'Announces a price reduction with old price crossed out',
    'coming-soon': 'Teases an upcoming listing with a "COMING SOON" banner'
  };
  return desc[postType] || '';
}

function getThemeDescription(theme) {
  const desc = {
    'dark': 'Dark background with white and gold text — dramatic and luxurious',
    'light': 'White/cream background with dark text — clean and elegant',
    'blue': 'Navy/blue tones — classic real estate professional look',
    'gold': 'Black and gold — ultra luxury feel',
    'minimal': 'Mostly white, thin fonts — modern and clean',
    'custom': 'Custom primary and accent colors (pass customColors in request)'
  };
  return desc[theme] || '';
}

module.exports = router;
