/**
 * Acknowledgment Reconciliation (T3b)
 * ===================================
 * Manufacturers email an order confirmation after submission; the dealer has a
 * short window (W.W. Wood: 24 HOURS — "mark corrections directly on the
 * acknowledgment and resend to orders@wwinc.com") to review it line-by-line.
 * This module turns that review from a 30-minute manual diff into seconds:
 * paste the confirmation text (open the PDF → select all → copy) and get a
 * variance report against the app's quote.
 *
 * The confirmation SHAPE is tenant data, not code: every tenant carries an
 * `ackFormat` (see DEFAULT_ACK_FORMAT in tenants/registry.js — regex sources
 * as strings, so a pure-JSON package can define one). Two parser strategies:
 *   anchoredTotal — item price sits on a labeled line, the SKU is walked back
 *                   (W.W. Wood #45923/28/33, June 2026 — the default)
 *   numberedRows  — "idx qty SKU … price total" rows with EU or US decimals
 *                   (pronorm confirmations — the format the 8-order pronorm
 *                   reconciliation used, see tools/reconcile-pronorm-order.mjs)
 * `listFactor` normalizes discounted confirmations back to LIST on parse.
 */
import { DEFAULT_ACK_FORMAT } from '../../eclipse-pricing/src/tenants/index.js';

const numUS = (s) => parseFloat(String(s).replace(/[$,]/g, '')) || 0;
const numEU = (s) => parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
const numOf = (fmt) => (fmt.decimal === 'eu' ? numEU : numUS);

function parseAnchoredTotal(text, fmt) {
  const num = numOf(fmt);
  const anchorRe = new RegExp(fmt.itemAnchor, 'i');
  const skipRe = fmt.skipLine ? new RegExp(fmt.skipLine, 'i') : null;
  const skuRes = (fmt.skuPatterns || []).map(p => new RegExp(p));
  const extractSku = (line) => {
    for (let i = 0; i < skuRes.length; i++) {
      const m = line.match(skuRes[i]);
      if (m) return m.length > 2 ? (m[1] + m[2]).replace(/\s+/g, '') : m[1];
    }
    return null;
  };
  const items = [];
  let lastSku = null;
  for (const line of String(text || '').split(/\n+/).map(l => l.trim()).filter(Boolean)) {
    const tp = line.match(anchorRe);
    if (tp) {
      if (lastSku) items.push({ sku: lastSku, total: num(tp[1]) });
      lastSku = null;
      continue;
    }
    if (/^[\d.,\s$x×]+$/.test(line)) continue;            // price/qty continuation lines
    if (skipRe && skipRe.test(line)) continue;            // option/premium/boilerplate lines
    const tok = extractSku(line);
    if (tok && /\d/.test(tok) && tok.length >= 2) lastSku = tok;
  }
  return items;
}

function parseNumberedRows(text, fmt) {
  const num = numOf(fmt);
  const lineRe = new RegExp(fmt.lineRe);
  const items = [];
  for (const line of String(text || '').split(/\n+/).map(l => l.trim()).filter(Boolean)) {
    const m = line.match(lineRe);
    if (!m) continue;
    // capture 1 = SKU; the LAST capture = the line total.
    items.push({ sku: m[1].trim(), total: num(m[m.length - 1]) });
  }
  return items;
}

/** Parse pasted confirmation text into line items + totals (normalized to LIST). */
export function parseAcknowledgment(text, format = DEFAULT_ACK_FORMAT) {
  const fmt = { ...DEFAULT_ACK_FORMAT, ...(format || {}) };
  const num = numOf(fmt);
  const t = String(text || '');
  const items = fmt.kind === 'numberedRows' ? parseNumberedRows(t, fmt) : parseAnchoredTotal(t, fmt);
  const factor = fmt.listFactor > 0 ? fmt.listFactor : 1;
  for (const it of items) it.total = it.total / factor;
  const grab = (src) => { if (!src) return null; const m = t.match(new RegExp(src, 'i')); return m ? num(m[1]) / factor : null; };
  const totals = {
    cabinetTotal: grab(fmt.totals?.cabinetTotal),
    dealerDiscount: grab(fmt.totals?.dealerDiscount),
    repDiscount: grab(fmt.totals?.repDiscount),
    orderAmount: grab(fmt.totals?.orderAmount),
  };
  const orderNumber = fmt.orderNumber ? ((t.match(new RegExp(fmt.orderNumber, 'i')) || [])[1] || null) : null;
  return { items, totals, orderNumber, parsedLines: items.length, listFactor: factor };
}

const normSku = (s) => String(s || '').toUpperCase().replace(/^FC-/, '').replace(/\s+/g, '').replace(/[LR]$/, '');

