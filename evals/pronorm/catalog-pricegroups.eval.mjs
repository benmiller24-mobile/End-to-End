/**
 * pronorm tenant — price-group pricing fixtures.
 * Prices verified against the rendered spec pages (adversarial workflow,
 * 25/25 sampled cells exact). Locks the generic price-group capability:
 * front range → group → the catalog row's price for that column.
 */
import { suite } from '../_lib.mjs';
import { getTenant, setTenantPriceGroup, priceGroupForRange } from '../../eclipse-pricing/src/tenants/index.js';

export default async function run() {
  const s = suite('pronorm price groups');
  const t = getTenant('pronorm');

  // capability + locale flags (honest metric gating)
  s.eq('units = mm', t.locale.units, 'mm');
  s.eq('currency = EUR', t.locale.currency, 'EUR');
  s.ok('autoSolve disabled (inch solver gated)', t.capabilities?.autoSolve === false);
  s.ok('priceGroups capability', t.capabilities?.priceGroups === true);
  s.ok('catalog > 9000 SKUs', t.catalog.count > 9000);

  // front-range → price-group map (read from the books' range register)
  s.eq('range TU → group 0', priceGroupForRange('pronorm', 'TU'), '0');
  s.eq('range MP → group 2', priceGroupForRange('pronorm', 'MP'), '2');
  s.eq('range EP → group 3', priceGroupForRange('pronorm', 'EP'), '3');
  s.eq('range OS → group 4', priceGroupForRange('pronorm', 'OS'), '4');
  s.eq('range EI → group 10', priceGroupForRange('pronorm', 'EI'), '10');

  // spec-verified prices: HSP 60-201-602 across price groups (proline p400)
  const expect = { '0': 935, '2': 1018, '3': 1098, '4': 1141, '8': 1643, '10': 2054 };
  for (const [g, p] of Object.entries(expect)) {
    setTenantPriceGroup('pronorm', g);
    const r = t.catalog.find('HSP 60-201-602');
    s.eq(`HSP 60-201-602 @ group ${g} = €${p}`, r && r.p, p);
  }

  // range-driven pricing: pick range MP (group 2) → price reflects column 2
  setTenantPriceGroup('pronorm', priceGroupForRange('pronorm', 'MP'));
  s.eq('via range MP → €1018', t.catalog.find('HSP 60-201-602').p, 1018);

  // a base unit (proline p205) and a Y-line base (yx p420) verified earlier
  setTenantPriceGroup('pronorm', '0');
  s.eq('O 30-38-30 @ group 0 = €390', t.catalog.find('O 30-38-30')?.p, 390);
  s.eq('USX 45-76-10 @ group 0 = €345', t.catalog.find('USX 45-76-10')?.p, 345);

  // Y-line group-5 gap is legitimate (dashed in book) — HY rows omit '5'
  const hy = t.catalog.find('HY 30-156-09');
  s.ok('HY 30-156-09 found', !!hy);
  s.ok('Y-line HY omits group 5 (legitimately dashed)', hy && hy.pg && hy.pg['5'] === undefined && hy.pg['4'] > 0 && hy.pg['6'] > 0);

  setTenantPriceGroup('pronorm', undefined);   // reset
  return s.done();
}
