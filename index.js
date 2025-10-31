// Minimal HTTPS proxy for background removal (Store-safe client)
// Env: TARGET_URL, API_ID, API_SECRET, PORT (Render sets PORT)
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const app = express();
const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

app.get('/health', (_, res) => res.json({ ok: true }));

app.post(['/remove-bg', '/remove'], upload.single('image'), async (req, res) => {
  try {
    if (!process.env.TARGET_URL || !process.env.API_ID || !process.env.API_SECRET) {
      return res.status(500).json({ error: 'Server not configured' });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided (field name should be \"image\")' });

    const form = new FormData();
    form.append('image', file.buffer, { filename: 'input.png', contentType: file.mimetype || 'image/png' });

    // Zarurat ho to uncomment:
    // form.append('background', 'transparent');

    const basic = Buffer.from(`${process.env.API_ID}:${process.env.API_SECRET}`).toString('base64');
    const upstream = await fetch(process.env.TARGET_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}`, ...form.getHeaders() },
      body: form,
    });

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