/**
 * Diff a parsed acknowledgment against the app quote.
 * Matching is by normalized SKU with quantity-aware aggregation; price
 * comparison is against the quote's unit totals.
 */
export function reconcile(ack, quote) {
  const quoteAgg = new Map();
  for (const it of (quote?.items || [])) {
    if (it.error) continue;
    const k = normSku(it.sku);
    const e = quoteAgg.get(k) || { sku: it.sku, qty: 0, total: 0 };
    e.qty += it.qty || 1;
    e.total += it.totalPrice || 0;
    quoteAgg.set(k, e);
  }
  for (const f of (quote?.fabrication?.items || [])) {
    if (f.included || f.needsQuote) continue;
    const k = normSku(f.sku);
    const e = quoteAgg.get(k) || { sku: f.sku, qty: 0, total: 0 };
    e.qty += f.qty || 1;
    e.total += f.totalPrice || 0;
    quoteAgg.set(k, e);
  }
  const ackAgg = new Map();
  for (const it of (ack.items || [])) {
    const k = normSku(it.sku);
    const e = ackAgg.get(k) || { sku: it.sku, count: 0, total: 0 };
    e.count += 1;
    e.total += it.total || 0;
    ackAgg.set(k, e);
  }

  const matched = [], priceDiffs = [], onlyQuote = [], onlyAck = [];
  for (const [k, q] of quoteAgg) {
    const a = ackAgg.get(k);
    if (!a) { onlyQuote.push(q); continue; }
    const delta = a.total - q.total;
    if (Math.abs(delta) > 0.02) priceDiffs.push({ sku: q.sku, quote: q.total, ack: a.total, delta });
    else matched.push({ sku: q.sku, total: q.total });
    ackAgg.delete(k);
  }
  for (const [, a] of ackAgg) onlyAck.push(a);

  const quoteSubtotal = (quote?.subtotal || 0) + (quote?.fabrication?.subtotal || 0);
  const totalDelta = ack.totals?.cabinetTotal != null ? ack.totals.cabinetTotal - quoteSubtotal : null;
  const clean = priceDiffs.length === 0 && onlyQuote.length === 0 && onlyAck.length === 0 &&
    (totalDelta == null || Math.abs(totalDelta) <= 0.02);
  return { clean, matched, priceDiffs, onlyQuote, onlyAck, quoteSubtotal, ackTotals: ack.totals || {}, totalDelta, orderNumber: ack.orderNumber };
}

/**
 * Golden-order fixture generator — the trust flywheel's closing move.
 * A ZERO-VARIANCE reconciliation becomes a permanent regression eval: every
 * acknowledged line whose price the live resolver reproduces to the penny is
 * pinned, in the exact shape evals/<tenant>/order-*.eval.mjs uses (see
 * evals/eclipse/order-mautz.eval.mjs). Drop the download into evals/<tenant>/
 * and commit — `node evals/run.mjs <tenant>` runs it forever after.
 *
 * @param {Object} o
 * @param {string} o.tenantId
 * @param {string|null} o.orderNumber
 * @param {Array<{sku:string, price:number}>} o.lines   resolver-confirmed [SKU, list]
 * @param {Array<string>} [o.skipped]  acknowledged SKUs NOT pinned (option-priced etc.)
 * @returns {string} complete .eval.mjs source
 */
export function buildGoldenOrderEval({ tenantId, orderNumber, lines, skipped = [] }) {
  const name = orderNumber ? `order #${orderNumber}` : 'reconciled order';
  const rows = lines.map(([sku, p]) => `  [${JSON.stringify(sku)}, ${p}],`).join('\n');
  return `/**
 * GOLDEN ORDER — ${name} (${tenantId}), promoted from a zero-variance
 * acknowledgment reconciliation in the app on ${new Date().toISOString().slice(0, 10)}.
 * Every order-style code below must resolve to its acknowledged list price
 * through the live resolver, forever.${skipped.length ? `\n * Not pinned (option-priced or non-catalog): ${skipped.join(', ')}` : ''}
 */
import { suite } from '../_lib.mjs';
import { setPricingBrand, findSkuNormalized } from '../../frontend/src/skuResolver.js';

const LINES = [
${rows}
];

export default async function run() {
  const s = suite(${JSON.stringify(`${tenantId} golden ${name}`)});
  setPricingBrand(${JSON.stringify(tenantId)});
  for (const [sku, want] of LINES) {
    const e = findSkuNormalized(sku);
    s.eq(\`\${sku} = \${want}\`, e?.p, want);
  }
  return s.done();
}
`;
}
