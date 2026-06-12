/** Shiloh catalog integrity beyond the generic suite. */
import { suite } from '../_lib.mjs';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

export default async function run() {
  const s = suite('shiloh catalog sanity');
  const t = getTenant('shiloh');
  s.ok('≥ 5,000 SKUs', t.catalog.count >= 5000, String(t.catalog.count));
  s.eq('fallback tenant is eclipse', t.pricing.fallbackTenant, 'eclipse');
  s.ok('interim catalog note present', !!t.branding.catalogNote);
  s.ok('9 framed constructions', t.constructions.length === 9, String(t.constructions.length));
  s.ok('styleCompat off (Eclipse-only matrix)', t.validation.styleCompat === false);
  return s.done();
}
