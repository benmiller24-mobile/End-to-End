// Floorplan extraction as a BACKGROUND job (suffix -background → Netlify gives
// it 15 minutes instead of 26 seconds; dense architect sheets need 30-90s).
// POST /api/floorplan-job-background { id, image, mediaType, calibration?, hints? }
// → 202; the result is written to the "floorplan" blob store under the id and
// fetched by /api/floorplan-result.
import { getStore } from '@netlify/blobs';
import { runExtraction } from '../../lib/floorplanCore.js';

export default async (req) => {
  const store = getStore({ name: 'floorplan', consistency: 'strong' });
  let id = null;
  try {
    const body = await req.json();
    id = body.id;
    if (!id || !body.image || !body.mediaType) return;
    if (!process.env.ANTHROPIC_API_KEY) {
      await store.set(id, JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }));
      return;
    }
    await store.set(id, JSON.stringify({ status: 'running', startedAt: Date.now() }));
    const extraction = await runExtraction(body);
    await store.set(id, JSON.stringify({ extraction }));
  } catch (e) {
    if (id) { try { await store.set(id, JSON.stringify({ error: e?.message || String(e) })); } catch { /* blob write failed */ } }
  }
};
