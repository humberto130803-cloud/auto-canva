require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');

const generateRoute = require('./routes/generate');
const templatesRoute = require('./routes/templates');
const imageRoute = require('./routes/image');
const uploadRoute = require('./routes/upload');
const photoRoute = require('./routes/photo');
const { cleanupOldImages } = require('./services/cleanup');
const { cleanupExpiredPhotos } = require('./services/photoStore');
const { warmupBrowser } = require('./services/renderer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Static files
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// Upload page — serve at /upload
app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'upload.html'));
});

// API Routes
app.use('/generate', generateRoute);
app.use('/templates', templatesRoute);
app.use('/image', imageRoute);
app.use('/api/upload', uploadRoute);
app.use('/photo', photoRoute);

// Privacy policy
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'privacy-policy.html'));
});

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Real Estate Post Generator API',
    version: '2.0.0',
    upload: '/upload'
  });
});

// Cleanup cron jobs — run every 15 minutes
cron.schedule('*/15 * * * *', () => {
  console.log('[Cron] Running cleanup...');
  cleanupOldImages();
  cleanupExpiredPhotos();
});

// Ensure generated images directory exists
const generatedDir = path.join(__dirname, '..', 'public', 'images', 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
  console.log(`Upload page: ${process.env.BASE_URL || `http://localhost:${PORT}`}/upload`);

  // Pre-launch Puppeteer browser so first request doesn't cold-start
  warmupBrowser().then(() => {
    console.log('[Warmup] Puppeteer browser ready');
  }).catch(err => {
    console.error('[Warmup] Browser pre-launch failed (will retry on first request):', err.message);
  });
});

module.exports = app;
