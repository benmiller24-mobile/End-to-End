/**
 * 2020-Design SKU dialect decoder.
 * ================================
 * 2020 Design (and Cyncly) exports encode each cabinet's dimensions IN the SKU.
 * This decodes a label → { kind, zone, widthIn, heightIn, depthIn, drawers,
 * appliance } so a competitor's 2020 design PDF can be re-scheduled, priced, and
 * redrawn. Handles both the explicit "D-TYPE<W>x<H>x<D>" form and the packed
 * "W423012BD" / "DB303" forms. Width is the layout/pricing-critical field.
 *
 * Verified against the Wong + Mark-and-Jane kitchens (2020 exports).
 */

// Appliances / fixtures (not cabinetry) — keep as openings, don't price as cabinets.
const APPLIANCE = /^(DISHW|REF|HOOD|CKT|BAR\.|CSK|KOH|SK\.|RT\d|WD\d.*DRYER|MW|OVEN)/i;

const num = (s) => { const m = String(s).match(/-?\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };

export function decode2020(rawSku) {
  const sku = String(rawSku || '').trim();
  const up = sku.toUpperCase();

  // ── Appliances & fixtures ──
  if (APPLIANCE.test(up)) {
    let type = 'appliance', appliance = 'other', width = 24;
    if (/^DISHW/.test(up)) { appliance = 'dishwasher'; width = num(up.slice(5)) || 24; }
    else if (/^REF/.test(up)) { appliance = 'refrigerator'; width = num(up.split('.').pop()) || 36; }
    else if (/^HOOD/.test(up)) { appliance = 'hood'; width = num(up.slice(4)) || 30; }
    else if (/^CKT/.test(up)) { appliance = 'cooktop'; width = num((up.match(/\d+/g) || []).pop()) || 36; }
    else if (/^(CSK|KOH|SK\.)/.test(up)) { appliance = 'sink'; width = null; }
    else if (/^BAR\.WINE/.test(up)) { appliance = 'wine'; width = num((up.match(/\d+/) || [])[0]) || 24; }
    return { sku, kind: type, zone: 'base', appliance, widthIn: width, isAppliance: true };
  }

  // ── Explicit dims: D-<TYPE><W>x<H>x<D><suffix>  e.g. D-DB34x34.5x24-3 ──
  let m = up.match(/^D-([A-Z]+)(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)X(\d+(?:\.\d+)?)(.*)$/);
  if (m) {
    const kind = m[1], w = +m[2], h = +m[3], d = +m[4], rest = m[5];
    const drawers = (rest.match(/-(\d)\b/) || [])[1];
    return { sku, kind, ...zoneFor(kind, h), widthIn: w, heightIn: h, depthIn: d, drawers: drawers ? +drawers : undefined };
  }

  // ── Packed wall: W<WW><HH><DD> (+ optional door-count infix like "1D") ──
  //   W423012BD → 42×30×12 ; W1D335712BD → 33×57×12 ; WD243912L → diag 24×39×12
  m = up.match(/^WD?(?:\dD)?(\d{2})(\d{2})(\d{2})/);
  if (/^W/.test(up) && m) {
    return { sku, kind: 'W', zone: 'wall', widthIn: +m[1], heightIn: +m[2], depthIn: +m[3], corner: up.startsWith('WD') };
  }

  // ── Drawer base: DB<WW><drawers>  e.g. DB303 → 30w/3dr, DB154 → 15w/4dr ──
  m = up.match(/^DB(\d{2})(\d)\b/);
  if (m) return { sku, kind: 'DB', zone: 'base', widthIn: +m[1], drawers: +m[2], heightIn: 34.5 };

  // ── Sink base (incl. lazy corner): SB / SBLC / SBD / SBO ──
  m = up.match(/^SB[A-Z]*?(\d{2})/);
  if (/^SB/.test(up) && m) return { sku, kind: 'SB', zone: 'base', widthIn: +m[1], heightIn: 34.5, sink: true, corner: /LC/.test(up) };

  // ── Base lazy/diagonal corner: BDLC / BLC ──
  m = up.match(/^B[DL]LC(\d{2})/);
  if (m) return { sku, kind: 'BLC', zone: 'base', widthIn: +m[1], heightIn: 34.5, corner: true };

  // ── Oven cabinet: OC<WWW or WW>... (often 1/2" widths, e.g. 25596 = 25.5×96) ──
  m = up.match(/^OC(\d{2})(5?)(\d{2})/);
  if (m) return { sku, kind: 'OC', zone: 'tall', widthIn: +m[1] + (m[2] ? 0.5 : 0), heightIn: +m[3], oven: true };

  // ── Tall/utility corner: UC<WW><HH><DD> e.g. UC339324 → 33×93×24 ──
  m = up.match(/^UC(\d{2})(\d{2})(\d{2})/);
  if (m) return { sku, kind: 'UC', zone: 'tall', widthIn: +m[1], heightIn: +m[2], depthIn: +m[3], corner: true };

  // ── Tall end panel: TEP<WW><HH> / TEPF<t>.<...> ──
  if (/^TEP/.test(up)) { const mm = up.match(/(\d{2})(\d{2})/); return { sku, kind: 'TEP', zone: 'tall', widthIn: mm ? +mm[1] : 1.5, heightIn: mm ? +mm[2] : 96, panel: true }; }

  // ── Above-fridge / refrigerator wall: RW<WW><DD> e.g. RW3612 → 36×12 ──
  m = up.match(/^RW(\d{2})(\d{2})/);
  if (m) return { sku, kind: 'RW', zone: 'wall', widthIn: +m[1], depthIn: +m[2], aboveFridge: true };

  // ── Sink corner wall: SCW<WW><HH><DD> ──
  m = up.match(/^SCW(\d{2})(\d{2})(\d{2})/);
  if (m) return { sku, kind: 'SCW', zone: 'wall', widthIn: +m[1], heightIn: +m[2], depthIn: +m[3], corner: true };

  // ── Generic base B<WW><suffix>: B48BD, B12FHDR, B21L, B45ROTSBD, BO33, BWB182 ──
  m = up.match(/^B[A-Z]?(\d{2})/);
  if (/^B/.test(up) && m) return { sku, kind: 'B', zone: 'base', widthIn: +m[1], heightIn: 34.5, sink: /SB|SINK/.test(up) };

  // ── Fallback: first 2-digit run as width, zone by leading letter ──
  const w = (up.match(/(\d{2})/) || [])[1];
  const zone = /^W/.test(up) ? 'wall' : /^[TU]/.test(up) ? 'tall' : 'base';
  return { sku, kind: up.slice(0, 2), zone, widthIn: w ? +w : null, _weak: true };
}

function zoneFor(kind, h) {
  if (/^W/.test(kind) || /^RW|^SCW/.test(kind)) return { zone: 'wall' };
  if (/^(U|OC|TEP|T)/.test(kind) || (h && h >= 60)) return { zone: 'tall' };
  return { zone: 'base' };
}
