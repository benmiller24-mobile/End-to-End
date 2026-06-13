/**
 * pronorm realize-in-tenant — the metric auto-solver.
 * ===================================================
 * The W.W. inch solver lays out a kitchen; realizeInTenant() swaps every cabinet
 * SKU to pronorm's nearest equivalent (U base / US sink / O wall / H tall) at the
 * active price group, keeping the geometry. This locks that mapping: bases become
 * U…-76 bodies (not 12cm drawer oddities), sinks become US, uppers O, and every
 * realized cabinet carries a real catalog price. Generic — keys on the tenant's
 * `realize` config, no brand conditionals in the engine.
 */
import { suite } from '../_lib.mjs';
import { solve } from '../../eclipse-engine/src/index.js';
import { realizeInTenant } from '../../eclipse-engine/src/tenantRealize.js';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

const norm = (s) => String(s).toUpperCase().replace(/\s+/g, '');

export default async function run() {
  const s = suite('pronorm realize-in-tenant');
  const t = getTenant('pronorm');

  const result = solve({
    walls: [{ id: 'A', length: 144, ceilingHeight: 96 }, { id: 'B', length: 120, ceilingHeight: 96 }],
    layoutType: 'L',
    appliances: [
      { type: 'sink', wall: 'A', position: 60 }, { type: 'range', wall: 'B', position: 40 },
      { type: 'refrigerator', wall: 'A', position: 0 }, { type: 'dishwasher', wall: 'A', position: 84 },
    ],
    prefs: {},
  });
  realizeInTenant(result, t, '6');

  s.ok('realize report present', !!result._realizeReport);
  s.ok('realized tenant = pronorm', result._realizedTenant === 'pronorm');
  s.ok('cabinets were swapped', result._realizeReport.swapped > 0);
  s.eq('every swapped cabinet got a price', result._realizeReport.priced, result._realizeReport.swapped);

  // Collect realized base + wall cabinets (those that carry a _wwSku = were remapped)
  const bases = [];
  for (const w of (result.walls || [])) for (const c of (w.cabinets || [])) if (c._wwSku) bases.push(c);
  const walls = [];
  for (const u of (result.uppers || [])) for (const c of (u.cabinets || [])) if (c._wwSku) walls.push(c);

  s.ok('has realized base cabinets', bases.length > 0);
  s.ok('has realized wall cabinets', walls.length > 0);

  // Every realized base is a U-family body (U… or US… for sinks) at standard 76 height
  const baseOk = bases.every(c => /^U/.test(norm(c.sku)));
  s.ok('all bases are U-family', baseOk);
  const base76 = bases.every(c => /^US?\d+-76/.test(norm(c.sku)));
  s.ok('all bases at standard 76 carcase (no drawer oddities)', base76);

  // A sink base mapped to a US sink unit
  const sink = bases.find(c => /^SB/.test(norm(c._wwSku)) || /sink/i.test(c.role || ''));
  s.ok('sink base present', !!sink);
  if (sink) s.ok('sink base → US sink unit', /^US/.test(norm(sink.sku)));

  // Every realized upper is an O-family wall unit, validly priced from the catalog
  const wallOk = walls.every(c => /^O/.test(norm(c.sku)));
  s.ok('all uppers are O-family', wallOk);

  // Realized SKUs resolve in the catalog at group 6
  const byNorm = new Map(t.catalog.list().map(e => [norm(e.s), e]));
  const allResolve = [...bases, ...walls].every(c => { const e = byNorm.get(norm(c.sku)); return e && e.pg && e.pg['6'] != null; });
  s.ok('all realized SKUs resolve in catalog @ group 6', allResolve);

  // The placements array (pricing source) was realized too
  const realizedPlace = (result.placements || []).filter(p => p._wwSku);
  s.ok('placements realized for pricing', realizedPlace.length > 0);
  s.ok('placement SKUs are pronorm', realizedPlace.every(p => /^[A-Z]+\s*\d+-\d+/.test(p.sku) && byNorm.has(norm(p.sku))));

  return s.done();
}
