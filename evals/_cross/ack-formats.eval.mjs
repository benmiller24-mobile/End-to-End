/**
 * Tenant-config acknowledgment parsing + the golden-fixture flywheel.
 * ===================================================================
 * The confirmation SHAPE is tenant data (ackFormat), not code: the W.W. Wood
 * anchored-total format is the default; pronorm's numbered-row EU-decimal
 * 50%-discounted format is carried by its package JSON. A zero-variance
 * reconciliation must promote to a golden-order eval whose assertions hold.
 */
import { suite } from '../_lib.mjs';
import { getTenant, DEFAULT_ACK_FORMAT } from '../../eclipse-pricing/src/tenants/index.js';
import { parseAcknowledgment, reconcile, buildGoldenOrderEval } from '../../frontend/src/ackReconcile.js';
import { setPricingBrand, findSkuNormalized } from '../../frontend/src/skuResolver.js';

const WW_TEXT = `Order Number: .... 45923
B 30W, 16DFTKLRBase719.00
Total Price719.00
B3D27W, 16DFTKBase 3 Drawer
Total Price1,058.00
MAPLE premium option line
Cabinet Total: $1,777.00
Dealer Discount: $835.19
Order Amount: $941.81`;

const PN_TEXT = `Commission no. 314440
1 1 HSP 60-201-602 Highboard, 1 Klappe 1.234,56 1.234,56
2 1 US 60-76-60 Unterschrank Spüle 500,00 500,00
Some option text without prices`;

export default async function run() {
  const s = suite('ack formats (tenant-config parsing + fixture flywheel)');

  // ── tenant config: default vs package-declared ──
  s.eq('eclipse uses the default anchored-total format', getTenant('eclipse').ackFormat.kind, 'anchoredTotal');
  s.eq('shiloh inherits the default too', getTenant('shiloh').ackFormat.kind, 'anchoredTotal');
  const pnFmt = getTenant('pronorm').ackFormat;
  s.eq('pronorm declares numbered-row parsing in its PACKAGE (pure data)', pnFmt.kind, 'numberedRows');
  s.eq('pronorm decimals are European', pnFmt.decimal, 'eu');
  s.eq('pronorm confirmations print at 50% of list', pnFmt.listFactor, 0.5);

  // ── W.W. anchored-total parse (the calibrated default) ──
  const ww = parseAcknowledgment(WW_TEXT, DEFAULT_ACK_FORMAT);
  s.eq('WW: 2 items parsed', ww.parsedLines, 2);
  s.eq('WW: B30 read', ww.items[0]?.sku, 'B30');
  s.eq('WW: B30 price', ww.items[0]?.total, 719);
  s.eq('WW: B3D27 price', ww.items[1]?.total, 1058);
  s.eq('WW: cabinet total', ww.totals.cabinetTotal, 1777);
  s.eq('WW: order number', ww.orderNumber, '45923');

  // ── pronorm numbered-rows parse: EU decimals, normalized to LIST ──
  const pn = parseAcknowledgment(PN_TEXT, pnFmt);
  s.eq('PN: 2 items parsed', pn.parsedLines, 2);
  s.eq('PN: order-number SKU intact', pn.items[0]?.sku, 'HSP 60-201-602');
  s.ok('PN: 1.234,56 at 50% → list €2469.12', Math.abs(pn.items[0].total - 2469.12) < 0.005);
  s.ok('PN: 500,00 at 50% → list €1000', Math.abs(pn.items[1].total - 1000) < 0.005);
  s.eq('PN: commission number', pn.orderNumber, '314440');

  // ── reconcile: clean and variance paths ──
  const quote = { subtotal: 1777, items: [
    { sku: 'B30', qty: 1, totalPrice: 719 },
    { sku: 'B3D27', qty: 1, totalPrice: 1058 },
  ] };
  const clean = reconcile(ww, quote);
  s.ok('clean reconciliation is CLEAN', clean.clean);
  const dirty = reconcile(ww, { subtotal: 1700, items: [
    { sku: 'B30', qty: 1, totalPrice: 719 },
    { sku: 'B3D27', qty: 1, totalPrice: 981 },
  ] });
  s.ok('price variance detected', !dirty.clean && dirty.priceDiffs.length === 1);
  s.ok('variance names the SKU and delta', dirty.priceDiffs[0].sku === 'B3D27' && Math.abs(dirty.priceDiffs[0].delta - 77) < 0.01);

  // ── golden-fixture promotion: the generated eval's assertions must HOLD ──
  // Real Mautz-acknowledged lines through the live resolver, exactly what the
  // in-app "Save as regression fixture" button pins.
  setPricingBrand('eclipse');
  const pin = [['W3624', findSkuNormalized('W3624')?.p], ['SB36', findSkuNormalized('SB36')?.p]];
  s.ok('pinnable lines resolve to real prices', pin.every(([, p]) => p > 0));
  const src = buildGoldenOrderEval({ tenantId: 'eclipse', orderNumber: '45923', lines: pin, skipped: ['TUK-STAIN'] });
  s.ok('fixture imports the eval harness', src.includes("from '../_lib.mjs'"));
  s.ok('fixture sets the tenant', src.includes(`setPricingBrand("eclipse")`));
  s.ok('fixture documents skipped lines', src.includes('TUK-STAIN'));
  // Execute the fixture's semantics: every pinned line still resolves to its price.
  const rows = [...src.matchAll(/^\s+\[("[^"]+"), ([\d.]+)\],$/gm)].map(m => [JSON.parse(m[1]), parseFloat(m[2])]);
  s.eq('fixture carries both pinned lines', rows.length, 2);
  for (const [sku, want] of rows) {
    s.eq(`fixture assertion holds: ${sku} = $${want}`, findSkuNormalized(sku)?.p, want);
  }

  return s.done();
}
