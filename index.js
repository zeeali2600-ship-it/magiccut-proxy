// HTTPS proxy for BG removal; supports ClipDrop (x-api-key) and Basic auth providers.
// Env:
//   TARGET_URL = upstream endpoint (e.g., https://clipdrop-api.co/remove-background/v1)
//   TARGET_AUTH = clipdrop | basic   (default: basic)
//   CLIPDROP_API_KEY = <for clipdrop>
//   API_ID / API_SECRET = <for basic>
//   PORT = (set by Render)
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

app.get('/health', (_, res) => res.json({ ok: true }));

app.post(['/remove-bg', '/remove'], upload.single('image'), async (req, res) => {
  try {
    const url = process.env.TARGET_URL;
    const auth = (process.env.TARGET_AUTH || 'basic').toLowerCase();

    if (!url) return res.status(500).json({ error: 'TARGET_URL missing' });
    if (!req.file) return res.status(400).json({ error: 'No file provided (field must be "image")' });

    // Upstream field mapping
    const upstreamField = auth === 'clipdrop' ? 'image_file' : 'image';

    const form = new FormData();
    form.append(upstreamField, req.file.buffer, {
      filename: 'input.png',
      contentType: req.file.mimetype || 'image/png'
    });

    // Add auth headers
    const headers = { ...form.getHeaders() };
    if (auth === 'clipdrop') {
      if (!process.env.CLIPDROP_API_KEY) return res.status(500).json({ error: 'CLIPDROP_API_KEY missing' });
      headers['x-api-key'] = process.env.CLIPDROP_API_KEY;
    } else {
      if (!process.env.API_ID || !process.env.API_SECRET) return res.status(500).json({ error: 'API_ID/API_SECRET missing' });
      const basic = Buffer.from(`${process.env.API_ID}:${process.env.API_SECRET}`).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    }

    const upstream = await fetch(url, { method: 'POST', headers, body: form });
    const ct = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '');
      return res.status(upstream.status).type('text/plain').send(errText || `Upstream error ${upstream.status}`);
    }

    if (ct.startsWith('image/')) {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', ct);
      return res.send(buf);
    }

    const text = await upstream.text();
    try {
      const json = JSON.parse(text);
      const b64 = json.image || (json.data && json.data.image) || json.result_b64;
      if (b64) {
        const img = Buffer.from(b64, 'base64');
        res.setHeader('Content-Type', 'image/png');
        return res.send(img);
      }
      return res.status(200).json(json);
    } catch {
      return res.status(200).type('text/plain').send(text);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Proxy error', detail: (e && e.message) || String(e) });
  }
});

const port = process.env.PORT || 5055;
app.listen(port, () => console.log(`MagicCut proxy running on :${port}`));
