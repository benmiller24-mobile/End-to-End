/**
 * Upper top-line alignment — every solved wall must read as ONE wall-cabinet
 * top line (NKBA shop-drawing rule): standard uppers, stacked tops, end
 * panels and the over-fridge RW all terminate on the same yTop; the RW's
 * bottom sits at a real fridge-opening height (≥66"). Verified pattern:
 * Mautz acknowledgment (RW3624 @ 69"–93" flush with 39" uppers).
 */
import { solve } from './src/index.js';

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
};

const CONFIGS = [
  ['L-shape + fridge, 96" ceiling', {
    layoutType: 'l-shape', roomType: 'kitchen',
    walls: [{ id: 'A', length: 156, role: 'sink', openings: [] }, { id: 'B', length: 120, role: 'range', openings: [] }],
    appliances: [
      { type: 'range', width: 30, wall: 'B' }, { type: 'sink', width: 36, wall: 'A' },
      { type: 'dishwasher', width: 24, wall: 'A' }, { type: 'refrigerator', width: 36, wall: 'A' },
    ],
    prefs: { sophistication: 'standard', ceilingHeight: 96 },
  }],
  ['U-shape, 102" ceiling, high sophistication', {
    layoutType: 'u-shape', roomType: 'kitchen',
    walls: [
      { id: 'A', length: 144, role: 'sink', openings: [] },
      { id: 'B', length: 168, role: 'range', openings: [] },
      { id: 'C', length: 120, role: 'general', openings: [] },
    ],
    appliances: [
      { type: 'range', width: 36, wall: 'B' }, { type: 'sink', width: 36, wall: 'A' },
      { type: 'dishwasher', width: 24, wall: 'A' }, { type: 'refrigerator', width: 36, wall: 'C' },
    ],
    prefs: { sophistication: 'high', ceilingHeight: 102 },
  }],
  ['Galley, 96" ceiling, very high (stacks possible)', {
    layoutType: 'galley', roomType: 'kitchen',
    walls: [{ id: 'A', length: 160, role: 'range', openings: [] }, { id: 'B', length: 160, role: 'sink', openings: [] }],
    appliances: [
      { type: 'range', width: 30, wall: 'A' }, { type: 'refrigerator', width: 36, wall: 'A' },
      { type: 'sink', width: 33, wall: 'B' }, { type: 'dishwasher', width: 24, wall: 'B' },
    ],
    prefs: { sophistication: 'very_high', ceilingHeight: 96 },
  }],
];

const isHood = (c) => c.role === 'rangeHood' || c.role === 'hood' || c.applianceType === 'hood';

for (const [name, input] of CONFIGS) {
  console.log(`\n═══ ${name} ═══`);
  const r = solve(input);
  for (const ul of (r.uppers || [])) {
    const lined = (ul.cabinets || []).filter(c => c._elev && !isHood(c)
      && (c._elev.zone === 'UPPER' || c._elev.zone === 'ABOVE_TALL'));
    if (lined.length < 2) continue;
    const tops = [...new Set(lined.map(c => +(c._elev.yMount + c._elev.height).toFixed(1)))];
    assert(tops.length === 1,
      `wall ${ul.wallId}: one top line (got ${tops.join(', ')} across ${lined.map(c => c.sku).join('/')})`);
  }
  // over-fridge RWs (either array) end ON the wall line with a real opening below
  const rwAll = [
    ...(r.talls || []).filter(t => t._elev?.zone === 'ABOVE_TALL').map(t => ({ c: t, wall: t.wall })),
    ...(r.uppers || []).flatMap(u => (u.cabinets || []).filter(c => c._elev?.zone === 'ABOVE_TALL').map(c => ({ c, wall: u.wallId }))),
  ];
  for (const { c, wall } of rwAll) {
    const ul = (r.uppers || []).find(u => u.wallId === wall);
    const wallTops = (ul?.cabinets || []).filter(x => x._elev?.zone === 'UPPER' && !isHood(x))
      .map(x => x._elev.yMount + x._elev.height);
    if (!wallTops.length) continue;
    const line = Math.max(...wallTops);
    assert(Math.abs((c._elev.yMount + c._elev.height) - line) < 0.11,
      `wall ${wall}: ${c.sku} top ${c._elev.yMount + c._elev.height} meets the ${line}" line`);
    assert(c._elev.yMount >= 66, `wall ${wall}: ${c.sku} bottom ${c._elev.yMount}" ≥ 66" fridge clearance`);
  }
}

console.log(`\n${'═'.repeat(50)}\nTop-line tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
