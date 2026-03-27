import { solve, assignCoordinates, autoWallConfig, exportForVisualization } from '../../eclipse-engine/src/index.js';

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST required' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
  try {
    const body = await req.json();
    const { walls, appliances, prefs, layoutType, roomType, island, peninsula } = body;

    const layout = solve({ walls, appliances, prefs, layoutType, roomType, island, peninsula });

    let coordinates = null;
    if (body.includeCoordinates !== false) {
      const wallConfig = body.wallConfig || autoWallConfig(layout);
      const coordinated = assignCoordinates(layout, wallConfig);
      coordinates = exportForVisualization(coordinated);
    }

    return new Response(JSON.stringify({ layout, coordinates }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
};

export const config = { path: '/api/solve' };
