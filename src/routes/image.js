const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'public', 'images', 'generated');

// GET /image/:filename — serve a generated image
router.get('/:filename', (req, res) => {
  const filename = req.params.filename;

  // Sanitize filename — only allow alphanumeric, hyphens, dots
  if (!/^[a-zA-Z0-9\-]+\.png$/.test(filename)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(GENERATED_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Image not found' });
  }

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(filePath);
});

module.exports = router;
