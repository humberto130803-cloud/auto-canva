const fs = require('fs');
const path = require('path');

const GENERATED_DIR = path.join(__dirname, '..', '..', 'public', 'images', 'generated');
const TTL_HOURS = parseInt(process.env.IMAGE_TTL_HOURS || '24', 10);

function cleanupOldImages() {
  const now = Date.now();
  const maxAge = TTL_HOURS * 60 * 60 * 1000;

  if (!fs.existsSync(GENERATED_DIR)) return;

  const files = fs.readdirSync(GENERATED_DIR);
  let deleted = 0;

  for (const file of files) {
    const filePath = path.join(GENERATED_DIR, file);
    try {
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        deleted++;
      }
    } catch (err) {
      console.error(`[Cleanup] Error processing ${file}:`, err.message);
    }
  }

  if (deleted > 0) {
    console.log(`[Cleanup] Deleted ${deleted} old image(s)`);
  }
}

module.exports = { cleanupOldImages };
