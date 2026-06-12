/**
 * GOLDEN ORDER — 020526 MAUTZ KITCHEN (real W.W. Wood Eclipse acknowledgment,
 * grand total $19,746.06). Every order-style code must resolve to its
 * acknowledged list price through the live resolver, forever.
 */
import { suite } from '../_lib.mjs';
import { setPricingBrand, findSkuNormalized } from '../../frontend/src/skuResolver.js';

const LINES = [
  ['W28.539', 677], ['W3624', 533], ['W1239R', 453], ['WSE2430-39R', 2006],
  ['W4239', 830], ['RW3624', 661], ['BWDMW18', 1132], ['BDEP-F LT', 337],
  ['SB36', 761], ['BBC45R', 708], ['BEP3/4L-FTK', 131], ['BL36-PHR', 1417],
  ['B24-2D', 649], ['B3D15', 530], ['FREP3/4 93FTK24L', 498],
  ['U22 1/293R', 1455], ['UDEP-F 93-24 LT', 718], ['F634 1/2', 104],
  ['F393', 136], ['F339', 77], ['F396', 136], ['TUK-STAIN', 31.63],
  ['3 1/2CRN', 17.39], ['3/4TK', 11.07], ['7/8TD', 11.07],
];

export default async function run() {
  const s = suite('mautz golden order');
  setPricingBrand('eclipse');
  for (const [sku, want] of LINES) {
    const e = findSkuNormalized(sku);
    s.eq(`${sku} = $${want}`, e?.p, want);
  }
  return s.done();
}
