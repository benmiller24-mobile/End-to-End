/**
 * pronorm catalog ↔ REAL ORDER reconciliation (ground truth).
 * ===========================================================
 * Verified against SEVEN real pronorm order confirmations supplied by the dealer
 * (Miller 356572 g6, Display 354778 g3, and five Blanchard OC orders g0/g1/g4).
 * Order line prices are EUR at a 50% dealer discount off the spec-book LIST.
 * Every STANDARD catalog cabinet across all seven orders reconciled to the cent:
 *   order_price === round(catalog.pg[group] × 0.5)
 * Key model: pronorm kitchens are MULTI-FRONT (two-tone) — each unit prices at
 * its OWN door front's price group, which can differ from the kitchen's main
 * front (so one order mixes e.g. g6 veneer units and g4/g1 secondary-front
 * units; the g:'4' lines below are a secondary front, NOT a "cap"). Excluded,
 * correctly: made-to-measure worktops/panels (WW/FM/TWK, area-priced) and
 * MODIFIED units (panel deletion / milling / custom dishwasher fronts), which
 * carry custom prices by definition.
 *
 * These tuples are the dealer-grade proof that the ingested pronorm prices are
 * correct. A drift in extraction will break them.
 */
import { suite } from '../_lib.mjs';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

// { sku, g: price group billed on the order, list: spec-book list €, order: line € (×0.5) }
const LINES = [
  // 356572 Miller — veneer front EV (group 6)
  { sku: 'PH20-208-01', g: '6', list: 347, order: 173.5 },
  { sku: 'H30-208-01', g: '6', list: 962, order: 481 },
  { sku: 'PHE30-208-01', g: '6', list: 1004, order: 502 },
  { sku: 'U45-76-45', g: '6', list: 1005, order: 502.5 },
  { sku: 'U90-76-38', g: '6', list: 1279, order: 639.5 },
  { sku: 'UG100-76-74', g: '6', list: 1178, order: 589 },
  { sku: 'U60-76-01', g: '6', list: 579, order: 289.5 },
  { sku: 'DT60-76-13', g: '6', list: 556, order: 278 },
  // capped at group 4 (open/internal/pull-out units in the same g6 kitchen)
  { sku: 'PU20-76', g: '4', list: 100, order: 50 },
  { sku: 'U75-76-01', g: '4', list: 716, order: 358 },
  { sku: 'DT60-76-14', g: '4', list: 390, order: 195 },
  { sku: 'US90-76-01', g: '4', list: 859, order: 429.5 },
  { sku: 'U50-76-90', g: '4', list: 748, order: 374 },
  { sku: 'U30-76-45', g: '4', list: 784, order: 392 },
  // 332119 Blanchard — Y-line secondary front (group 1)
  { sku: 'PHY20-144', g: '1', list: 144, order: 72 },
  { sku: 'UY120-41-30', g: '1', list: 790, order: 395 },
  { sku: 'UY120-76-01', g: '1', list: 856, order: 428 },
  { sku: 'UY90-38-30', g: '1', list: 585, order: 292.5 },
  { sku: 'UY90-76-01', g: '1', list: 725, order: 362.5 },
];

export default async function run() {
  const s = suite('pronorm real-order reconciliation');
  const t = getTenant('pronorm');
  const norm = (x) => String(x).toUpperCase().replace(/\s+/g, '');
  const byNorm = new Map(t.catalog.list().map(e => [norm(e.s), e]));

  for (const L of LINES) {
    const e = byNorm.get(norm(L.sku));
    s.ok(`${L.sku} in catalog`, !!e && !!e.pg);
    if (!e || !e.pg) continue;
    s.eq(`${L.sku} list @ g${L.g} = €${L.list}`, e.pg[L.g], L.list);
    // the dealer 50%-discount order price reproduces from the catalog list
    s.eq(`${L.sku} order €${L.order} = list×0.5`, Math.round(e.pg[L.g] * 0.5 * 100) / 100, L.order);
  }
  return s.done();
}
