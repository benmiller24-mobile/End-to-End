// Leonardo AI image generation — server-side proxy.
// The API key lives here (server-side) so the end user never enters it and it
// is never shipped in the browser bundle. Prefers the LEONARDO_API_KEY env var
// (set it in Netlify → Site settings → Environment variables to keep the key out
// of git); falls back to the embedded key so it works without any config.
// Also fixes the browser CORS block on cloud.leonardo.ai (must be server→server).
//
// POST /api/leonardo  { prompt }            → { generationId }
// GET  /api/leonardo?id=<generationId>      → { status, url? }

const LEONARDO_KEY = process.env.LEONARDO_API_KEY || '02287e55-c723-4d62-965d-ccba8daa255b';
const BASE = 'https://cloud.leonardo.ai/api/rest/v1';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  try {
    if (req.method === 'POST') {
      const { prompt } = await req.json();
      if (!prompt) return json({ error: 'prompt required' }, 400);
      const r = await fetch(`${BASE}/generations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${LEONARDO_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          modelId: 'e71a1c2f-4f80-4800-934f-2c68979d8cc8', // Leonardo Kino XL
          width: 1360, height: 768, num_images: 1, guidance_scale: 7,
          alchemy: true, photoReal: true, photoRealVersion: 'v2', presetStyle: 'CINEMATIC',
          negative_prompt: 'blurry, low quality, distorted, cartoon, anime, illustration, painting, sketch, watermark, text, logo',
        }),
      });
      if (!r.ok) return json({ error: `Leonardo API error ${r.status}: ${await r.text()}` }, r.status);
      const d = await r.json();
      const generationId = d.sdGenerationJob?.generationId;
      if (!generationId) return json({ error: 'No generation ID returned' }, 502);
      return json({ generationId });
    }

    if (req.method === 'GET') {
      const id = new URL(req.url).searchParams.get('id');
      if (!id) return json({ error: 'id required' }, 400);
      const r = await fetch(`${BASE}/generations/${id}`, { headers: { Authorization: `Bearer ${LEONARDO_KEY}` } });
      if (!r.ok) return json({ status: 'PENDING' });
      const d = await r.json();
      const g = d.generations_by_pk;
      const imgs = g?.generated_images || [];
      if (imgs.length > 0) return json({ status: 'COMPLETE', url: imgs[0].url });
      if (g?.status === 'FAILED') return json({ status: 'FAILED' });
      return json({ status: g?.status || 'PENDING' });
    }

    return json({ error: 'POST or GET required' }, 405);
  } catch (err) {
    return json({ error: err.message }, 500);
  }
};

export const config = { path: '/api/leonardo' };
