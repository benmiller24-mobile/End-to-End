/**
 * Acknowledgment Reconciliation (T3b)
 * ===================================
 * W.W. Wood emails an order confirmation after submission; the dealer has
 * 24 HOURS to review it line-by-line ("mark corrections directly on the
 * acknowledgment and resend to orders@wwinc.com"). This module turns that
 * review from a 30-minute manual diff into seconds: paste the confirmation
 * text (open the PDF → select all → copy) and get a variance report against
 * the app's quote.
 *
 * Parser calibrated against real confirmations #45923 / #45928 / #45933
 * (June 2026 format): item blocks carry SKU + base price + "Total Price"
 * lines; the footer carries Cabinet Total / Dealer Discount / Rep Discount /
 * Order Amount.
 */

const num = (s) => parseFloat(String(s).replace(/[$,]/g, '')) || 0;

/** Parse pasted confirmation text into line items + totals. */
export function parseAcknowledgment(text) {
  const t = String(text || '');
  const items = [];
  // Item blocks: "<idx><qty><SKU-ish>...<desc>...<price>" — the reliable
  // anchors in the text export are "Total Price" lines preceded by a SKU.
  // Strategy: find all "Total Price<amount>" and walk back for the nearest
  // SKU-like token (caps/digits with - / " etc.).
  const lines = t.split(/\n+/).map(l => l.trim()).filter(Boolean);
  let lastSku = null;

  // W.W. Wood confirmation lines concatenate SKU + dims + description + price:
  //   "B 30W, 16DFTKLRBase719.00"      → B30
  //   "B3D27W, 16DFTKBase 3 Drawer…"   → B3D27
  //   "VTSBR30WLRVanity Tall Sink…"    → VTSBR30
  //   "U3D 24W, 93H2D, FDSLRUtility…"  → U3D24
  //   "OVF3W, 89HOverlay Filler…"      → OVF3
  const extractSku = (line) => {
    // Prefer "<alpha-prefix><width>W" — the width belongs to the SKU.
    let m = line.match(/^([A-Z][A-Z0-9 ().\/\-]{0,14}?)(\d{1,2}(?:\s*1\/2)?)W\b/);
    if (m) return (m[1] + m[2]).replace(/\s+/g, '');
    // Parenthetical sizes: "TK (3/4)…", "RH5 30(36)…"
    m = line.match(/^([A-Z]{1,6}\d{0,3}\s?\(\d+\/?\d*\))/);
    if (m) return m[1];
    m = line.match(/^([A-Z][A-Z0-9().\/\-]{1,16})/);
    return m ? m[1] : null;
  };

  for (const line of lines) {
    const tp = line.match(/Total Price\s*\$?([\d,]+\.\d{2})/i);
    if (tp) {
      if (lastSku) items.push({ sku: lastSku, total: num(tp[1]) });
      lastSku = null;
      continue;
    }
    if (/^[\d.,\s$x×]+$/.test(line)) continue;            // price/qty continuation lines
    if (/^(PV|TFL|HPL|MAPLE|WALNUT|ALDER|CHERRY|FEG|FTK Price|Guide|Drawer|Walnut|3\/4"|5\/8"|Ship|Order|Page|Header|Total|Cabinet)/i.test(line)) continue; // option/premium/boilerplate lines
    const tok = extractSku(line);
    if (tok && /\d/.test(tok) && tok.length >= 2) lastSku = tok;
  }
  const grab = (re) => { const m = t.match(re); return m ? num(m[1]) : null; };
  const totals = {
    cabinetTotal: grab(/Cabinet Total:?\s*\$?([\d,]+\.\d{2})/i),
    dealerDiscount: grab(/Dealer Discount:?\s*\$?([\d,]+\.\d{2})/i),
    repDiscount: grab(/Rep Discount:?\s*\$?([\d,]+\.\d{2})/i),
    orderAmount: grab(/Order Amount:?\s*\$?([\d,]+\.\d{2})/i),
  };
  const orderNumber = (t.match(/Order Number:?\s*\.{0,8}\s*(\d{4,6})/i) || [])[1] || null;
  return { items, totals, orderNumber, parsedLines: items.length };
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
