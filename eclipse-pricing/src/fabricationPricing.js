/**
 * Eclipse Cabinetry — Fabrication, Trim & Panel Pricing
 * =====================================================
 * The solver emits fabrication/trim placements (toe kick, crown, light rail,
 * scribe, appliance panels, hoods, touch-up) that have no direct C3 catalog
 * row. Historically these were filtered out of the quote and silently
 * zero-priced. This module prices them explicitly so every item the design
 * shows is either priced, marked "included", or marked "quote separately" —
 * never silently dropped.
 *
 * Rates are sourced from ACCESSORY_PRICING in eclipse-engine/src/pricing.js
 * (per-piece prices derived from real Eclipse project orders) and from the
 * Eclipse catalog where a row exists. Hood canopies (RH families, catalog
 * ref H2/H3) carry a per-inch-of-width list price; those line items are
 * flagged `estimate: true` until confirmed against the catalog spec page.
 */

import { findSku } from './skuCatalog.js';

// SKU prefixes the solver emits for fabrication/trim/labor items.
// Shared with the frontend so the cabinet-pricing path and this module
// split placements identically.
export const FABRICATION_PREFIXES = [
  'TK-', 'CRN-', 'LR-', 'SCRIBE', 'DWP-', 'DW-TK', 'FDP-', 'FZP-',
  'GRILLE-', 'TUK-', 'STK-BOX', 'FTP-', 'PLN-', 'FBM-', 'PTKL',
  'CEIL-', 'VLN-', 'LB-', 'RH', '3SRM', 'SFLS',
];

export function isFabricationSku(sku) {
  return !!sku && FABRICATION_PREFIXES.some(pfx => sku.startsWith(pfx));
}

