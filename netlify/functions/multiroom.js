import { solveMultiRoom, getMultiRoomSummary, solve, configureMultiRoom } from '../../eclipse-engine/src/index.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const { rooms, materials } = await req.json();

    if (materials) {
      const result = configureMultiRoom({ rooms, materials });
      return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    }

    const results = solveMultiRoom(rooms, solve);
    const summary = getMultiRoomSummary(results);
    return new Response(JSON.stringify({ results, summary }), { headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/multiroom' };
