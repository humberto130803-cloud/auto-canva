const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
const { generateTemplate, SIZES } = require('./templateEngine');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'public', 'images', 'generated');

let browserInstance = null;

// Cache downloaded photos in memory so expired download_links don't break repeat requests
// Key: original URL (or a hash), Value: { dataUri, timestamp }
const photoCache = new Map();
const PHOTO_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function getCachedPhoto(url) {
  const entry = photoCache.get(url);
  if (entry && (Date.now() - entry.timestamp) < PHOTO_CACHE_TTL) {
    return entry.dataUri;
  }
  if (entry) photoCache.delete(url); // expired
  return null;
}

function setCachedPhoto(url, dataUri) {
  photoCache.set(url, { dataUri, timestamp: Date.now() });
  // Evict old entries if cache grows too large (>50 photos)
  if (photoCache.size > 50) {
    const now = Date.now();
    for (const [key, val] of photoCache) {
      if (now - val.timestamp > PHOTO_CACHE_TTL) photoCache.delete(key);
    }
  }
}

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
      timeout: 15000,
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
        if (redirectUrl.startsWith('/')) {
          const parsed = new URL(url);
          redirectUrl = `${parsed.protocol}//${parsed.host}${redirectUrl}`;
        }
        return downloadImageAsBase64(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        // Read body for error details
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString().substring(0, 200);
          reject(new Error(`HTTP ${res.statusCode} for ${url.substring(0, 80)} - ${body}`));
        });
        return;
      }

      const contentType = res.headers['content-type'] || 'image/jpeg';
      const mime = contentType.split(';')[0].trim();

      // Validate that the response is actually an image
      const isImage = mime.startsWith('image/') || mime === 'application/octet-stream';
      if (!isImage) {
        return reject(new Error(`Not an image: content-type is ${mime}`));
      }

      const chunks = [];

      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 500) {
          return reject(new Error(`Image too small (${buffer.length} bytes)`));
        }

        // Check magic bytes
        const head = buffer.slice(0, 4);
        const isJPEG = head[0] === 0xFF && head[1] === 0xD8;
        const isPNG = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4E && head[3] === 0x47;
        const isGIF = head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46;
        const isWEBP = buffer.length > 12 && buffer.slice(8, 12).toString() === 'WEBP';
        const isSVG = buffer.slice(0, 100).toString().trim().startsWith('<');

        if (!isJPEG && !isPNG && !isGIF && !isWEBP && !isSVG) {
          const textSample = buffer.slice(0, 200).toString();
          if (textSample.includes('<html') || textSample.includes('<!DOCTYPE') || textSample.includes('Access Denied') || textSample.includes('AuthenticationFailed') || textSample.includes('BlobNotFound')) {
            return reject(new Error(`Content is HTML/error, not an image`));
          }
        }

        const base64 = buffer.toString('base64');
        const finalMime = isJPEG ? 'image/jpeg' : isPNG ? 'image/png' : isGIF ? 'image/gif' : isWEBP ? 'image/webp' : mime;
        resolve(`data:${finalMime};base64,${base64}`);
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
async function downloadWithRetry(url, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await downloadImageAsBase64(url);
    } catch (err) {
      console.error(`[Download] Attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Pre-download all photos and replace URLs with base64 data URIs.
 * Recognizes our own /photo/:id URLs and resolves them from in-memory store.
 * If download fails, keep the original URL so Puppeteer can try loading it.
 */
async function preDownloadPhotos(property) {
  if (!property.photos || property.photos.length === 0) return property;

  const { getPhotoAsDataUri } = require('./photoStore');

  // Download all photos in parallel for speed
  const downloadPromises = property.photos.map(async (photoUrl) => {
    if (!photoUrl) return null;

    // Check if this is our own /photo/:id URL — resolve from in-memory store
    const photoIdMatch = photoUrl.match(/\/photo\/([0-9a-f-]{36})$/i);
    if (photoIdMatch) {
      const dataUri = getPhotoAsDataUri(photoIdMatch[1]);
      if (dataUri) {
        console.log(`[Download] Resolved from store: ${photoIdMatch[1]} (${Math.round(dataUri.length / 1024)}KB)`);
        return dataUri;
      } else {
        console.error(`[Download] Photo ${photoIdMatch[1]} not found in store (expired?)`);
        return null;
      }
    }

    // Determine cache key: use fileId if available (stable across requests),
    // otherwise fall back to URL (which changes for signed URLs)
    const fileIds = property._photoFileIds || {};
    const fileId = fileIds[photoUrl];
    const cacheKey = fileId || photoUrl;

    // Check cache first (handles expired download_links on repeat requests)
    const cached = getCachedPhoto(cacheKey);
    if (cached) {
      console.log(`[Download] Cache hit for ${fileId ? `fileId:${fileId}` : 'url'} (${Math.round(cached.length / 1024)}KB)`);
      return cached;
    }

    // External URL — try downloading
    try {
      console.log(`[Download] Fetching: ${photoUrl.substring(0, 120)}...`);
      const dataUri = await downloadWithRetry(photoUrl);
      console.log(`[Download] OK (${Math.round(dataUri.length / 1024)}KB base64)`);
      // Cache by stable key (fileId preferred) for future requests
      setCachedPhoto(cacheKey, dataUri);
      return dataUri;
    } catch (err) {
      console.error(`[Download] Failed after retries: ${err.message}`);
      // If we have a fileId, also check cache under the URL key as fallback
      if (fileId) {
        const urlCached = getCachedPhoto(photoUrl);
        if (urlCached) {
          console.log(`[Download] URL cache fallback hit`);
          return urlCached;
        }
      }
      console.log(`[Download] Keeping original URL for Puppeteer to try`);
      return photoUrl;
    }
  });

  const photos = await Promise.all(downloadPromises);
  return { ...property, photos };
}

async function renderHtmlToImage(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const hasExternalImages = html.includes('src="http://') || html.includes('src="https://');

    // Use networkidle0 only if external images exist (rare — we pre-download as base64)
    // Otherwise domcontentloaded is much faster
    const waitStrategy = hasExternalImages ? 'networkidle0' : 'domcontentloaded';
    await page.setContent(html, { waitUntil: waitStrategy, timeout: 30000 });

    await page.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, hasExternalImages ? 1000 : 300));

    const imageBuffer = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });

    return imageBuffer;
  } finally {
    await page.close();
  }
}

/**
 * Generate image and save to disk. Returns URL(s) for serving.
 * Images are saved as PNG files and served via /image/ endpoint.
 */
async function generateImage(templateConfig, property, openHouse, labels) {
  const { size, layout } = templateConfig;
  const dim = SIZES[size];

  if (!dim) {
    throw new Error(`Unknown size: ${size}`);
  }

  // Pre-download all photos as base64
  const processedProperty = await preDownloadPhotos(property);

  const htmlResult = generateTemplate(templateConfig, processedProperty, openHouse, labels);

  // Ensure output directory exists
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

  // Carousel: multiple images
  if (Array.isArray(htmlResult)) {
    const baseId = uuidv4();
    const urls = [];

    for (let i = 0; i < htmlResult.length; i++) {
      const filename = `${baseId}-slide-${i + 1}.png`;
      const filePath = path.join(GENERATED_DIR, filename);
      const buffer = await renderHtmlToImage(htmlResult[i], dim.width, dim.height);

      fs.writeFileSync(filePath, buffer);
      urls.push(`${baseUrl}/image/${filename}`);
    }

    return { type: 'carousel', urls };
  }

  // Single image
  const filename = `${uuidv4()}.png`;
  const filePath = path.join(GENERATED_DIR, filename);
  const buffer = await renderHtmlToImage(htmlResult, dim.width, dim.height);

  fs.writeFileSync(filePath, buffer);
  const url = `${baseUrl}/image/${filename}`;

  return { type: 'single', url };
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

process.on('SIGINT', closeBrowser);
process.on('SIGTERM', closeBrowser);

async function warmupBrowser() {
  await getBrowser();
}

module.exports = { generateImage, renderHtmlToImage, closeBrowser, downloadWithRetry, warmupBrowser };
