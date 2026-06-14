/**
 * Consumer price-range banding (FAKS / Showroom Atlas).
 * Locks the homeowner-facing range helper: a clean low–high band, magnitude-aware
 * rounding, and currency symbol. The consumer surface shows ONLY this — never the
 * to-the-dollar dealer total.
 */
import { suite } from '../_lib.mjs';
import { priceRange } from '../../eclipse-engine/src/index.js';

export default async function run() {
  const s = suite('consumer price-range');
  const a = priceRange(15461.84);
  s.eq('mid rounds to 500 step', a.mid, 15500);
  s.ok('low < mid < high', a.low < a.mid && a.mid < a.high);
  s.eq('USD display', a.display, '$13,000 – $18,000');
  s.ok('±15% default band', Math.abs(a.low - 13141) <= 500 && Math.abs(a.high - 17781) <= 500);

  const e = priceRange(22268, { currency: 'EUR' });
  s.eq('EUR symbol', e.currency, 'EUR');
  s.ok('EUR display uses €', e.display.startsWith('€'));

  const small = priceRange(1500);
  s.ok('small total uses 100 step', small.low % 100 === 0 && small.high % 100 === 0);
  s.eq('zero/garbage → 0 band', priceRange(0).high, 0);
  s.eq('NaN guard', priceRange(undefined).mid, 0);
  return s.done();
}
