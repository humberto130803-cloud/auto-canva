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
 * Pre-process all photos for Puppeteer rendering.
 *
 * For our own /photo/:id URLs: convert to http://localhost URLs so Puppeteer
 * loads them via HTTP from the same Express server. This is much more reliable
 * than embedding multi-MB base64 data URIs in HTML (which caused black photos
 * because Puppeteer didn't wait long enough to decode them).
 *
 * For external URLs: download and convert to base64 data URIs (or keep original).
 */
async function preDownloadPhotos(property) {
  if (!property.photos || property.photos.length === 0) return property;

  // Process all photos in parallel for speed
  const downloadPromises = property.photos.map(async (photoUrl) => {
    if (!photoUrl) return null;

    // Check if this is our own /photo/:id URL — convert to data URI directly.
    // Using data URIs avoids localhost networking issues on Render (IPv6/IPv4 mismatch).
    // Photos are compressed to ~10-20KB so data URIs are small and fast to decode.
    const photoIdMatch = photoUrl.match(/\/photo\/([0-9a-f-]{36})$/i);
    if (photoIdMatch) {
      const { getPhotoAsDataUri } = require('./photoStore');
      const dataUri = getPhotoAsDataUri(photoIdMatch[1]);
      if (dataUri) {
        console.log(`[Download] Photo ${photoIdMatch[1]} → data URI (${Math.round(dataUri.length / 1024)}KB)`);
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
      // Also cache under URL if we cached by fileId, so future requests
      // without openaiFileIdRefs can still find the photo by URL
      if (fileId && cacheKey !== photoUrl) {
        setCachedPhoto(photoUrl, dataUri);
      }
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

    const hasHttpImages = html.includes('src="http://') || html.includes('src="https://');
    const hasDataUriImages = html.includes('src="data:image/');

    // Use networkidle0 when images are loaded via HTTP (including localhost /photo/ URLs).
    // This ensures Puppeteer waits for all images to fully load before taking the screenshot.
    // For data URIs, use networkidle0 as well but with shorter extra wait.
    const needsImageWait = hasHttpImages || hasDataUriImages;
    const waitStrategy = needsImageWait ? 'networkidle0' : 'domcontentloaded';

    console.log(`[Render] Strategy: ${waitStrategy} (httpImages=${hasHttpImages}, dataUriImages=${hasDataUriImages})`);
    await page.setContent(html, { waitUntil: waitStrategy, timeout: 30000 });

    await page.evaluate(() => document.fonts.ready);
    // Wait for images to fully render:
    // - HTTP images (including localhost): 500ms (localhost is fast)
    // - Data URI images: 1000ms (large base64 needs decode time)
    // - No images: 200ms (just fonts/layout)
    const extraWait = hasHttpImages ? 500 : hasDataUriImages ? 1000 : 200;
    await new Promise(r => setTimeout(r, extraWait));

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

  // Pre-process photos: convert /photo/{id} URLs to localhost HTTP URLs
  console.log(`[GenerateImage] Input photos: ${(property.photos || []).length}`);
  (property.photos || []).forEach((u, i) => console.log(`[GenerateImage]   photo[${i}] input: ${u ? u.substring(0, 120) : 'null'}`));

  const processedProperty = await preDownloadPhotos(property);

  console.log(`[GenerateImage] Processed photos: ${(processedProperty.photos || []).length}`);
  (processedProperty.photos || []).forEach((u, i) => {
    const preview = u ? (u.length > 120 ? u.substring(0, 80) + '...[' + Math.round(u.length/1024) + 'KB]' : u) : 'null';
    console.log(`[GenerateImage]   photo[${i}] output: ${preview}`);
  });

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

module.exports = { generateImage, renderHtmlToImage, closeBrowser, downloadImageAsBase64, downloadWithRetry, warmupBrowser };
