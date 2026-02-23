const express = require('express');
const router = express.Router();
const { getPhoto } = require('../services/photoStore');

// Serve a stored photo by ID
router.get('/:id', (req, res) => {
  const { id } = req.params;

  // Sanitize ID — only allow UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid photo ID' });
  }

  const photo = getPhoto(id);
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found or expired' });
  }

  res.set('Content-Type', photo.mime);
  res.set('Cache-Control', 'public, max-age=1800'); // 30 min cache
  res.set('Access-Control-Allow-Origin', '*');
  res.send(photo.buffer);
});

module.exports = router;
