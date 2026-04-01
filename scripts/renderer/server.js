const express = require('express');
const puppeteer = require('puppeteer-core');

const app = express();
app.use(express.json({ limit: '10mb' }));

let browser = null;

async function getBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }
  return browser;
}

// POST /render - receives HTML, returns PNG buffer as base64
app.post('/render', async (req, res) => {
  try {
    const { html, width = 1080, height = 1080 } = req.body;
    if (!html) return res.status(400).json({ error: 'html is required' });

    const b = await getBrowser();
    const page = await b.newPage();
    await page.setViewport({ width, height });

    // Inject Tailwind CSS CDN
    const fullHtml = html.includes('<html') ? html : `
      <!DOCTYPE html>
      <html>
      <head>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Inter', sans-serif; }</style>
      </head>
      <body>${html}</body>
      </html>
    `;

    await page.setContent(fullHtml, { waitUntil: 'networkidle0', timeout: 15000 });
    const screenshot = await page.screenshot({ type: 'png' });
    await page.close();

    res.json({
      success: true,
      image: screenshot.toString('base64'),
      width,
      height,
    });
  } catch (err) {
    console.error('Render error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Renderer service running on port ${PORT}`);
});
