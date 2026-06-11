// Wall-bounds regression fuzz — every cabinet, appliance, filler, and upper
// the solver emits must live inside its wall. Born from a live-site bug where
// the enforceFillerRule repack scrambled a run and pushed the fridge 23" past
// the wall end (and end panels nudged runs 3/4" over). Sweeps layouts x wall
// lengths x appliance assignments, plus angled (45-degree) variants.
import { solve } from './src/solver.js';
let fails = 0;

// Every cabinet/appliance on every wall must live inside [0, wallLength].
function checkBounds(result, label) {
  const bad = [];
  for (const wl of (result.walls || [])) {
    const len = wl.wallLength || wl.length;
    for (const c of (wl.cabinets || [])) {
      if (typeof c.position !== 'number' || !(c.width > 0)) continue;
      if (c.position < -0.51 || c.position + c.width > len + 0.51) {
        bad.push(`${wl.wallId}: ${c.sku || c.applianceType}@${c.position}+${c.width} (wall ${len})`);
      }
    }
  }
  for (const ul of (result.uppers || [])) {
    const wl = (result.walls || []).find(w => w.wallId === ul.wallId);
    const len = wl ? (wl.wallLength || wl.length) : 999;
    for (const c of (ul.cabinets || [])) {
      if (typeof c.position !== 'number' || !(c.width > 0)) continue;
      if (c.position < -0.51 || c.position + c.width > len + 0.51) {
        bad.push(`upper ${ul.wallId}: ${c.sku}@${c.position}+${c.width} (wall ${len})`);
      }
    }
  }
  if (bad.length) { fails++; console.log('FAIL', label, '→', bad.join(' ; ')); }
  else console.log('ok  ', label);
}

// 1. Ben's screenshot config: L-shape, A=156 (range+fridge pinned), B=120 sink wall, island
checkBounds(solve({
  layoutType: 'l-shape', roomType: 'kitchen',
  walls: [
    { id: 'A', length: 156, ceilingHeight: 96, role: 'range' },
    { id: 'B', length: 120, ceilingHeight: 96, role: 'sink' },
  ],
  appliances: [
    { type: 'range', width: 30, wall: 'A', pinned: true },
    { type: 'sink', width: 36, wall: 'B', pinned: true },
    { type: 'dishwasher', width: 24, wall: 'B', pinned: true },
    { type: 'refrigerator', width: 36, wall: 'A', pinned: true },
  ],
  island: { length: 73, depth: 38 },
  prefs: {},
}), "Ben's config (L 156/120, pinned appliances, island)");

// 2. Sweep: layouts × wall lengths × appliance assignments (the fuzz that
//    would have caught the array-order repack bug)
const layouts = [
  ['l-shape', [144, 120]], ['l-shape', [120, 96]], ['l-shape', [168, 132]],
  ['u-shape', [144, 96, 120]], ['u-shape', [120, 120, 120]], ['u-shape', [156, 84, 144]],
  ['g-shape', [144, 96, 120, 84]],
  ['single-wall', [168]], ['galley', [144, 144]],
];
const appSets = [
  (ws) => [{ type: 'sink' }, { type: 'range', width: 30 }, { type: 'refrigerator', width: 36 }],
  (ws) => [{ type: 'sink', wall: ws[0], pinned: true }, { type: 'range', width: 36 }, { type: 'refrigerator', width: 36 }, { type: 'dishwasher', width: 24 }],
  (ws) => [{ type: 'sink', wall: ws[ws.length - 1], pinned: true }, { type: 'cooktop', width: 36 }, { type: 'refrigerator', width: 36, wall: ws[0], pinned: true }, { type: 'wallOven', width: 30 }],
];
let n = 0;
for (const [lt, lens] of layouts) {
  for (let s = 0; s < appSets.length; s++) {
    if (/galley|single/.test(lt) && s === 2) continue;
    const walls = lens.map((L, i) => ({ id: String.fromCharCode(65 + i), length: L, ceilingHeight: 96 }));
    const ids = walls.map(w => w.id);
    try {
      checkBounds(solve({ layoutType: lt, roomType: 'kitchen', walls, appliances: appSets[s](ids), prefs: {} }), `${lt} ${lens.join('/')} apps#${s}`);
      n++;
    } catch (e) { console.log('SOLVE ERROR', lt, lens.join('/'), s, e.message); fails++; }
  }
}
// 3. Angled variants of the same sweep
for (const [lt, lens] of layouts.filter(([t]) => /l-shape|u-shape/.test(t))) {
  const walls = lens.map((L, i) => ({ id: String.fromCharCode(65 + i), length: L, ceilingHeight: 96, ...(i > 0 ? { turn: 45 } : {}) }));
  const ids = walls.map(w => w.id);
  try {
    checkBounds(solve({ layoutType: lt, roomType: 'kitchen', walls, appliances: appSets[1](ids), prefs: {} }), `ANGLED ${lt} ${lens.join('/')}`);
    n++;
  } catch (e) { console.log('SOLVE ERROR angled', lt, e.message); fails++; }
}
console.log('═'.repeat(50));
console.log(fails ? `Bounds tests: ${fails} FAILURES across ${n + 1} configs` : `Bounds tests: ${n + 1} passed, 0 failed`);
process.exit(fails ? 1 : 0);
