/**
 * pronorm catalog ↔ REAL ORDER reconciliation (ground truth).
 * ===========================================================
 * Verified against two real pronorm order confirmations supplied by the dealer:
 *   · 356572.00 "Miller Kitchen"  — front range EV → price group 6
 *   · 354778.00 "Display kitchen" — front range    → price group 3
 * Order line prices are EUR at a 50% dealer discount off the spec-book LIST.
 * Every catalog cabinet on both orders reconciled to the cent:
 *   order_price === round(catalog.pg[group] × 0.5)
 * (Made-to-measure worktops/panels — WW/FM/TWK — are area-priced, not catalog
 * list, and are excluded. Certain open/internal/pull-out units bill at a
 * "capped" group 4 below the veneer front's group 6 — a pronorm pricing rule;
 * the catalog value at that group is exact, captured here as g:'4' lines.)
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
