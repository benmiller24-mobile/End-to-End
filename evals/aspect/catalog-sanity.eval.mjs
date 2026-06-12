/**
 * Aspect (zero-code onboarded tenant) — spot prices verified by eye against
 * the v18.3.0 interactive catalog pages during ingest.
 */
import { suite } from '../_lib.mjs';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

export default async function run() {
  const s = suite('aspect catalog sanity');
  const t = getTenant('aspect');
  s.ok('≥ 1,000 SKUs ingested', t.catalog.count >= 1000, String(t.catalog.count));
  s.eq('W2436 (std wall, p126)', t.catalog.find('W2436')?.p, 519);
  s.eq('W2436-2D (two-door variant)', t.catalog.find('W2436-2D')?.p, 661);
  s.eq('WBC2430 (wall blind corner, p130)', t.catalog.find('WBC2430')?.p, 402);
  s.eq('W912 (smallest wall)', t.catalog.find('W912')?.p, 262);
  s.ok('frameless construction set', t.constructions.includes('eclipse_frameless'));
  s.ok('verify-before-order note present', !!t.branding.catalogNote);
  const unpriced = t.catalog.list().filter(r => !(r.p > 0)).length;
  s.eq('unpriced rows', unpriced, 0);
  return s.done();
}
