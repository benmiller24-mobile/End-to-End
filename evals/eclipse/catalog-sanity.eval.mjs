/** Eclipse catalog integrity beyond the generic suite. */
import { suite } from '../_lib.mjs';
import { getTenant } from '../../eclipse-pricing/src/tenants/index.js';

export default async function run() {
  const s = suite('eclipse catalog sanity');
  const t = getTenant('eclipse');
  s.ok('≥ 7,500 SKUs (base + v8.8.1 patch)', t.catalog.count >= 7500, String(t.catalog.count));
  s.ok('official dims present', !!t.official);
  s.eq('official B30 width', t.official.find('B30')?.w, 30);
  s.eq('utility height patch U22 1/2-93"', t.catalog.find('U22 1/2-93"')?.p, 1455);
  s.eq('WSE-39" corner patch', t.catalog.find('WSE-39"')?.p, 2006);
  s.ok('styleCompat validation on', t.validation.styleCompat === true);
  return s.done();
}
