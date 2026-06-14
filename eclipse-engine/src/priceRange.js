/**
 * Consumer price-range banding.
 * =============================
 * The dealer tools quote to the dollar; the CONSUMER (FAKS / Showroom Atlas)
 * surface must only ever show a RANGE — a homeowner gets a ballpark, then a real
 * quote from a local dealer. This bands an engine total into a friendly low–high,
 * widened by an uncertainty % (imported/estimated dims, finish/options not yet
 * chosen) and rounded to clean numbers so it reads as an estimate, not a price.
 */
const round = (n, step) => Math.round(n / step) * step;

export function priceRange(total, { pct = 0.15, currency = 'USD' } = {}) {
  const t = Math.max(0, Number(total) || 0);
  // Round step scales with magnitude so $9,240 → $9,000 / $11,000, not $9,237.
  const step = t >= 20000 ? 1000 : t >= 8000 ? 500 : t >= 2000 ? 250 : 100;
  const low = round(t * (1 - pct), step);
  const high = round(t * (1 + pct), step);
  const sym = currency === 'EUR' ? '€' : '$';
  const fmt = (n) => sym + n.toLocaleString('en-US');
  return { low, high, mid: round(t, step), currency, display: `${fmt(low)} – ${fmt(high)}` };
}
