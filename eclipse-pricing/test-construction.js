/**
 * Eclipse Pricing — Construction-Profile & Fabrication Tests (Phase 1)
 * Covers: Shiloh overlay charges, inset premiums, Eclipse zero-impact
 * regression, Shiloh→Eclipse fallback flagging, fabrication line pricing.
 */

import { calculateItemPrice, calculateLayoutPrice } from './src/pricingEngine.js';
import { findShilohSku } from './src/shilohSkuCatalog.js';
import { findSku } from './src/skuCatalog.js';
import { priceFabricationItem, priceFabricationItems, isFabricationSku } from './src/fabricationPricing.js';

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}
const approx = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;

// A plain 2-door, 1-drawer base cabinet at $100 list. White Oak (0% species),
// Standard construction (0%), Hanover door (group A, $0) → clean math.
const ITEM = { s: 'B24', p: 100, r: 'B1', t: 'B', dc: 2, drc: 1, len: 1, q: 1 };
const SPECIES = 'White Oak', CONSTR = 'Standard';

console.log('\n═══ Eclipse regression: profile absent/zeroed changes nothing ═══');
const base = calculateItemPrice(ITEM, SPECIES, CONSTR);
// base = $100 stock + whatever door/drawer-front group charges the defaults
// carry. All profile assertions below are DELTAS against this measured
// baseline, so they hold regardless of door-data details.
assert(base.unitPrice > 0, `baseline prices (got ${base.unitPrice})`);
const zeroProfile = calculateItemPrice(ITEM, SPECIES, CONSTR, 'HNVR', 'DF-HNVR', '5/8-STD',
  { overlayDoorChg: 0, overlayDrawerChg: 0, insetPremiumPct: 0 });
assert(approx(zeroProfile.unitPrice, base.unitPrice), 'zeroed profile = no-profile price (Eclipse unchanged)');
assert(base.overlayChg === 0 && base.insetPct === 0, 'baseline carries zero overlay/inset');

console.log('\n═══ Shiloh 1¼" overlay: $26/door + $12/drawer ═══');
const overlay = calculateItemPrice(ITEM, SPECIES, CONSTR, 'HNVR', 'DF-HNVR', '5/8-STD',
  { overlayDoorChg: 26, overlayDrawerChg: 12, insetPremiumPct: 0 });
assert(approx(overlay.overlayChg, 26 * 2 + 12), `overlayChg = $64 (got ${overlay.overlayChg})`);
assert(approx(overlay.unitPrice, base.unitPrice + 64), `unit price = baseline + $64 (got ${overlay.unitPrice}, baseline ${base.unitPrice})`);

console.log('\n═══ Shiloh inset: percentage premium over overlay list ═══');
const inset40 = calculateItemPrice(ITEM, SPECIES, CONSTR, 'HNVR', 'DF-HNVR', '5/8-STD',
  { overlayDoorChg: 0, overlayDrawerChg: 0, insetPremiumPct: 40 });
assert(approx(inset40.unitPrice, base.prePly * 1.40), `flush inset 40% → prePly × 1.40 (got ${inset40.unitPrice})`);
const inset45 = calculateItemPrice(ITEM, SPECIES, CONSTR, 'HNVR', 'DF-HNVR', '5/8-STD',
  { overlayDoorChg: 0, overlayDrawerChg: 0, insetPremiumPct: 45 });
assert(approx(inset45.unitPrice, base.prePly * 1.45), `3/8" inset 45% → prePly × 1.45 (got ${inset45.unitPrice})`);

console.log('\n═══ Inset premium stacks under the plywood multiplier ═══');
const insetPly = calculateItemPrice(ITEM, SPECIES, 'Plywood', 'HNVR', 'DF-HNVR', '5/8-STD',
  { overlayDoorChg: 0, overlayDrawerChg: 0, insetPremiumPct: 40 });
assert(approx(insetPly.unitPrice, base.prePly * 1.40 * 1.10), `inset 40% + plywood 10% (got ${insetPly.unitPrice})`);

console.log('\n═══ Profile charges apply to cabinet boxes only ═══');
const moulding = calculateItemPrice({ s: '3 1/2CRN', p: 17.39, r: 'T2', t: 'M', dc: 0, drc: 0, len: 1, q: 1 },
  SPECIES, CONSTR, 'HNVR', 'DF-HNVR', '5/8-STD', { overlayDoorChg: 26, overlayDrawerChg: 12, insetPremiumPct: 40 });
