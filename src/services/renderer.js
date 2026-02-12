const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
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

async function renderHtmlToImage(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Wait a bit for fonts to load
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

  const htmlResult = generateTemplate(templateConfig, property, openHouse);

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
