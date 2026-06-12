/**
 * MAUTZ order regression — every SKU from the real 020526 MAUTZ KITCHEN
 * W.W. Wood acknowledgment (Eclipse ECL8_8A_1, grand total $19,746.06) must
 * resolve to its acknowledged list price, forever. Order-style codes resolve
 * through the same path the app quotes with (catalog + patch only; the
 * frontend resolver adds the order-code normalization on top).
 */
import { findSku } from './src/skuCatalog.js';

let pass = 0, fail = 0;
const t = (sku, want) => {
  const e = findSku(sku);
  const ok = e && Math.abs(e.p - want) < 0.005;
  if (ok) { pass++; console.log(`ok   ${sku} = $${want}`); }
  else { fail++; console.log(`FAIL ${sku} → ${e ? '$' + e.p : 'missing'} (want $${want})`); }
};

// direct catalog entries (base + patch) at acknowledged prices
t('W3039', 677); t('W3624', 533); t('W4239', 830); t('RW3624', 661);
t('BWDMW18', 1132); t('BDEP-F', 337); t('SB36', 761); t('BBC45', 708);
t('BEP3/4-FTK-L/R', 131); t('BL36-PH', 1417); t('B24-2D', 649); t('B3D15', 530);
t('FREP3/4-FTK-24-L/R-93"', 498); t('F634 1/2', 104); t('F393', 136);
t('F339', 77); t('F396', 136); t('3 1/2CRN', 17.39); t('3/4TK', 11.07); t('7/8TD', 11.07);

// catalog-patch entries (utility heights / WSE heights / flush deco doors)
t('U22 1/2-93"', 1455); t('U24-93"', 1518); t('U12-114"', 1443); t('U36-108"', 2763);
t('WSE-39"', 2006); t('WSE-30"', 1517); t('WSE-48"', 2498);
t('UDEP-24-F-93"', 718); t('UTDEP-24-F-114"', 990); t('UDEP-30-F-84"', 868);
t('WDEP-39"', 327); t('WDEP-F-39"', 367); t('WDEP-F-78"', 809);

console.log('\n══════════════════════════════════════════════════');
console.log(`Mautz order regression: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
