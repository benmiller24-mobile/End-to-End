import { configureProject, generateProjectSummary, generateCostBreakdownText } from '../../eclipse-engine/src/index.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await req.json();
    const { walls, appliances, prefs, layoutType, roomType, island, peninsula, materials } = body;

    const result = configureProject({
      room: { walls, appliances, prefs, layoutType, roomType, island, peninsula },
      materials: materials || {},
    });

    const summary = generateProjectSummary(result);

    return new Response(JSON.stringify({ ...result, summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/quote' };
