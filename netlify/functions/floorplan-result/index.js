// GET /api/floorplan-result?id=<uuid> → {status:"pending"} | {extraction} | {error}
import { getStore } from '@netlify/blobs';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  const store = getStore({ name: 'floorplan', consistency: 'strong' });
  const raw = await store.get(id);
  if (!raw) return json({ status: 'pending' });
  const out = JSON.parse(raw);
  if (out.status === 'running') return json({ status: 'pending', startedAt: out.startedAt });
  // one-shot read: clear the blob once delivered
  try { await store.delete(id); } catch { /* best effort */ }
  return json(out);
};