// Per-piece rules, first match wins. `price` may be a number or fn(placement).
// included: true → $0 by policy (standard with order), shown as "Included".
// needsQuote: true → no reliable rate; surfaced for a manual dealer quote.
const RULES = [
  // ── Toe kick: standard skins/miters/returns ship no-charge with the order ──
  { match: /^TK-/, label: 'Toe kick (standard, included with order)', price: 0, included: true },

  // ── Crown moulding: catalog lists $17.39/ft (3 1/2CRN and 3FCR furniture
  //    crown both; verified on the Soderstrom Primary quote — 3FCR @5' = $86.95).
  //    Length parses from the SKU suffix (CRN-standard-8' → 8 ft). ──
  { match: /^CRN-/, label: 'Crown moulding ($17.39/ft)', price: p => +(17.39 * Math.ceil(parseFloat(p.sku.match(/-(\d+(?:\.\d+)?)'/)?.[1]) || 8)).toFixed(2) },

  // ── Light rail under uppers (per 8' stick) ──
  { match: /^LR-STD/, label: 'Light rail — standard profile, 8\' stick', price: 48 },
  { match: /^LR-BEV/, label: 'Light rail — beveled profile, 8\' stick', price: 64 },
  { match: /^LR-COV/, label: 'Light rail — cove profile, 8\' stick', price: 80 },
  { match: /^LR-OGE/, label: 'Light rail — ogee profile, 8\' stick', price: 96 },
  { match: /^LR-/, label: 'Light rail, 8\' stick', price: 64 },

  // ── Scribe & scribe-rail moulding ──
  { match: /^SCRIBE/, label: 'Scribe moulding, 8\' stick', price: 25 },
  // 3SRM lists at $30/ft, rounded up to whole feet (verified against W.W. Wood
  // order confirmation #45933: 3SRM3F 5 ft = $150.00). Length parses from the
  // SKU suffix (3SRM3F-10' → 10 ft); default 8 ft when absent.
  { match: /^3SRM/, label: 'Scribe rail moulding ($30/ft)', price: p => 30 * Math.ceil(parseFloat(p.sku.match(/-(\d+(?:\.\d+)?)'/)?.[1]) || 8) },

  // ── Appliance panels (match door style/species) ──
  { match: /^DWP-/, label: 'Dishwasher panel overlay', price: 185 },
  { match: /^DW-TK/, label: 'Dishwasher toe kick panel', price: 45 },
  { match: /^FDP-/, label: 'Refrigerator panel overlay (panel-ready)', price: 225 },
  { match: /^FZP-/, label: 'Freezer drawer panel', price: 145 },
  { match: /^GRILLE-/, label: 'Refrigerator grille panel', price: 95 },

  // ── Base treatments ──
  { match: /^FBM-/, label: 'Furniture base moulding, 8\' stick', price: 85 },
  { match: /^PLN-/, label: 'Plinth base, 8\' stick', price: 20 },

  // ── Valances & light bridges ──
  { match: /^VLN-/, label: 'Valance', price: 45 },
  { match: /^LB-/, label: 'Light bridge', price: p => Math.max(24, Math.round(8 * ((p.width || 36) / 12))) },

  // ── Touch-up (catalog list, confirmed on order #45933: TUK = $31.63) ──
  { match: /^TUK-/, label: 'Touch-up kit', price: 31.63 },

  // ── Hood vent blowers/liners: fully-priced catalog units ──
  { match: /^RHVB/, label: 'Hood vent blower', price: (p) => findSku(p.sku)?.p ?? findSku(p.sku.split(/\s/)[0])?.p ?? null },

  // ── Wood hood canopies: catalog RH families list per inch of width ──
  {
    match: /^RH\d/, label: 'Wood hood canopy',
    price: (p) => {
      // Fully-priced units (e.g. "RH5 30(36)") resolve directly.
      const direct = findSku(p.sku);
      if (direct && direct.p > 500) return direct.p;
      const family = p.sku.match(/^(RH\d+)/)?.[1];
      const entry = family ? findSku(family) : null;
      const width = p.width || parseInt(p.sku.match(/\s(\d{2})\d{2}$/)?.[1], 10) || 36;
      if (entry) return Math.round(entry.p * width);
      return null; // unknown hood family → needs quote
    },
    estimate: true,
  },
  { match: /^PRH/, label: 'Plaster hood (site-built by trades)', needsQuote: true },

  // ── No reliable rate — surface for manual quote, never silently $0 ──
  { match: /^(STK-BOX|FTP-|PTKL|CEIL-|SFLS)/, label: 'Specialty fabrication', needsQuote: true },
];

/**
 * Price one fabrication placement.
 * @returns {Object} { sku, label, qty, unitPrice, totalPrice, included, needsQuote, estimate }
 */
export function priceFabricationItem(placement) {
  const sku = placement.sku || '';
  const qty = placement.qty || 1;
  for (const rule of RULES) {
    if (!rule.match.test(sku)) continue;
    if (rule.needsQuote) {
      return { sku, label: rule.label, qty, unitPrice: 0, totalPrice: 0, included: false, needsQuote: true, estimate: false };
    }
    const unit = typeof rule.price === 'function' ? rule.price(placement) : rule.price;
    if (unit == null) {
      return { sku, label: rule.label, qty, unitPrice: 0, totalPrice: 0, included: false, needsQuote: true, estimate: false };
    }
    return {
      sku, label: rule.label, qty,
      unitPrice: unit, totalPrice: unit * qty,
      included: !!rule.included && unit === 0,
      needsQuote: false, estimate: !!rule.estimate,
    };
  }
  // Unrecognized fabrication SKU → visible, unpriced, flagged.
  return { sku, label: 'Fabrication item', qty, unitPrice: 0, totalPrice: 0, included: false, needsQuote: true, estimate: false };
}

/**
 * Price all fabrication placements from a solve.
 * @param {Array} placements - solver placements already filtered to fabrication SKUs
 * @returns {Object} { items, subtotal, needsQuoteCount }
 */
export function priceFabricationItems(placements) {
  const items = (placements || []).map(priceFabricationItem);
  const subtotal = items.reduce((s, i) => s + i.totalPrice, 0);
  const needsQuoteCount = items.filter(i => i.needsQuote).length;
  return { items, subtotal, needsQuoteCount };
}
