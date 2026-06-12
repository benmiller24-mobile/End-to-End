/**
 * GOLDEN PRICES — 27 Shiloh lines verified line-by-line against the
 * Soderstrom project quote sheets (SHI342, June 2026). These must resolve
 * NATIVELY (no Eclipse fallback) at the verified list price.
 */
import { suite } from '../_lib.mjs';
import { setPricingBrand, findSkuNormalized } from '../../frontend/src/skuResolver.js';

const VERIFIED = [
  ['W1836L', 449], ['W1836R', 449], ['RW3015-30D', 715], ['UT1893-RT-27R', 2258],
  ['U1893R', 1260], ['U2493L', 1518], ['FIOM3393-27', 2725], ['B15R-RT', 912],
  ['B18L-RT', 923], ['B21R-RT', 958], ['B24R-RT', 977], ['VTB12L', 447],
  ['VTSB24L', 506], ['VTSB24R', 506], ['INFBDEPL', 656], ['INFBDEPR', 656],
  ['INFVTDEPL', 656], ['INFVTDEPR', 656], ['INFUTDEP93-27R', 1787],
  ['BEP3-FTK-R', 158], ['REP3/49627-FTK-L', 434], ['REP11/29330-FTK-L', 514],
  ['REP11/29330-FTK-R', 514], ['BCF-INSET', 732],
];

export default async function run() {
  const s = suite('soderstrom verified prices');
  setPricingBrand('shiloh');
  for (const [sku, want] of VERIFIED) {
    const e = findSkuNormalized(sku);
    s.eq(`${sku} = $${want}`, e?.p, want);
    s.ok(`${sku} native (no fallback)`, e && !e._fallback);
  }
  setPricingBrand('eclipse');
  return s.done();
}
