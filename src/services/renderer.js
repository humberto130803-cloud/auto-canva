const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { generateTemplate, SIZES } = require('./templateEngine');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'public', 'images', 'generated');

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance || !browserInstance.connected) {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--allow-file-access-from-files'
      ]
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    browserInstance = await puppeteer.launch(launchOptions);
  }
  return browserInstance;
}

/**
 * Download an image URL and return as base64 data URI.
 * Handles redirects, HTTPS, and various content types.
 */
function downloadImageAsBase64(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (!url || url.startsWith('data:')) {
      return resolve(url); // Already a data URI or empty
    }

    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, { timeout: 15000, headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }}, (res) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
        return downloadImageAsBase64(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }

      const contentType = res.headers['content-type'] || 'image/jpeg';
      const mime = contentType.split(';')[0].trim();
      const chunks = [];

      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve(`data:${mime};base64,${base64}`);
      });
      res.on('error', reject);
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Pre-download all photos and replace URLs with base64 data URIs.
 * This ensures Puppeteer doesn't need to fetch external images.
 */
async function preDownloadPhotos(property) {
  if (!property.photos || property.photos.length === 0) return property;

  const downloaded = { ...property, photos: [] };

  for (const photoUrl of property.photos) {
    try {
      console.log(`[Download] Fetching: ${photoUrl.substring(0, 80)}...`);
      const dataUri = await downloadImageAsBase64(photoUrl);
      downloaded.photos.push(dataUri);
      console.log(`[Download] OK (${Math.round(dataUri.length / 1024)}KB base64)`);
    } catch (err) {
      console.error(`[Download] Failed: ${err.message} — using placeholder`);
      downloaded.photos.push(null); // Will become placeholder in template
    }
  }

  return downloaded;
}

async function renderHtmlToImage(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // Since images are now base64-embedded, we only need to wait for fonts
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 500));

    const imageBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });

    return imageBuffer;
  } finally {
    await page.close();
  }
}

async function generateImage(templateConfig, property, openHouse) {
  const { size, layout } = templateConfig;
  const dim = SIZES[size];

  if (!dim) {
    throw new Error(`Unknown size: ${size}`);
  }

  // Pre-download all photos as base64 before template rendering
  const processedProperty = await preDownloadPhotos(property);

  const htmlResult = generateTemplate(templateConfig, processedProperty, openHouse);

  // Ensure output directory exists
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  // Carousel: multiple images
  if (Array.isArray(htmlResult)) {
    const baseId = uuidv4();
    const urls = [];

    for (let i = 0; i < htmlResult.length; i++) {
      const filename = `${baseId}-slide-${i + 1}.png`;
      const filePath = path.join(GENERATED_DIR, filename);
      const buffer = await renderHtmlToImage(htmlResult[i], dim.width, dim.height);
      fs.writeFileSync(filePath, buffer);

      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
      urls.push(`${baseUrl}/image/${filename}`);
    }

    return { type: 'carousel', urls };
  }

  // Single image
  const filename = `${uuidv4()}.png`;
  const filePath = path.join(GENERATED_DIR, filename);
  const buffer = await renderHtmlToImage(htmlResult, dim.width, dim.height);
  fs.writeFileSync(filePath, buffer);

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  return { type: 'single', url: `${baseUrl}/image/${filename}` };
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);

module.exports = { generateImage, renderHtmlToImage, closeBrowser };
