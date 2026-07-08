/**
 * SKU resolution — shared by the quote path and the Design Studio catalog
 * browser so a browsed price always equals the placed price. Brand-aware via
 * setPricingBrand; every result is tagged with HOW it resolved (exact /
 * normalized / substituted) plus the Shiloh→Eclipse _fallback flag.
 */
import { getActiveTenant, getTenant, setActiveTenant, activeTenantId } from '../../eclipse-pricing/src/tenants/index.js';
import { decode2020, canonicalWW } from './decode2020.js';
import { skuInfo } from './manualDesign.js';

const IN_PER_CM = 0.393701;
// Realize a W.W./2020 cabinet SKU into the active METRIC tenant (e.g. pronorm),
// which has no W.W. SKUs: map by function + size to the nearest catalog body at
// the active price group and standard carcase height. Returns a catalog-shaped
// entry (so calculateLayoutPrice prices it) or null. This makes a price-group
// line quote ANY design — auto, manual, or imported — not just realized solves.
function realizeMetric(sku, t) {
  let d = decode2020(sku);
  if (!d || !(d.widthIn > 0) || d._weak) {
    try { const i = skuInfo(sku, 'eclipse'); if (i && i.w > 0) d = { widthIn: i.w, zone: i.zone === 'upper' ? 'wall' : (i.zone || 'base'), sink: /sink|^SB/i.test(sku) }; } catch { /* */ }
  }
  if (!d || !(d.widthIn > 0) || d.isAppliance) return null;
  const group = t.pricing.activeGroup ?? t.pricing.defaultGroup ?? '0';
  const letter = d.zone === 'wall' ? 'O' : d.zone === 'tall' ? 'H' : (d.sink ? 'US' : 'U');
  const hBand = d.zone === 'base' ? 76 : d.zone === 'tall' ? 208 : 0;
  const wcm = Math.round(d.widthIn / IN_PER_CM);
  const norm = (s) => String(s).toUpperCase().replace(/\s+/g, '');
  let pool = t.catalog.list().filter(e => {
    if (!e.pg || !(e.w > 0) || e.pg[group] == null) return false;
    const n = norm(e.s), c = n[letter.length];
    return n.startsWith(letter) && c >= '0' && c <= '9';
  });
  if (!pool.length) return null;
  const hOf = (e) => { const m = norm(e.s).slice(letter.length).match(/^\d+-(\d+)/); return m ? +m[1] : 0; };
  if (hBand) { let bh = hOf(pool[0]), bd = Infinity; for (const e of pool) { const dd = Math.abs(hOf(e) - hBand); if (dd < bd) { bd = dd; bh = hOf(e); } } pool = pool.filter(e => hOf(e) === bh); }
  let best = pool[0], bd = Infinity;
  for (const e of pool) { const dd = Math.abs(e.w - wcm); if (dd < bd) { bd = dd; best = e; } }
  return { ...best, p: best.pg[group], _resolution: 'normalized', _realizedFrom: sku };
}

// ── SKU normalization ──
// Pick the catalog SKU of a family whose embedded width is closest to `w`.
function nearestInFamily(prefix, w) {
  const res = searchSkus(prefix);
  if (!res.length) return null;
  if (w == null) return res[0];
  const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('^' + esc + '\\D*(\\d+)');
  let best = null, bd = Infinity;
  for (const c of res) {
    const cs = c.s || c.sku || '';
    const m = cs.match(re);
    if (m) { const d = Math.abs(parseInt(m[1], 10) - w); if (d < bd) { bd = d; best = c; } }
  }
  return best || res[0];
}

// The catalog gateway is the ACTIVE TENANT — no brand names in code. Any
// registered tenant (built-in or data-package) prices through the same path.
export function setPricingBrand(id) { setActiveTenant(id); }
export const getPricingBrand = () => activeTenantId();
function _baseFind(sku) { return getActiveTenant().catalog.find(sku); }
// Family searches honor the tenant's declared price-fallback line (e.g.
// Shiloh → Eclipse), tagging results so quotes can flag the substitution.
function searchSkus(q, limit) {
  const t = getActiveTenant();
  let res = t.catalog.search(q, limit) || [];
  if (!res.length && t.pricing?.fallbackTenant) {
    const fb = getTenant(t.pricing.fallbackTenant);
    res = (fb.catalog.search(q, limit) || []).map(e => ({ ...e, _fallback: fb.id }));
  }
  return res;
}

