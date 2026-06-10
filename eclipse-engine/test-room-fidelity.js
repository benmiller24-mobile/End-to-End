/**
 * Eclipse Engine — Room-Fidelity Tests (Phase 2)
 * Covers: appliance pinning (plumbing/gas rough-ins are real), opening
 * normalization (position ⇄ posFromLeft), per-wall soffits (effective
 * ceiling for uppers + tall-collision warnings), and the Eclipse-default
 * regression guards (no pins / no soffit → legacy behavior).
 */

import { solve } from './src/index.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

const baseInput = (overrides = {}) => ({
  layoutType: 'l-shape', roomType: 'kitchen',
  walls: [
    { id: 'A', length: 220, role: 'range' },
    { id: 'B', length: 120, role: 'sink', openings: [{ type: 'window', position: 42, width: 36, sillHeight: 42, headHeight: 80 }] },
  ],
  appliances: [
    { type: 'range', width: 30, wall: 'A' },
    { type: 'sink', width: 36, wall: 'A' },
    { type: 'dishwasher', width: 24, wall: 'A' },
    { type: 'refrigerator', width: 36, wall: 'A' },
  ],
  prefs: { sophistication: 'standard', ceilingHeight: 96, cornerTreatment: 'auto', preferDrawerBases: true },
  ...overrides,
});

const sinkBaseWall = (r) => (r.walls || [])
  .flatMap(w => (w.cabinets || []).map(c => ({ ...c, _w: w.wallId })))
  .find(c => /^SB|^DSB|^SBA/.test(c.sku || ''))?._w;

console.log('\n═══ Appliance pinning ═══');
{
  const r = solve(baseInput()); // sink shares range wall, NOT pinned
  assert(sinkBaseWall(r) === 'B', `unpinned sink relocates to the window wall (got ${sinkBaseWall(r)})`);

  const inp = baseInput();
  inp.appliances = inp.appliances.map(a =>
    (a.type === 'sink' || a.type === 'dishwasher') ? { ...a, pinned: true } : a);
  const rp = solve(inp);
  assert(sinkBaseWall(rp) === 'A', `pinned sink STAYS on its wall despite sharing the range wall (got ${sinkBaseWall(rp)})`);
  const dw = (rp.walls || []).flatMap(w => (w.cabinets || []).map(c => ({ ...c, _w: w.wallId })))
    .find(c => (c.applianceType || '') === 'dishwasher');
  assert(dw?._w === 'A', `pinned dishwasher stays with the pinned sink (got ${dw?._w})`);
}

console.log('\n═══ Opening normalization (position ⇄ posFromLeft) ═══');
{
  const r = solve(baseInput());
  const op = r._inputWalls?.find(w => w.id === 'B')?.openings?.[0];
  assert(op && op.posFromLeft === 42 && op.position === 42,
    `opening written as {position} gains posFromLeft alias (got ${JSON.stringify({ p: op?.position, pfl: op?.posFromLeft })})`);
  // Uppers must skip the window zone (42–78") on wall B — end panels allowed.
  const upB = (r.uppers || []).find(u => u.wallId === 'B');
  const overWin = (upB?.cabinets || []).filter(c =>
    c.position < 78 && c.position + c.width > 42 && /^W\d/.test(c.sku || ''));
  assert(overWin.length === 0, `no wall cabinets over the window (got ${overWin.map(c => c.sku).join(',') || 'none'})`);
}

console.log('\n═══ Soffit: effective ceiling for uppers + collision warnings ═══');
{
  const inp = baseInput();
  inp.walls[0].soffit = { drop: 12, depth: 13 };
  inp.appliances = inp.appliances.map(a => ({ ...a, pinned: a.type === 'sink' || a.type === 'dishwasher' }));
  const r = solve(inp);

  const wallA = r._inputWalls?.find(w => w.id === 'A');
  assert(wallA?.ceilingHeight === 84 && wallA?._realCeilingHeight === 96,
    `solver wall A: effective ceiling 84, real 96 (got ${wallA?.ceilingHeight}/${wallA?._realCeilingHeight})`);

  const upA = (r.uppers || []).find(u => u.wallId === 'A');
  const over = (upA?.cabinets || []).filter(c =>
    ((c._elev?.yMount ?? 54) + (c._elev?.height ?? c.height ?? 36)) > 84.01);
  assert(over.length === 0, `no uppers poke through the soffit (got ${over.map(c => c.sku).join(',') || 'none'})`);

  const warns = (r.validation || []).filter(v => v.rule === 'soffit_tall_collision');
  assert(warns.length > 0, `tall/panel-vs-soffit collisions are surfaced as validation errors (got ${warns.length})`);
}

console.log('\n═══ Eclipse default regression: no soffit → legacy RW above fridge ═══');
{
  const r = solve(baseInput());
  const allCabs = [
    ...(r.uppers || []).flatMap(u => u.cabinets || []),
    ...(r.talls || []),
    ...(r.walls || []).flatMap(w => w.cabinets || []),
  ];
  const rw = allCabs.find(c => (c.sku || '').startsWith('RW'));
  assert(!!rw, `RW over-fridge cabinet still generated on normal (non-soffit) walls (got ${rw?.sku || 'none'})`);
  const warns = (r.validation || []).filter(v => v.rule === 'soffit_tall_collision');
  assert(warns.length === 0, 'no soffit warnings without a soffit');
}

console.log(`\n${'═'.repeat(50)}\nRoom-fidelity tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
