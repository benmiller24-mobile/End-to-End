/**
 * Counter-quote (competitive re-quote) — golden gate.
 * ===================================================
 * The Mautz drawing set (a real Cyncly/2020 export, the same kitchen the
 * Eclipse golden order locks to the penny) must flow the whole re-quote path:
 * vector import → cabinet labels → buildCounterQuote in ALL registered lines,
 * with honest per-line resolution grades and no silently dropped items.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { suite } from '../_lib.mjs';
import { parseDesignPdf } from '../../frontend/src/floorplanVector.js';
import { buildCounterQuote, counterQuoteDeltas } from '../../frontend/src/counterQuote.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(HERE, 'fixtures', f), 'utf8'));

export default async function run() {
  const s = suite('counter-quote (2020 re-quote in every line)');

  const mautz = parseDesignPdf(load('mautz-drawings-pages.json'), 'eclipse');
  const items = [...mautz.wallItems, ...mautz.islandItems];
  s.ok(`Mautz yields ≥ 20 line items (got ${items.length})`, items.length >= 20);

  const cq = buildCounterQuote({
    placements: items.map(it => ({ sku: it.sku, qty: 1 })),
    materials: { species: 'Maple', door: 'MET-V', construction: 'Standard', frameStyle: 'eclipse_frameless' },
    tenantIds: ['eclipse', 'shiloh', 'pronorm'],
  });
  const [ecl, shi, pn] = cq.columns;

  // Every line prices, every item is accounted for (rows === inputs, always).
  for (const col of cq.columns) {
    s.ok(`${col.tenantId}: subtotal > 0 (${col.currency}${col.subtotal.toLocaleString()})`, col.subtotal > 0);
    s.eq(`${col.tenantId}: no dropped rows`, col.rows.length, items.length);
    const counted = col.counts.exact + col.counts.normalized + col.counts.substituted + col.counts.missing;
    s.eq(`${col.tenantId}: every row graded`, counted, items.length);
  }

  // Mautz is a native Eclipse kitchen: it must fully resolve in Eclipse with no
  // filler substitutions and nothing missing (that is the order we price to
  // the penny elsewhere).
  s.eq('eclipse: nothing missing', ecl.counts.missing, 0);
  s.eq('eclipse: no filler substitutions', ecl.counts.substituted, 0);

  // Shiloh prices the same design (its declared Eclipse fallback may fire, but
  // nothing may vanish).
  s.eq('shiloh: nothing missing', shi.counts.missing, 0);

  // pronorm (metric, price-group): realizes by function+size; anything that
  // can't realize must surface as an explicit missing row, not disappear.
  s.ok('pronorm: currency is €', pn.currency === '€');
  s.ok(`pronorm: ≥ 80% of cabinets realize (missing ${pn.counts.missing}/${items.length})`,
    pn.counts.missing <= Math.floor(items.length * 0.2));
  for (const r of pn.rows.filter(r => r.resolution === 'missing')) {
    s.ok(`pronorm missing row keeps its source SKU (${r.srcSku})`, !!r.srcSku && r.total === 0);
  }

  // Deltas: never computed across currencies.
  const deltas = counterQuoteDeltas(cq.columns);
  s.ok('delta eclipse→shiloh is a number (same $)', typeof deltas[1] === 'number');
  s.ok('delta eclipse→pronorm suppressed (different currency)', deltas[2] === null);

  // Determinism: the same input re-quotes to the same totals.
  const cq2 = buildCounterQuote({
    placements: items.map(it => ({ sku: it.sku, qty: 1 })),
    materials: { species: 'Maple', door: 'MET-V', construction: 'Standard', frameStyle: 'eclipse_frameless' },
    tenantIds: ['eclipse', 'shiloh', 'pronorm'],
  });
  s.ok('deterministic totals', JSON.stringify(cq.columns.map(c => c.subtotal)) === JSON.stringify(cq2.columns.map(c => c.subtotal)));

  return s.done();
}