// Strict-resolution wrapper (T4): every lookup is tagged with HOW it resolved —
//   exact        → the catalog has this SKU verbatim (order-grade)
//   normalized   → resolved via hinge-strip/width/family rules (review)
//   substituted  → the universal filler catch-all fired for a non-filler SKU
//                  (NOT order-grade; silent substitution kills dealer trust)
// `_fallback` (Shiloh→Eclipse) propagates from the brand catalog separately.
export function findSkuNormalized(sku, _depth = 0) {
  const exact = _baseFind(sku);
  if (exact) return { ...exact, _resolution: 'exact' };
  const t = getActiveTenant();
  // Metric / price-group tenant (pronorm): its catalogue has no W.W. SKUs, so a
  // W.W./2020 design SKU realizes to the nearest metric body by function+size.
  if (t.realize && t.pricing?.priceGroups) { const m = realizeMetric(sku, t); if (m) return m; }
  // 2020-Design / competitor dialect (DB303, D-DB34x34.5x24-3, UC…, B48): map by
  // function+size to the canonical W.W. SKU so it prices right in Eclipse/Shiloh
  // (the fuzzy resolver below otherwise mis-maps these). High-confidence only.
  if (_depth === 0) {
    const d = decode2020(sku);
    // Only UNAMBIGUOUS 2020 dialect (D-…, 6-digit packed walls, DB###, OC/UC…) —
    // never the generic B##/SB## branches, which collide with native W.W. SKUs
    // the W.W. resolver already prices right (e.g. BL36-PHR corner susan).
    if (d && d._strict2020 && !d.isAppliance && d.widthIn > 0) {
      const canon = canonicalWW(d);
      if (canon && canon !== sku) { const c = findSkuNormalized(canon, _depth + 1); if (c && !c.error) return { ...c, _resolution: c._resolution === 'exact' ? 'normalized' : c._resolution }; }
    }
  }
  const r = resolveSku(sku, _depth);
  if (!r) return r;
  const fillerSub = /FILL/i.test(r.s || '') && !/F\d|FILL|OVF|SCRIBE|3SRM/i.test(sku);
  return { ...r, _resolution: fillerSub ? 'substituted' : 'normalized' };
}

