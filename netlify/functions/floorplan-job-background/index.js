// Background runner (suffix -background → 15 minute budget). Invoked by
// /api/floorplan-job with a tiny {id} payload — background invocations have
// a small body cap, so the image is staged in the blob store by the submitter.
import { getStore } from '@netlify/blobs';
import { runExtraction } from '../../lib/floorplanCore.js';

export default async (req) => {
  const store = getStore({ name: 'floorplan', consistency: 'strong' });
  let id = null;
  try {
    ({ id } = await req.json());
    if (!id) return;
    const raw = await store.get(`${id}:input`);
    if (!raw) { await store.set(id, JSON.stringify({ error: 'job input not found' })); return; }
    const body = JSON.parse(raw);
    if (!process.env.ANTHROPIC_API_KEY) {
      await store.set(id, JSON.stringify({ error: 'ANTHROPIC_API_KEY is not configured on the server.' }));
      return;
    }
    const extraction = await runExtraction(body);
    await store.set(id, JSON.stringify({ extraction }));
  } catch (e) {
    if (id) { try { await store.set(id, JSON.stringify({ error: e?.message || String(e) })); } catch { /* blob write failed */ } }
  } finally {
    if (id) { try { await store.delete(`${id}:input`); } catch { /* best effort */ } }
  }
};
