/**
 * Eclipse Pricing — Construction-Profile & Fabrication Tests (Phase 1)
 * Covers: Shiloh overlay charges, inset premiums, Eclipse zero-impact
 * regression, Shiloh→Eclipse fallback flagging, fabrication line pricing.
 */

import { calculateItemPrice, calculateLayoutPrice } from './src/pricingEngine.js';
import { findShilohSku } from './src/shilohSkuCatalog.js';
import { findSku } from './src/skuCatalog.js';
import { SPECIES_PCT } from './src/finishData.js';
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
// Crown lists at $17.39/ft (catalog 3 1/2CRN; Soderstrom quote: 3FCR @5' = $86.95)
const crn = priceFabricationItem({ sku: "CRN-standard-8'", qty: 3 });
assert(approx(crn.unitPrice, 139.12) && approx(crn.totalPrice, 417.36), `crown 8 ft = $139.12 × 3 (got ${crn.totalPrice})`);
const crn5 = priceFabricationItem({ sku: "CRN-furniture-5'", qty: 1 });
assert(approx(crn5.unitPrice, 86.95), `furniture crown 5 ft = $86.95 per Soderstrom quote (got ${crn5.unitPrice})`);
const dwp = priceFabricationItem({ sku: 'DWP-24', width: 24 });
assert(dwp.unitPrice === 185, `dishwasher panel $185 (got ${dwp.unitPrice})`);
const fdp = priceFabricationItem({ sku: 'FDP-36', width: 36 });
assert(fdp.unitPrice === 225, `fridge panel $225 (got ${fdp.unitPrice})`);
const hood = priceFabricationItem({ sku: 'RH21 3624', width: 36 });
assert(hood.unitPrice === 30 * 36 && hood.estimate, `RH21 hood = $30/in × 36" = $1080, flagged estimate (got ${hood.unitPrice})`);
// 3SRM lists at $30/ft (W.W. Wood order #45933: 5 ft = $150)
const scribe5 = priceFabricationItem({ sku: "3SRM3F-5'", qty: 1 });
assert(scribe5.unitPrice === 150, `scribe rail 5 ft = $150 per order #45933 (got ${scribe5.unitPrice})`);
const scribe10 = priceFabricationItem({ sku: "3SRM3F-10'", qty: 3 });
assert(scribe10.unitPrice === 300 && scribe10.totalPrice === 900, `scribe rail 10 ft = $300 × 3 (got ${scribe10.totalPrice})`);
const tuk = priceFabricationItem({ sku: 'TUK-STAIN' });
assert(tuk.unitPrice === 31.63, `touch-up kit = $31.63 catalog list (got ${tuk.unitPrice})`);
const mystery = priceFabricationItem({ sku: 'SFLS-36' });
assert(mystery.needsQuote && mystery.totalPrice === 0, 'unknown specialty → needs separate quote, excluded from totals');
const batch = priceFabricationItems([
  { sku: 'TK-N/C', qty: 1 }, { sku: "CRN-standard-8'", qty: 3 }, { sku: 'DWP-24' }, { sku: 'SFLS-36' },
]);
assert(approx(batch.subtotal, 417.36 + 185), `batch subtotal $602.36 (got ${batch.subtotal})`);
assert(batch.needsQuoteCount === 1, `1 needs-quote item (got ${batch.needsQuoteCount})`);

console.log('\n═══ Real-order regression: W.W. Wood confirmation #45933 ═══');
// Line 2: B3D21, Walnut +20%, 3 drawers @ 3/4" Hardwood ($57) + FEG guide ($72)
// = catalog 3/4-PREM-FE $129/drw. Order shows Total Price $1,119.00.
const b3d21 = calculateItemPrice(
  { ...findSku('B3D21'), q: 1, dc: 0, drc: 3, len: 1 },
  'Walnut', 'Standard', 'MET-V', 'DF-MET-V', '3/4-PREM-FE',
);
assert(approx(b3d21.unitPrice, 1119), `B3D21 Walnut + 3× (3/4" box + FEG) = $1,119.00 as invoiced (got ${b3d21.unitPrice.toFixed(2)})`);

console.log('\n═══ Discount multipliers from order confirmations ═══');
// All three confirmations: dealer net = 0.47 × list, rep net = 0.265 × list.
for (const [list, dealerNet, repNet] of [[1832.42, 861.24, 485.59], [12630.55, 5936.36, 3347.09], [2908.84, 1367.15, 770.85]]) {
  assert(approx(list * 0.47, dealerNet, 0.01), `dealer ×0.47: ${list} → ${dealerNet}`);
  assert(approx(list * 0.265, repNet, 0.01), `rep ×0.265: ${list} → ${repNet}`);
}

console.log('\n═══ Soderstrom whole-house quotes (Shiloh SHI342, June 2026) ═══');
// Quote-verified Shiloh list prices — added to the catalog from the real
// quote sheets; these must resolve from the SHILOH catalog (no fallback).
for (const [sku, price] of [
  ['UT1893-RT-27R', 2258], ['INFBDEPL', 656], ['B15R-RT', 912], ['W1836L', 449],
  ['VTSB24L', 506], ['REP11/29330-FTK-L', 514], ['FTK FLUSH TOE', 89], ['FIOM3393-27', 2725],
]) {
  const e = findShilohSku(sku);
  assert(e && !e._fallback && e.p === price, `${sku} = $${price} verified Shiloh list (got ${e?.p}${e?._fallback ? ' via fallback' : ''})`);
}

// Species percentages reproduce the quotes' premium lines exactly:
// Maple 8% of $33,237.38 perimeter = $2,658.99; Rift Cut WO 19% of
// $14,252.65 island = $2,708.00 (rounded); Polar paint adds 10% — the
// engine's "Paint (Std SW)" 18% species = Maple 8% + paint 10% combined.
assert(approx(33237.38 * SPECIES_PCT['Maple'] / 100, 2658.99, 0.01), 'Maple 8% reproduces kitchen premium $2,658.99');
assert(approx(14252.65 * SPECIES_PCT['Rift Cut White Oak'] / 100, 2708.00, 0.51), 'Rift Cut WO 19% reproduces island premium $2,708.00');
assert(SPECIES_PCT['Paint (Std SW)'] === SPECIES_PCT['Maple'] + 10, 'Paint (Std SW) 18% = Maple 8% + Polar paint 10%');

// Inset construction: $0 premium + $55/drawer-front (Malibu inset). The
// upstairs-bath quote shows 4 drawer fronts → $220.00.
const insetItem = calculateItemPrice(
  { s: 'VTB12-4', p: 523, r: 'SHILOH', t: 'V', dc: 0, drc: 4, len: 1, q: 1 },
  'Rift Cut White Oak', 'Standard', 'HNVR', 'DF-HNVR', '5/8-STD',
  { overlayDoorChg: 0, overlayDrawerChg: 55, insetPremiumPct: 0 },
);
assert(approx(insetItem.overlayChg, 220), `inset drawer fronts 4 × $55 = $220 as quoted (got ${insetItem.overlayChg})`);

// Sq-in items price by real dimensions: BCF $1.00/sq-in × 24×30.5 = $732.
const bcf = calculateItemPrice(
  { ...findSku('BCF'), q: 1, sqin: 24 * 30.5 },
  'White Oak', 'Standard',
);
assert(approx(bcf.unitPrice, 732), `BCF 24×30.5 = $732 as quoted (got ${bcf.unitPrice})`);

console.log(`\n${'═'.repeat(50)}\nConstruction pricing tests: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
