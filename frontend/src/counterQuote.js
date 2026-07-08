/**
 * Counter-quote — price ONE design (typically imported from a competitor's
 * 2020/Cyncly PDF) in EVERY registered line, with honest resolution grades.
 * =========================================================================
 * Pure module: no React, no DOM — the Design Studio panel, the counter-quote
 * PDF, and the headless eval (evals/_cross/counter-quote.eval.mjs) all price
 * through this one function, so the number a dealer shows a customer is the
 * number the regression suite pins.
 *
 * Every row is graded by HOW it resolved in each line (skuResolver's tags):
 *   exact       — the line's catalog carries the SKU verbatim
 *   normalized  — mapped by family/width/dialect rules (incl. metric realize)
 *   substituted — the universal filler catch-all fired (NOT an equivalent)
 *   missing     — no equivalent at all; priced 0 and listed, never dropped
 * Cabinet LIST prices only — trim/fabrication estimates stay on the full
 * quote, where their assumptions are visible.
 */
import { getTenant, listTenants } from '../../eclipse-pricing/src/tenants/index.js';
import { calculateLayoutPrice } from '../../eclipse-pricing/src/pricingEngine.js';
import { setPricingBrand, getPricingBrand, findSkuNormalized } from './skuResolver.js';
import { CONSTRUCTIONS, getConstruction } from './constructionProfiles.js';

const currencyOf = (t) => (t?.locale?.currency === 'EUR' ? '€' : '$');

// The line's own default construction drives overlay charges; a line with no
// registered constructions (metric/data-package tenants) prices at list.
function profileFor(tenantId, preferredFrameStyle) {
  const own = Object.keys(CONSTRUCTIONS).filter(k => CONSTRUCTIONS[k].brand === tenantId);
  const key = own.includes(preferredFrameStyle) ? preferredFrameStyle : own[0];
  if (!key) return { overlayDoorChg: 0, overlayDrawerChg: 0, insetPremiumPct: 0 };
  const c = getConstruction(key);
  return {
    overlayDoorChg: c.overlayCharge?.door || 0,
    overlayDrawerChg: c.overlayCharge?.drawer || 0,
    insetPremiumPct: c.insetPremiumPct || 0,
  };
}

/**
 * @param {Object} opts
 * @param {Array}  opts.placements  [{sku, qty?}] — the design's line items
 * @param {Object} opts.materials   {species, door, construction, frameStyle}
 * @param {Array}  [opts.tenantIds] lines to quote (default: every registered line)
 * @returns {{columns: Array}} one column per line:
 *   { tenantId, label, currency, subtotal, counts:{exact,normalized,substituted,missing},
 *     note, rows:[{srcSku, sku, qty, total, resolution, fallback}] }
 */
export function buildCounterQuote({ placements, materials, tenantIds = null }) {
  const prior = getPricingBrand();
  const ids = tenantIds || listTenants().map(t => t.id);
  const columns = [];
  try {
    for (const id of ids) {
      const tenant = getTenant(id);
      setPricingBrand(id);
      const config = {
        species: materials.species, construction: materials.construction || 'Standard',
        door: materials.door, drawerFront: 'DF-' + materials.door, drawerBox: '5/8-STD',
        profile: profileFor(id, materials.frameStyle),
      };
      const res = calculateLayoutPrice(
        placements.map(p => ({ sku: p.sku, qty: p.qty || 1 })), config, findSkuNormalized);
      const counts = { exact: 0, normalized: 0, substituted: 0, missing: 0 };
      const rows = res.items.map(it => {
        const resolution = it.error ? 'missing' : (it._resolution || 'exact');
        counts[resolution] = (counts[resolution] || 0) + 1;
        return {
          srcSku: it.sku, sku: it.error ? null : (it.s || it.sku), qty: it.q || it.qty || 1,
          total: it.error ? 0 : (it.totalPrice || 0),
          resolution, fallback: it._fallback || null,
        };
      });
      columns.push({
        tenantId: id,
        label: tenant.branding?.lineLabel || id,
        currency: currencyOf(tenant),
        subtotal: Math.round(res.subtotal || 0),
        counts,
        note: tenant.branding?.catalogNote || null,
        rows,
      });
    }
  } finally {
    if (prior) setPricingBrand(prior);
  }
  return { columns };
}

/** Delta of each column vs the FIRST, only where currencies match (no FX guesses). */
export function counterQuoteDeltas(columns) {
  const base = columns[0];
  return columns.map((c, i) => {
    if (i === 0 || !base || c.currency !== base.currency) return null;
    return c.subtotal - base.subtotal;
  });
}