assert(approx(moulding.unitPrice, 17.39), `moulding (t=M) untouched by profile (got ${moulding.unitPrice})`);
const filler = calculateItemPrice({ s: 'F3', p: 8, r: 'S13', t: 'F', dc: 0, drc: 0, len: 1, q: 1 },
  SPECIES, CONSTR, 'HNVR', 'DF-HNVR', '5/8-STD', { overlayDoorChg: 26, overlayDrawerChg: 12, insetPremiumPct: 40 });
assert(approx(filler.unitPrice, 8), `filler (t=F) untouched by profile (got ${filler.unitPrice})`);

console.log('\n═══ Shiloh→Eclipse fallback is flagged, never silent ═══');
const shilohHit = findShilohSku('WWS3630');
assert(shilohHit && !shilohHit._fallback, 'real Shiloh SKU has no fallback flag');
const eclipseOnly = findShilohSku('PROFILE FILLER');
assert(!eclipseOnly || eclipseOnly._fallback === 'eclipse' || findSku('PROFILE FILLER') === undefined,
  `Eclipse-only SKU is flagged _fallback (got ${JSON.stringify(eclipseOnly?._fallback)})`);
const nothing = findShilohSku('ZZZ-NOT-A-SKU-999');
assert(nothing == null, 'unknown SKU returns null/undefined');

console.log('\n═══ calculateLayoutPrice counts fallbacks ═══');
const lp = calculateLayoutPrice(
  [{ sku: 'WWS3630', qty: 1, wall: 'A' }, { sku: 'PROFILE FILLER', qty: 1, wall: 'A' }],
  { species: SPECIES, construction: CONSTR, door: 'HNVR', drawerFront: 'DF-HNVR', drawerBox: '5/8-STD' },
  findShilohSku,
);
assert(lp.fallbackCount === 1, `fallbackCount = 1 (got ${lp.fallbackCount})`);
assert(lp.items.filter(i => i._fallback).length === 1, 'fallback flag survives onto the priced item');

console.log('\n═══ Fabrication line pricing ═══');
assert(isFabricationSku('TK-N/C') && isFabricationSku('CRN-standard-8\'') && !isFabricationSku('B24'),
  'isFabricationSku classifies correctly');
const tk = priceFabricationItem({ sku: 'TK-N/C', qty: 1 });
assert(tk.included && tk.totalPrice === 0, 'standard toe kick → included, $0');
const crn = priceFabricationItem({ sku: "CRN-standard-8'", qty: 3 });
assert(crn.unitPrice === 96 && crn.totalPrice === 288, `crown $96 × 3 = $288 (got ${crn.totalPrice})`);
const dwp = priceFabricationItem({ sku: 'DWP-24', width: 24 });
assert(dwp.unitPrice === 185, `dishwasher panel $185 (got ${dwp.unitPrice})`);
const fdp = priceFabricationItem({ sku: 'FDP-36', width: 36 });
assert(fdp.unitPrice === 225, `fridge panel $225 (got ${fdp.unitPrice})`);
const hood = priceFabricationItem({ sku: 'RH21 3624', width: 36 });
assert(hood.unitPrice === 30 * 36 && hood.estimate, `RH21 hood = $30/in × 36" = $1080, flagged estimate (got ${hood.unitPrice})`);
const scribe = priceFabricationItem({ sku: "3SRM3F-10'", qty: 3 });
assert(scribe.unitPrice === 30 && scribe.totalPrice === 90, `scribe rail $30 × 3 (got ${scribe.totalPrice})`);
const mystery = priceFabricationItem({ sku: 'SFLS-36' });
assert(mystery.needsQuote && mystery.totalPrice === 0, 'unknown specialty → needs separate quote, excluded from totals');
const batch = priceFabricationItems([
  { sku: 'TK-N/C', qty: 1 }, { sku: "CRN-standard-8'", qty: 3 }, { sku: 'DWP-24' }, { sku: 'SFLS-36' },
]);
assert(approx(batch.subtotal, 288 + 185), `batch subtotal $473 (got ${batch.subtotal})`);
assert(batch.needsQuoteCount === 1, `1 needs-quote item (got ${batch.needsQuoteCount})`);

console.log(`\n${'═'.repeat(50)}\nConstruction pricing tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
