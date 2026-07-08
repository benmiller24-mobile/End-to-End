/**
 * Customer share-link fidelity — what the dealer sees is what the customer gets.
 * ==============================================================================
 * The "🔗 Customer link" button encodes the CURRENT design as items
 * (seedFromSolverResult) and the embed rebuilds it VERBATIM through
 * buildManualResult — no re-solve, no divergence. This pins that contract:
 * every placed cabinet survives the round-trip at its position and width.
 */
import { suite } from '../_lib.mjs';
import { solve } from '../../eclipse-engine/src/index.js';
import { seedFromSolverResult, buildManualResult } from '../../frontend/src/manualDesign.js';

export default async function run() {
  const s = suite('share-link round-trip (dealer design → consumer embed)');

  const walls = [
    { id: 'A', length: 144, ceilingHeight: 96 },
    { id: 'B', length: 108, ceilingHeight: 96 },
    { id: 'C', length: 144, ceilingHeight: 96 },
  ];
  const solved = solve({
    layoutType: 'u-shape', roomType: 'kitchen', walls,
    appliances: [
      { type: 'refrigerator', width: 36, wall: 'A' }, { type: 'sink', width: 36, wall: 'B' },
      { type: 'range', width: 30, wall: 'C' }, { type: 'dishwasher', width: 24, wall: 'B' },
    ],
    prefs: {}, applyApplianceRec: true,
  });

  const items = seedFromSolverResult(solved);
  s.ok(`seed captures the design (${items.length} items)`, items.length >= 10);
  s.ok('appliances travel too', items.some(i => i.zone === 'appliance' || i.applianceType));

  // JSON round-trip (the URL carries base64 JSON — nothing may be lossy).
  const rebuiltItems = JSON.parse(JSON.stringify(items.map(({ id: _id, ...it }) => it)));
  const rebuilt = buildManualResult({ walls, items: rebuiltItems.map((it, i) => ({ id: `s${i}`, ...it })), island: null, roomType: 'kitchen', layoutType: 'u-shape' });

  const key = (p) => `${p.wall}|${p.sku}|${Math.round(p.position || 0)}|${Math.round(p.width || 0)}`;
  const cabs = (r) => (r.placements || []).filter(p => p.sku && ['base', 'wall', 'tall', 'upper'].includes(p.type)).map(key).sort();
  const a = cabs(solved), b = cabs(rebuilt);
  const missing = a.filter(x => !b.includes(x));
  s.ok(`every placed cabinet survives the round-trip (${a.length} → ${b.length}${missing.length ? '; missing: ' + missing.slice(0, 3).join(' ') : ''})`,
    missing.length === 0 && a.length > 0);

  // The rebuilt design renders: geometry present for the embed's views.
  s.ok('rebuilt result has walls for the views', (rebuilt.walls || []).length === walls.length);
  s.ok('rebuilt placements carry elevation data', (rebuilt.placements || []).some(p => p._elev));

  return s.done();
}
