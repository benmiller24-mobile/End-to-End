// POST /api/floorplan-job { id, image, mediaType, calibration?, hints? }
// Synchronous SUBMIT: stages the request in the blob store (sync functions
// accept multi-MB bodies; background invocations do not), then kicks the
// background runner with just the id. Client polls /api/floorplan-result.
import { getStore } from '@netlify/blobs';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  try {
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    const body = await req.json();
    if (!body.id || !body.image || !body.mediaType) return json({ error: 'id, image, mediaType required' }, 400);
    const store = getStore({ name: 'floorplan', consistency: 'strong' });
    await store.set(`${body.id}:input`, JSON.stringify(body));
    await store.set(body.id, JSON.stringify({ status: 'running', startedAt: Date.now() }));
    const base = new URL(req.url).origin;
    const kick = await fetch(`${base}/api/floorplan-job-background`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: body.id }),
    });
    if (kick.status !== 202 && !kick.ok) return json({ error: `background runner unavailable (${kick.status})` }, 502);
    return json({ status: 'accepted', id: body.id }, 202);
  } catch (e) {
    return json({ error: e?.message || String(e) }, 500);
  }
};