function resolveSku(sku, _depth = 0) {
  let r = _baseFind(sku); if (r) return r;

  // Hinge / handing suffix strip (W…R, B…-FHDL, B2HD24L, FLVSB9L, BWDMA42R, B9L, …):
  // the solver appends a hinge letter that the price catalog omits. Strip and recurse.
  if (_depth < 4) {
    const variants = [
      sku.replace(/(RT)[LR]$/, '$1'),
      sku.replace(/(FHD)[LR]$/, '$1'),
      sku.replace(/(\dHD\d+)[LR]$/, '$1'),
      sku.replace(/(BWDMA\d+)[LR]$/, '$1'),
      sku.replace(/(FLVSB\d+)[LR]$/, '$1'),
      sku.replace(/-[LR]$/, ''),
      sku.replace(/([0-9A-Z])[LR]$/, '$1'),
    ].filter(v => v && v !== sku);
    for (const v of [...new Set(variants)]) { const rr = resolveSku(v, _depth + 1); if (rr) return rr; }
  }

  let s = sku.replace(/(\d+)\.5/g, '$1 1/2'); r = _baseFind(s); if (r) return r;
  s = s.replace(/-PH([LR])$/, '-PH'); r = _baseFind(s); if (r) return r;
  // B-RT27 → B27-RT (solver puts width after suffix, catalog puts it before)
  if (/^B-RT\d/.test(sku)) { const m = sku.match(/^B-RT(\d+)/); if (m) { r = _baseFind(`B${m[1]}-RT`); if (r) return r; r = _baseFind(`B${m[1]}-1DR-RT`); if (r) return r; } }
  // BEP3/4L-FTK → BEP3/4-FTK-L/R
  if (/^BEP3\/4[LR]-FTK/.test(sku)) { r = _baseFind('BEP3/4-FTK-L/R'); if (r) return r; }
  if (/^BEP3\/4[LR]$/.test(sku)) { r = _baseFind('BEP3/4-L/R'); if (r) return r; }
  // FREP fridge end panels (order style 'FREP3/4 93FTK24L'):
  // thickness + height + FTK? + depth + hand → FREP3/4-FTK-24-L/R-93"
  if (/^FREP/.test(sku)) {
    const m = sku.match(/^FREP([\d/. ]+?)[\s-]+(\d{2,3})\s*(FTK)?\s*(\d{2})?\s*[LR]?T?$/i);
    if (m) {
      const t = m[1].trim().replace('.5', ' 1/2'), h = m[2], d = m[4] || '24';
      r = _baseFind(`FREP${t}-FTK-${d}-L/R-${h}"`) || _baseFind(`FREP${t}-${d}-L/R-${h}"`);
      if (r) return r;
    }
  }
  // Decorative door end panels. Base/vanity are height-independent
  // (BDEP-F LT → BDEP-F); utility/wall variants carry height (+depth):
  // 'UDEP-F 93-24 LT' → UDEP-24-F-93", 'WDEP-F 39' → WDEP-F-39"
  if (/^(B|V|VT)DEP/.test(sku)) {
    const f = /-F/i.test(sku.slice(4)) || /DEP-F/i.test(sku) ? '-F' : '';
    r = _baseFind(sku.match(/^(B|V|VT)DEP/)[1] + 'DEP' + f); if (r) return r;
  }
  if (/^UT?DEP/.test(sku)) {
    const fam = sku.match(/^(UT?DEP)/)[1];
    const f = /DEP-F|[\s-]F\b/i.test(sku);
    const nums = (sku.match(/\d{2,3}(?:\.\d+)?/g) || []).map(Number);
    const h = nums.find(n => [84, 87, 90, 93, 96, 102, 108, 114].includes(n)) || 84;
    const d = nums.find(n => [21, 24, 27, 30].includes(n) && n !== h) || 24;
    r = _baseFind(`${fam}-${d}${f ? '-F' : ''}-${h}"`) || _baseFind(`${fam}-${d}-${h}"`);
    if (r) return r;
  }
  if (/^(SW-)?WDEP/.test(sku)) {
    const sw = /^SW-/.test(sku) ? 'SW-' : '';
    const f = /DEP-F/i.test(sku);
    const h = sku.match(/(\d{2})/)?.[1];
    if (h) { r = _baseFind(`${sw}WDEP${f ? '-F' : ''}-${h}"`); if (r) return r; }
  }
  // Utility tall with encoded height (order style 'U22 1/293R', 'U2493L',
  // 'UT24-2D93') → patched height entries U{w}-{h}"
  {
    const um = sku.replace(/(\d+)\.5/g, '$1 1/2')
      .match(/^UT?((?:\d+(?: 1\/2)?)(?:-2D)?)[ -]?(84|87|90|93|96|102|108|114)[LR]?$/);
    if (um) { r = _baseFind(`U${um[1]}-${um[2]}"`) || _baseFind(`U${um[1]}`); if (r) return r; }
  }
  // Wall square corner w/ expandable leg: WSE2430-39R → height table WSE-39"
  if (/^WSE/.test(sku)) {
    const h = sku.match(/-(\d{2})[LR]?$/)?.[1];
    if (h) { r = _baseFind(`WSE-${h}"`); if (r) return r; }
    r = _baseFind('WSE(--)(--)-'); if (r) return r;
  }
  // FWEP3/4L or FWEP3/4R → FWEP3/4-L/R-27" (try common heights)
  if (/^FWEP3\/4[LR]$/.test(sku)) { for (const h of [27,30,33,36,39,42]) { r = _baseFind(`FWEP3/4-L/R-${h}"`); if (r) return r; } }
  // SCRIBE-8' → search for scribe
  if (/^SCRIBE/i.test(sku)) { const results = searchSkus('SCRIBE'); if (results.length) return results[0]; r = _baseFind('3SRM3F-10\''); if (r) return r; }
  // DWP-24 → search for DWP
  if (/^DWP/.test(sku)) { const results = searchSkus('DWP'); if (results.length) return results[0]; }
  if (/^S?WSC\d+/.test(sku)) {
    const b = sku.match(/^(S?WSC\d{2})/)?.[1];
    const dep = sku.match(/\((\d+)\)/)?.[1];
    if (b) {
      if (dep) { r = _baseFind(`${b}--(${dep})`); if (r) return r; r = _baseFind(`${b} --(${dep})`); if (r) return r; }
      r = _baseFind(b + '-PH'); if (r) return r;
      r = _baseFind(b.replace(/^S/, '') + '-PH'); if (r) return r;   // SWSC24 → WSC24-PH
      const res = searchSkus(b); if (res.length) return res[0];
    }
  }
  if (/^W\d/.test(sku)) {
    const m = sku.match(/^W(\d+(?:\.\d+)?)(\d{2,3})[LR]?$/);
    if (m) {
      const wNum = parseFloat(m[1]);
      // fractional width = a width modification: W.W. prices it at the next
      // size UP (MOD WIDTH N/C, "use next size up cabinet and size down")
      const wUp = wNum % 3 === 0 ? wNum : Math.ceil(wNum / 3) * 3;
      r = _baseFind('W' + wUp + m[2]) || _baseFind('W' + Math.round(wNum) + m[2]); if (r) return r;
      r = _baseFind('W' + wUp + '36'); if (r) return r;
    }
  }
  if (/^(OVF3|F3)\d{2}/.test(sku)) { const results = searchSkus(sku.startsWith('OVF3') ? 'OVF3' : 'F3'); if (results.length) return results[0]; }
  if (/^REP/.test(sku)) { const m = sku.match(/^REP([\d./]+)\s*(\d{2,3})FTK-(\d+)/); if (m) { let t = m[1].replace('.5', ' 1/2'); r = _baseFind(`REP${t}-${m[3]}-L/R-${m[2]}"`); if (r) return r; const results = searchSkus('REP' + t.substring(0, 3)); const hm = results.find(x => x.s.includes(m[2] + '"')); if (hm) return hm; if (results.length) return results[0]; } }
  if (/^F[BWS]?EP/.test(sku)) { const base = sku.replace(/\s+/g, '').replace(/-(L|R)$/, '-L/R'); r = _baseFind(base); if (r) return r; const results = searchSkus(sku.split(/[\s-]/)[0]); if (results.length) return results[0]; }
  if (/^FC-[ST][BU]EP/.test(sku)) { const results = searchSkus(sku.match(/^FC-[A-Z]+/)?.[0] || sku.substring(0, 8)); if (results.length) return results[0]; }
  if (/^RW\d+/.test(sku)) { const m = sku.match(/^(RW\d{2})(\d{2})?-?(\d{2})?/); if (m) { const d = m[3] || m[2] || ''; r = _baseFind(m[1] + d); if (r) return r; const results = searchSkus(m[1]); if (results.length) return results[0]; } }
  if (/^P?RH\d/.test(sku)) { r = _baseFind(sku.split(/\s/)[0]); if (r) return r; }
  if (/^FC-OM\d/.test(sku)) { const m = sku.match(/^(FC-OM\d{2})/); if (m) { r = _baseFind(m[1]); if (r) return r; const results = searchSkus(m[1]); if (results.length) return results[0]; } }
  if (/^3SRM/.test(sku)) { r = _baseFind(sku.split('-')[0]); if (r) return r; }
  if (/^TU?K/.test(sku)) { const results = searchSkus(sku.substring(0, 3)); if (results.length) return results[0]; }
  if (/^(FC-)?B3?D?9$/.test(sku)) { r = _baseFind('B9'); if (r) return r; }
  const wm = sku.match(/^((?:FC-)?[A-Z]+\d*[A-Z]*)(\d{2})$/);
  if (wm) { const sw = [9,12,15,18,21,24,27,30,33,36,39,42]; const w = parseInt(wm[2]); if (!sw.includes(w)) { const n = sw.reduce((a,b) => Math.abs(b-w) < Math.abs(a-w) ? b : a); r = _baseFind(wm[1] + n); if (r) return r; } }
  if (/^BBC\d/.test(sku)) { const m = sku.match(/^(BBC\d{2})/); if (m) { r = _baseFind(m[1]); if (r) return r; } }
  if (/^WND\d/.test(sku)) { const m = sku.match(/^(WND\d{2})/); if (m) { r = _baseFind(m[1]); if (r) return r; } }
  if (/-FHD/.test(sku)) { r = _baseFind(sku); if (r) return r; const fm = sku.match(/^((?:FC-)?[A-Z]+)(\d{2})(-FHD)$/); if (fm) { const sw = [18,21,24,27,30,33,36,39,42]; const w = parseInt(fm[2]); if (!sw.includes(w)) { const n = sw.reduce((a,b) => Math.abs(b-w) < Math.abs(a-w) ? b : a); r = _baseFind(fm[1] + n + fm[3]); if (r) return r; } } }
  if (/\|/.test(sku)) { const results = searchSkus(sku.split('|')[0]); if (results.length) return results[0]; }
  if (/^(LBRK|CRN|LB)-/.test(sku)) { const results = searchSkus(sku.split('-')[0]); if (results.length) return results[0]; }
  if (/^LR/.test(sku)) { const results = searchSkus('LR'); if (results.length) return results[0]; }
  if (/^FC-/.test(sku)) { const stripped = sku.replace(/^FC-/, ''); r = _baseFind(stripped); if (r) return r; const sf = stripped.replace(/(\d+)\.5/g, '$1 1/2'); r = _baseFind(sf); if (r) return r; const results = searchSkus(stripped.substring(0, Math.min(stripped.length, 8))); if (results.length) return results[0]; }

  // ── Family nearest-width fallbacks → map to an AVAILABLE catalog SKU ──
  const widthOf = (str) => { const m = str.match(/(\d{2})/); return m ? parseInt(m[1], 10) : null; };
  const nearestStd = (w) => [12,15,18,21,24,27,30,33,36,42,48].reduce((a, b) => Math.abs(b - w) < Math.abs(a - w) ? b : a, 24);
  if (/^B\d+-RT/.test(sku)) {
    const w = widthOf(sku), n = nearestStd(w);
    r = _baseFind('B' + w + '-RT') || _baseFind('B' + n) || _baseFind('B' + n + '-1DR') || _baseFind('SB' + n + '-RT') || _baseFind('B3D' + n);
    if (r) return r;
  }
  if (/^SCRIBE/i.test(sku) || /^3SRM/.test(sku)) { r = _baseFind('3SRM3F') || searchSkus('3SRM')[0]; if (r) return r; }
  if (/^BWDMA\d/.test(sku)) { r = nearestInFamily('BWDMA', widthOf(sku)); if (r) return r; }
  if (/^FLVSB\d/.test(sku)) { r = nearestInFamily('FLVSB', widthOf(sku)); if (r) return r; }
  if (/^BCF/.test(sku)) { r = _baseFind('BCF') || nearestInFamily('BCF', widthOf(sku)); if (r) return r; }
  if (/^BWC/.test(sku)) { r = nearestInFamily('BWC', widthOf(sku)) || _baseFind('BWC30'); if (r) return r; }
  if (/^WGD/.test(sku)) { r = nearestInFamily('WGD', widthOf(sku)); if (r) return r; }
  if (/^FIO/.test(sku)) { const w = widthOf(sku); r = _baseFind('FIO' + w + '-27') || _baseFind('FIO' + w) || nearestInFamily('FIO', w); if (r) return r; }
  if (/^S?UT\d/.test(sku)) { r = nearestInFamily('UT', widthOf(sku)); if (r) return r; }
  if (/^PBC/.test(sku)) { const w = widthOf(sku); r = nearestInFamily('PBC334 1/2-', w) || nearestInFamily('PBC', w); if (r) return r; }
  if (/^BD\d/.test(sku)) { const w = widthOf(sku); r = _baseFind('B3D' + w) || nearestInFamily('B3D', w) || nearestInFamily('DRBDO', w); if (r) return r; }
  // Island work/base sink (2020 plan label IWS30 / IBS36) → sink base at width.
  if (/^I[WB]S\d/.test(sku)) { const w = widthOf(sku); r = _baseFind('SB' + w) || nearestInFamily('SB', w); if (r) return r; }
  // Trim / panels / brackets / shelves with no exact catalog entry → a low-cost profile filler.
  if (/^(FDP|GRILLE|DWP|DW-?TK|DEP|LBRK)/i.test(sku) || /EDGE BANDED SHELF|SHELF/i.test(sku)) {
    r = searchSkus('PROFILE FILLER')[0] || searchSkus('FILLER')[0]; if (r) return r;
  }

  // Generic family resolver: nearest width within the leading alpha prefix.
  const ap = sku.match(/^[A-Za-z]+/)?.[0];
  if (ap) { const nf = nearestInFamily(ap, widthOf(sku)); if (nf) return nf; }

  const fuzzy = searchSkus(sku.substring(0, Math.min(sku.length, 5))); if (fuzzy.length) return fuzzy[0];
  // Universal catch so the quote never prints "SKU not found": a low-cost profile filler.
  r = searchSkus('PROFILE FILLER')[0] || searchSkus('FILLER')[0] || searchSkus('FILL')[0]; if (r) return r;
  return null;
}


