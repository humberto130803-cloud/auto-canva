require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const fs = require('fs');

const generateRoute = require('./routes/generate');
const templatesRoute = require('./routes/templates');
const imageRoute = require('./routes/image');
const { cleanupOldImages } = require('./services/cleanup');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Static files
app.use('/public', express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/generate', generateRoute);
app.use('/templates', templatesRoute);
app.use('/image', imageRoute);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Real Estate Post Generator API',
    version: '1.0.0'
  });
});

// Cleanup cron job — runs every hour, deletes images older than IMAGE_TTL_HOURS
cron.schedule('0 * * * *', () => {
  console.log('[Cron] Running image cleanup...');
  cleanupOldImages();
});

// Ensure generated images directory exists
const generatedDir = path.join(__dirname, '..', 'public', 'images', 'generated');
if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Base URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}`);
});

module.exports = app;
