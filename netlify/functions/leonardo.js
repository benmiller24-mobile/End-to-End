// Leonardo AI image generation — server-side proxy.
// Key comes from the LEONARDO_API_KEY env var (set in Netlify site settings);
// it is never shipped to the browser, and the proxy also fixes the CORS block
// on cloud.leonardo.ai.
//
// POST /api/leonardo  { prompt, initImage?, controlnetWeight? }  -> { generationId }
//   - initImage (base64 PNG, no data: prefix) → structure-locked render: the
//     image is uploaded to Leonardo and used as an Edge-to-Image (Canny)
//     ControlNet (preprocessorId 19, SDXL) so the render traces the elevation.
//   - no initImage → standard PhotoReal perspective render.
// GET  /api/leonardo?id=<generationId>  -> { status, url? }

const LEONARDO_KEY = process.env.LEONARDO_API_KEY;
const BASE = 'https://cloud.leonardo.ai/api/rest/v1';
const MODEL_KINO_XL = 'aa77f04e-3eec-4034-9c07-d0f619684628'; // SDXL (supports PhotoReal v2 + Edge ControlNet 19)
const H = { Authorization: `Bearer ${LEONARDO_KEY}`, 'Content-Type': 'application/json' };

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

// Upload a PNG buffer to Leonardo via the presigned-S3 flow; returns the init image id.
async function uploadInitImage(buffer) {
  const initRes = await fetch(`${BASE}/init-image`, { method: 'POST', headers: H, body: JSON.stringify({ extension: 'png' }) });
  if (!initRes.ok) throw new Error(`init-image presign failed ${initRes.status}: ${await initRes.text()}`);
  const u = (await initRes.json()).uploadInitImage;
  const fields = JSON.parse(u.fields);
  const form = new FormData();
  for (const k of Object.keys(fields)) form.append(k, fields[k]);
  form.append('file', new Blob([buffer], { type: 'image/png' }), 'elevation.png');
  const up = await fetch(u.url, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`init-image S3 upload failed ${up.status}`);
  return u.id;
}

export default async (req) => {
  try {
    if (!LEONARDO_KEY) return json({ error: 'LEONARDO_API_KEY is not configured on the server' }, 503);
    if (req.method === 'POST') {
      const { prompt, initImage, controlnetWeight, mode } = await req.json();
      if (!prompt) return json({ error: 'prompt required' }, 400);

      let body;
      if (initImage && mode === 'img2img') {
        // Photoreal pass over an accurate 3D render: image-to-image keeps the
        // exact composition/geometry and only adds realism. Lower init_strength
        // = closer to the 3D source.
        const initImageId = await uploadInitImage(Buffer.from(initImage, 'base64'));
        body = {
          prompt, modelId: MODEL_KINO_XL, width: 1360, height: 768, num_images: 1,
          alchemy: true, presetStyle: 'CINEMATIC',
          negative_prompt: 'blurry, low quality, distorted, cartoon, anime, illustration, sketch, watermark, text, logo, extra cabinets, warped geometry, crooked cabinet lines, floating cabinets, duplicate island, extra windows, extra doors, mismatched hardware, people, clutter',
          init_image_id: initImageId,
          init_strength: typeof controlnetWeight === 'number' ? controlnetWeight : 0.45,
        };
      } else if (initImage) {
        // Structure-locked (Edge ControlNet) — traces the uploaded elevation.
        const buffer = Buffer.from(initImage, 'base64');
        const initImageId = await uploadInitImage(buffer);
        body = {
          prompt, modelId: MODEL_KINO_XL,
          width: 1536, height: 640,          // wide, matches an elevation
          num_images: 1, alchemy: true, presetStyle: 'CINEMATIC',
          negative_prompt: 'blurry, low quality, distorted, cartoon, anime, illustration, sketch, watermark, text, logo, dimension lines, annotations, crooked cabinet lines, floating cabinets, duplicate island, extra windows, extra doors, mismatched hardware, people, clutter',
          controlnets: [{
            initImageId, initImageType: 'UPLOADED',
            preprocessorId: 19,               // Edge to Image (Canny), SDXL
            weight: typeof controlnetWeight === 'number' ? controlnetWeight : 0.85,
          }],
        };
      } else {
        // Standard PhotoReal perspective render.
        body = {
          prompt, modelId: MODEL_KINO_XL,
          width: 1360, height: 768, num_images: 1, guidance_scale: 7,
          alchemy: true, photoReal: true, photoRealVersion: 'v2', presetStyle: 'CINEMATIC',
          negative_prompt: 'blurry, low quality, distorted, cartoon, anime, illustration, painting, sketch, watermark, text, logo, crooked cabinet lines, floating cabinets, duplicate island, extra windows, extra doors, mismatched hardware, people, clutter',
        };
      }

      const r = await fetch(`${BASE}/generations`, { method: 'POST', headers: H, body: JSON.stringify(body) });
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
