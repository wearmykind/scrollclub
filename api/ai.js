// Vercel serverless function — proxy ke Anthropic API.
// API key disimpan di environment variable ANTHROPIC_API_KEY (Vercel Project Settings >
// Environment Variables), TIDAK PERNAH dikirim ke browser. index.html cuma fetch('/api/ai').
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY belum di-set di Vercel Project Settings > Environment Variables.' });
    return;
  }
  try {
    const { messages, tools } = req.body || {};
    if (!messages) {
      res.status(400).json({ error: 'messages wajib diisi' });
      return;
    }
    const body = { model: 'claude-sonnet-4-6', max_tokens: 1000, messages };
    if (tools) body.tools = tools;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Gagal menghubungi Anthropic API' });
  }
}
