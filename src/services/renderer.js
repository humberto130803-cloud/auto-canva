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
function downloadImageAsBase64(url, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    if (!url || url.startsWith('data:')) {
      return resolve(url); // Already a data URI or empty
    }

    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Encoding': 'identity'
      }
    }, (res) => {
      // Handle redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
        let redirectUrl = res.headers.location;
        // Handle relative redirects
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        return downloadImageAsBase64(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
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
        if (buffer.length < 100) {
          return reject(new Error('Image too small, likely an error page'));
        }
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
 * Try downloading with retry logic.
 */
async function downloadWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await downloadImageAsBase64(url);
    } catch (err) {
      console.error(`[Download] Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // backoff
      } else {
        throw err;
      }
    }
  }
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
      console.log(`[Download] Fetching: ${photoUrl.substring(0, 100)}...`);
      const dataUri = await downloadWithRetry(photoUrl);
      downloaded.photos.push(dataUri);
      console.log(`[Download] OK (${Math.round(dataUri.length / 1024)}KB base64)`);
    } catch (err) {
      console.error(`[Download] Failed after retries: ${err.message} — using placeholder`);
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

async function generateImage(templateConfig, property, openHouse, labels) {
  const { size, layout } = templateConfig;
  const dim = SIZES[size];

  if (!dim) {
    throw new Error(`Unknown size: ${size}`);
  }

  // Pre-download all photos as base64 before template rendering
  const processedProperty = await preDownloadPhotos(property);

  const htmlResult = generateTemplate(templateConfig, processedProperty, openHouse, labels);

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
