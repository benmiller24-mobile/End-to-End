import React, { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Eclipse Kitchen Designer — React Frontend v3
 * ==============================================
 * Full configurator: template picker → materials → appliances → countertops → solve + price
 *
 * Features:
 * 1. Template picker — 22 layouts (10 kitchen + 10 bathroom + 2 utility) with dimension adjusters
 * 2. Material configuration — door style, finish, wood species, Regular vs Gola
 * 3. Appliance selector — Sub-Zero/Wolf, Thermador, Fisher & Paykel, Miele, KitchenAid
 * 4. Countertop selector — Neolith, Dekton, Caesarstone, Cambria, Natural Quartzite
 * 5. Training score + comparison pricing + full quote
 */

// ── Direct solver/pricing imports ──
import { solve, scoreAgainstTraining } from '../../eclipse-engine/src/solver.js';
import { recommendAppliances } from '../../eclipse-engine/src/appliance-recommender.js';
import {
  findSku, searchSkus, calculateLayoutPrice, formatCurrency,
  SPECIES_PCT, CONSTRUCTION_PCT, DOORS, DRAWER_FRONTS, DRAWER_BOXES, FINISH_COLORS,
  GLAZES, HIGHLIGHTS, CHAR_TECHNIQUES, INTERIORS,
  guessDoors, guessDrawerCount, guessBuiltInROT,
  FABRICATION_PREFIXES, priceFabricationItems, calculateDealerPrice,
  findOfficial, checkStyleCompat, applicableMods, findMod,
} from '../../eclipse-pricing/src/index.js';
import { buildOrderItems, generateOrderPackage } from './orderPackage.js';
import DesignStudio from './DesignStudio.jsx';
import { buildManualResult, seedFromSolverResult } from './manualDesign.js';
import { evaluateOrderReadiness } from './orderReadiness.js';
import { parseAcknowledgment, reconcile } from './ackReconcile.js';

// ── Template & data imports ──
import { TEMPLATES, getTemplate, listTemplates, getTemplateCategories } from '../../eclipse-engine/src/templates.js';
import {
  APPLIANCE_BRANDS, APPLIANCES, APPLIANCE_TYPES, SINKS,
  filterAppliances, getApplianceById, getBrandName, getWidthOptions,
} from '../../eclipse-engine/src/applianceData.js';
import {
  COUNTERTOP_BRANDS, COUNTERTOP_PRICING, COUNTERTOP_COLORS, COUNTERTOP_ADDONS,
  EDGE_PROFILES, THICKNESS_OPTIONS, PRICE_TIER_LABELS,
  getColorsByBrand, getColorsByCollection, getColorById, getCollections,
  getColorPrice, estimateCountertopCost, getPopularColors,
} from '../../eclipse-engine/src/countertopData.js';

// ── Output view imports ──
import { BRANDS, CONSTRUCTIONS, CONSTRUCTIONS_BY_BRAND, DEFAULT_CONSTRUCTION_BY_BRAND, getConstruction } from './constructionProfiles.js';
import { findShilohSku, SHILOH_SKU_COUNT } from '../../eclipse-pricing/src/shilohSkuCatalog.js';
import { listProjects, loadProject, saveProject, deleteProject, newProjectId, addRevision, getRevisions } from './lib/projectStore.js';
import FloorPlanView from './FloorPlanView.jsx';
import ElevationView from './ElevationView.jsx';
import ApplianceRecommendationPanel from './ApplianceRecommendationPanel.jsx';
import Kitchen3DView from './Kitchen3DView.jsx';
import LeonardoRenderer from './LeonardoRenderer.jsx';
import { exportPDF } from './pdfExport.js';

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

let _pricingBrand = 'eclipse';
export function setPricingBrand(b) { _pricingBrand = b === 'shiloh' ? 'shiloh' : 'eclipse'; }
function _baseFind(sku) { return _pricingBrand === 'shiloh' ? findShilohSku(sku) : findSku(sku); }

// Strict-resolution wrapper (T4): every lookup is tagged with HOW it resolved —
//   exact        → the catalog has this SKU verbatim (order-grade)
//   normalized   → resolved via hinge-strip/width/family rules (review)
//   substituted  → the universal filler catch-all fired for a non-filler SKU
//                  (NOT order-grade; silent substitution kills dealer trust)
// `_fallback` (Shiloh→Eclipse) propagates from the brand catalog separately.
export function findSkuNormalized(sku, _depth = 0) {
  const exact = _baseFind(sku);
  if (exact) return { ...exact, _resolution: 'exact' };
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
  if (/^W\d/.test(sku)) { const m = sku.match(/^W(\d+(?:\.\d+)?)(\d{2,3})$/); if (m) { const w = m[1].replace('.5', ''); r = _baseFind('W' + w + m[2]); if (r) return r; r = _baseFind('W' + w + '36'); if (r) return r; } }
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

function buildPricingPlacements(placements, lineMods = {}) {
  // Split placements into two priced streams:
  //  - cabinets → C3 catalog pricing (calculateLayoutPrice)
  //  - fabrication/trim/panels (toe kick, crown, light rail, scribe, appliance
  //    panels, hoods, touch-up) → priceFabricationItems, so nothing the design
  //    shows is silently zero-priced.
  // Appliances WITHOUT a sku (range, fridge, DW) are excluded from both.
  // Appliances WITH a sku (sink base = SB36-FHD) ARE real cabinets.
  const withSku = placements.filter(p => p.sku);
  const fabrication = withSku.filter(p => FABRICATION_PREFIXES.some(pfx => p.sku.startsWith(pfx)));
  const cabinets = withSku
    .filter(p => !FABRICATION_PREFIXES.some(pfx => p.sku.startsWith(pfx)))
    .map(p => {
      const ce = findSku(p.sku);
      const tc = ce?.t || (p.sku.match(/^W/) ? 'W' : p.sku.match(/^[UOT]/) ? 'T' : 'B');
      // Sq-in-priced items (REF/BCF panels, finished ply) need real dimensions:
      // catalog price is $/sq-in (e.g. BCF $1.00/sq-in → 24×30.5 = $732).
      const h = p._elev?.height || p.height;
      // Official v8.8 carries the manufacturer's own door/drawer counts per
      // SKU — use them when present so door/drawer-front/box charges use the
      // factory's numbers; the guess heuristics remain the fallback.
      const off = findOfficial(p.sku);
      return { sku: p.sku, qty: p.qty || 1, wall: p.wall || 'other',
        sqin: (p.width && h) ? p.width * h : undefined,
        doorCount: off ? off.dc : guessDoors(p.sku, tc),
        drawerCount: off ? off.drc : guessDrawerCount(p.sku, tc),
        builtInROT: guessBuiltInROT(p.sku) };
    });
  // Stable per-line keys (wall::sku::occurrence) carry user-selected
  // modifications into pricing; stale keys from a prior solve are ignored.
  const occ = {};
  for (const c of cabinets) {
    const base = `${c.wall}::${c.sku}`;
    occ[base] = (occ[base] || 0) + 1;
    c.lineKey = `${base}::${occ[base]}`;
    const codes = lineMods[c.lineKey] || [];
    if (codes.length) c.mods = codes.map(code => findMod(code)).filter(Boolean);
  }
  return { cabinets, fabrication };
}

// Map a construction profile (constructionProfiles.js) to the pricing engine's
// profile config. Eclipse frameless yields all zeros — pricing unchanged.
function pricingProfileOf(frameStyle) {
  const c = getConstruction(frameStyle);
  return {
    overlayDoorChg: c.overlayCharge?.door || 0,
    overlayDrawerChg: c.overlayCharge?.drawer || 0,
    insetPremiumPct: c.insetPremiumPct || 0,
  };
}

// ==================== THEME ====================
const C = {
  // Pinnacle Sales palette: white + warm cream, near-black text, signature gold accent.
  bg: '#ffffff', surface: '#faf8f5', surface2: '#f1ece4', border: '#e4ddd2',
  primary: '#1a1a1a', primaryHover: '#000000', accent: '#b8944e', danger: '#c0392b', warn: '#b8860b',
  text: '#1a1a1a', muted: '#555555', dim: '#8a8a8a', purple: '#7a6f9b', gold: '#c8a96e',
};

const inputStyle = { width: '100%', padding: '7px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, color: C.text, fontSize: 13, boxSizing: 'border-box' };
const labelStyle = { display: 'block', fontSize: 12, color: C.dim, marginBottom: 4 };
const panelStyle = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16 };
const sectionTitle = { fontWeight: 600, fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 };
const btnPrimary = { background: C.primary, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnOutline = { background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '8px 18px', fontSize: 13, cursor: 'pointer' };

// ==================== CONSTANTS ====================
const LAYOUT_TYPES = ['l-shape', 'u-shape', 'galley', 'single-wall', 'peninsula'];
const ROOM_TYPES = ['kitchen', 'vanity', 'master_bath', 'office', 'laundry', 'utility'];
const APPLIANCE_TYPES_LIST = ['range', 'cooktop', 'sink', 'dishwasher', 'refrigerator', 'microwave', 'wallOven', 'hood'];
const SOPH_LEVELS = ['standard', 'high', 'very_high'];
const CORNER_TREATMENTS = ['auto', 'lazySusan', 'blind', 'diagonalSink'];

const speciesNames = Object.keys(SPECIES_PCT);
const doorOptions = DOORS.map(d => ({ value: d.v, label: d.l || d.v, group: d.g }));
const constructionOptions = ['Standard', 'Plywood'];

const COMPARE_COMBOS = [
  { name: 'TFL Budget', species: 'TFL', construction: 'Standard', door: 'HNVR' },
  { name: 'Maple Stock', species: 'Maple', construction: 'Standard', door: 'MET-V' },
  { name: 'Walnut Premium', species: 'Walnut', construction: 'Plywood', door: 'MET-V' },
  { name: 'White Oak Ultra', species: 'White Oak', construction: 'Plywood', door: 'ESSX' },
];

// Category display config
const CATEGORY_META = {
  'galley':      { label: 'Galley Kitchen',   icon: '||', group: 'kitchen' },
  'l-shape':     { label: 'L-Shape Kitchen',  icon: 'L',  group: 'kitchen' },
  'u-shape':     { label: 'U-Shape Kitchen',  icon: 'U',  group: 'kitchen' },
  'single-wall': { label: 'Single Wall',      icon: '|',  group: 'kitchen' },
  'peninsula':   { label: 'Peninsula',        icon: 'T',  group: 'kitchen' },
  'island':      { label: 'Island Kitchen',   icon: '+',  group: 'kitchen' },
  'powder_room': { label: 'Powder Room',      icon: 'P',  group: 'bathroom' },
  'master_bath': { label: 'Master Bath',      icon: 'M',  group: 'bathroom' },
  'guest_bath':  { label: 'Guest Bath',       icon: 'G',  group: 'bathroom' },
  'utility':     { label: 'Utility',          icon: 'U',  group: 'utility' },
};

// ==================== TEMPLATE PICKER ====================
function TemplatePicker({ onSelect, selected }) {
  const [activeGroup, setActiveGroup] = useState('kitchen');
  const categories = getTemplateCategories();

  const grouped = { kitchen: [], bathroom: [], utility: [] };
  categories.forEach(cat => {
    const g = CATEGORY_META[cat]?.group || 'utility';
    grouped[g].push(cat);
  });

  const activeCategories = grouped[activeGroup] || [];

  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>Choose a Layout Template</div>

      {/* Group tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
        {[
          { id: 'kitchen', label: 'Kitchen Layouts' },
          { id: 'bathroom', label: 'Bathroom Layouts' },
          { id: 'utility', label: 'Utility' },
        ].map(g => (
          <button key={g.id} onClick={() => setActiveGroup(g.id)}
            style={{ padding: '5px 12px', borderRadius: 5, fontSize: 12, cursor: 'pointer', border: 'none',
              background: activeGroup === g.id ? C.primary : C.bg, color: activeGroup === g.id ? '#fff' : C.muted, fontWeight: activeGroup === g.id ? 600 : 400 }}>
            {g.label}
          </button>
        ))}
      </div>

      {/* Templates in active group */}
      {activeCategories.map(cat => {
        const templates = listTemplates(cat);
        const meta = CATEGORY_META[cat] || { label: cat, icon: '?' };
        return (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>{meta.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
              {templates.map(t => (
                <button key={t.id} onClick={() => onSelect(t.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                    background: selected === t.id ? '#f6efe2' : C.bg,
                    border: `1px solid ${selected === t.id ? C.primary : C.border}`,
                    color: C.text, transition: 'all 0.15s',
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: C.dim, lineHeight: 1.3 }}>{t.description}</div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {selected && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.accent }}>
          Selected: {TEMPLATES.find(t => t.id === selected)?.name || selected}
        </div>
      )}
    </div>
  );
}

// ==================== DIMENSION ADJUSTER ====================
function DimensionAdjuster({ walls, onChange, island, onIslandChange, peninsula, onPeninsulaChange }) {
  const updateWall = (i, field, val) => {
    const w = [...walls];
    w[i] = { ...w[i], [field]: field === 'length' ? Number(val) : val };
    onChange(w);
  };

  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>Adjust Dimensions</div>
      {walls.map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: C.muted, minWidth: 50 }}>Wall {w.id}</span>
          <input type="range" min={30} max={240} value={w.length} onChange={e => updateWall(i, 'length', e.target.value)}
            style={{ flex: 1, accentColor: C.primary }} />
          <input type="number" value={w.length} onChange={e => updateWall(i, 'length', e.target.value)}
            style={{ ...inputStyle, width: 60, textAlign: 'center' }} />
          <span style={{ fontSize: 11, color: C.dim }}>in</span>
        </div>
      ))}

      {island && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Island</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Length</label>
              <input type="number" value={island.length} onChange={e => onIslandChange({ ...island, length: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Depth</label>
              <input type="number" value={island.depth} onChange={e => onIslandChange({ ...island, depth: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {peninsula && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>Peninsula</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Length</label>
              <input type="number" value={peninsula.length} onChange={e => onPeninsulaChange({ ...peninsula, length: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Depth</label>
              <input type="number" value={peninsula.depth} onChange={e => onPeninsulaChange({ ...peninsula, depth: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== WALL EDITOR ====================
// Per wall: length + role, optional per-wall ceiling override, soffit
// (drop/depth), and the openings list (windows, doors, archways) — the
// real-room inputs the solver and drawings consume.
function WallEditor({ walls, onChange }) {
  const add = () => onChange([...walls, { id: String.fromCharCode(65 + walls.length), length: 120, role: 'general' }]);
  const update = (i, field, val) => { const w = [...walls]; w[i] = { ...w[i], [field]: val }; onChange(w); };
  const remove = (i) => onChange(walls.filter((_, j) => j !== i));

  const updateOpening = (wi, oi, field, val) => {
    const w = [...walls];
    const ops = [...(w[wi].openings || [])];
    ops[oi] = { ...ops[oi], [field]: field === 'type' ? val : Math.max(0, Number(val) || 0) };
    w[wi] = { ...w[wi], openings: ops };
    onChange(w);
  };
  const addOpening = (wi, type) => {
    const w = [...walls];
    const defaults = type === 'window'
      ? { type, position: Math.max(0, (w[wi].length - 36) / 2), width: 36, sillHeight: 42, headHeight: 80 }
      : { type, position: Math.max(0, w[wi].length - 36), width: 36, headHeight: 80 };
    w[wi] = { ...w[wi], openings: [...(w[wi].openings || []), defaults] };
    onChange(w);
  };
  const removeOpening = (wi, oi) => {
    const w = [...walls];
    w[wi] = { ...w[wi], openings: (w[wi].openings || []).filter((_, j) => j !== oi) };
    onChange(w);
  };
  const setSoffit = (wi, field, val) => {
    const w = [...walls];
    const s = { ...(w[wi].soffit || { drop: 0, depth: 13 }), [field]: Math.max(0, Number(val) || 0) };
    w[wi] = { ...w[wi], soffit: s.drop > 0 ? s : null };
    onChange(w);
  };

  const miniInput = { ...inputStyle, padding: '4px 6px', fontSize: 12 };
  const miniLabel = { fontSize: 9, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={sectionTitle}>Walls</div>
        <button onClick={add} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add</button>
      </div>
      {walls.map((w, i) => (
        <div key={i} style={{ marginBottom: 12, paddingBottom: 10, borderBottom: i < walls.length - 1 ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '32px 70px 92px 64px 24px', gap: 6, alignItems: 'end' }}>
            <div><div style={miniLabel}>Wall</div><input value={w.id} readOnly style={{ ...miniInput, textAlign: 'center', color: C.dim }} /></div>
            <div><div style={miniLabel}>Length"</div><input type="number" value={w.length} onChange={e => update(i, 'length', Number(e.target.value))} style={miniInput} /></div>
            <div><div style={miniLabel}>Role</div>
              <select value={w.role || 'general'} onChange={e => update(i, 'role', e.target.value)} style={miniInput}>
                {['general', 'range', 'sink', 'fridge', 'tall', 'pantry', 'vanity'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div><div style={miniLabel}>Ceiling"</div>
              <input type="number" value={w.ceilingHeight || ''} placeholder="(global)"
                onChange={e => update(i, 'ceilingHeight', e.target.value === '' ? undefined : Number(e.target.value))} style={miniInput} />
            </div>
            <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 16 }}>x</button>
          </div>

          {/* Site-measure grade (T1): customer-supplied vs field-verified */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <button onClick={() => update(i, 'fieldVerified', !w.fieldVerified)}
              title={w.fieldVerified ? 'Field-verified: a professional measure was taken on site.' : 'Customer-supplied: budget grade until a professional field measure is recorded.'}
              style={{ padding: '3px 9px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${w.fieldVerified ? '#1c7c45' : C.warn}`,
                background: w.fieldVerified ? '#e7f5ec' : '#fdf3e0',
                color: w.fieldVerified ? '#1c7c45' : C.warn }}>
              {w.fieldVerified ? '✓ FIELD-VERIFIED' : 'CUSTOMER-SUPPLIED'}
            </button>
            {w.fieldVerified && (
              <>
                <span style={{ ...miniLabel, marginBottom: 0 }}>Ceiling @ 3 pts"</span>
                {[0, 1, 2].map(ri => (
                  <input key={ri} type="number" value={(w.ceilingReadings || [])[ri] || ''} placeholder={ri === 0 ? 'left' : ri === 1 ? 'mid' : 'right'}
                    onChange={e => {
                      const r = [...(w.ceilingReadings || [])]; r[ri] = e.target.value === '' ? undefined : Number(e.target.value);
                      const valid = r.filter(v => v > 0);
                      const ww = [...walls];
                      ww[i] = { ...ww[i], ceilingReadings: r, ...(valid.length ? { ceilingHeight: Math.min(...valid) } : {}) };
                      onChange(ww);
                    }} style={{ ...miniInput, width: 52 }} />
                ))}
                <select value={w.cornerSquare || 'unknown'} onChange={e => update(i, 'cornerSquare', e.target.value)}
                  title="3-4-5 / diagonal check at this wall's corners" style={{ ...miniInput, width: 124 }}>
                  <option value="unknown">square: unchecked</option>
                  <option value="square">square ✓</option>
                  <option value="out">OUT of square</option>
                </select>
              </>
            )}
            {w.fieldVerified && (w.ceilingReadings || []).filter(v => v > 0).length >= 2 && (() => {
              const v = w.ceilingReadings.filter(x => x > 0);
              const spread = Math.max(...v) - Math.min(...v);
              return spread > 0.5 ? <span style={{ fontSize: 10, color: C.danger }}>⚠ ceiling varies {spread.toFixed(2)}" — lowest ({Math.min(...v)}") governs</span> : null;
            })()}
          </div>

          {/* Soffit */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'end', marginTop: 6 }}>
            <div><div style={miniLabel}>Soffit drop"</div>
              <input type="number" min="0" value={w.soffit?.drop || ''} placeholder="0 = none"
                onChange={e => setSoffit(i, 'drop', e.target.value)} style={{ ...miniInput, width: 76 }} />
            </div>
            {w.soffit?.drop > 0 && (
              <div><div style={miniLabel}>Soffit depth"</div>
                <input type="number" min="0" value={w.soffit?.depth || 13}
                  onChange={e => setSoffit(i, 'depth', e.target.value)} style={{ ...miniInput, width: 76 }} />
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button onClick={() => addOpening(i, 'window')} style={{ ...btnOutline, padding: '3px 8px', fontSize: 10 }}>+ Window</button>
              <button onClick={() => addOpening(i, 'door')} style={{ ...btnOutline, padding: '3px 8px', fontSize: 10 }}>+ Door</button>
            </div>
          </div>

          {/* Openings */}
          {(w.openings || []).map((op, oi) => (
            <div key={oi} style={{ display: 'grid', gridTemplateColumns: '78px 64px 56px 56px 56px 20px', gap: 5, marginTop: 5, alignItems: 'end', background: C.bg, borderRadius: 4, padding: '4px 6px' }}>
              <div><div style={miniLabel}>Type</div>
                <select value={op.type} onChange={e => updateOpening(i, oi, 'type', e.target.value)} style={miniInput}>
                  {['window', 'door', 'archway'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><div style={miniLabel}>From left"</div>
                <input type="number" value={op.position ?? op.posFromLeft ?? 0} onChange={e => updateOpening(i, oi, 'position', e.target.value)} style={miniInput} /></div>
              <div><div style={miniLabel}>Width"</div>
                <input type="number" value={op.width} onChange={e => updateOpening(i, oi, 'width', e.target.value)} style={miniInput} /></div>
              {op.type === 'window' ? (
                <div><div style={miniLabel}>Sill"</div>
                  <input type="number" value={op.sillHeight ?? 42} onChange={e => updateOpening(i, oi, 'sillHeight', e.target.value)} style={miniInput} /></div>
              ) : <div />}
              <div><div style={miniLabel}>Head"</div>
                <input type="number" value={op.headHeight ?? 80} onChange={e => updateOpening(i, oi, 'headHeight', e.target.value)} style={miniInput} /></div>
              <button onClick={() => removeOpening(i, oi)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          ))}
          {(w.openings || []).some(op => (op.position ?? op.posFromLeft ?? 0) + (op.width || 0) > w.length) && (
            <div style={{ marginTop: 4, fontSize: 10, color: C.danger }}>⚠ An opening extends past the end of this wall.</div>
          )}
        </div>
      ))}
      <p style={{ fontSize: 10, color: C.dim, margin: '4px 0 0' }}>
        Windows block uppers (sink centers under them); doors/archways block the full run. Soffit lowers the uppers on that wall.
      </p>
    </div>
  );
}

// ==================== APPLIANCE EDITOR (ORIGINAL) ====================
function ApplianceEditor({ appliances, walls, onChange }) {
  const add = () => onChange([...appliances, { type: 'range', width: 30, wall: walls[0]?.id || 'A' }]);
  const update = (i, field, val) => { const a = [...appliances]; a[i] = { ...a[i], [field]: field === 'width' ? Number(val) : val }; onChange(a); };
  const remove = (i) => onChange(appliances.filter((_, j) => j !== i));

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={sectionTitle}>Appliances (Solver)</div>
        <button onClick={add} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add</button>
      </div>
      {appliances.map((a, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 56px 30px 24px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <select value={a.type} onChange={e => update(i, 'type', e.target.value)} style={inputStyle}>
            {APPLIANCE_TYPES_LIST.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" value={a.width} onChange={e => update(i, 'width', e.target.value)} style={inputStyle} />
          <select value={a.wall} onChange={e => update(i, 'wall', e.target.value)} style={inputStyle}>
            {walls.map(w => <option key={w.id} value={w.id}>{w.id}</option>)}
            <option value="island">island</option>
          </select>
          <button onClick={() => update(i, 'pinned', !a.pinned)}
            title={a.pinned
              ? 'Pinned — the solver will keep this appliance on this wall (plumbing/gas rough-in is fixed). Click to unpin.'
              : 'Unpinned — the solver may relocate it for work-triangle reasons. Click to pin it to this wall.'}
            style={{ background: a.pinned ? '#c8a96e22' : 'transparent', border: `1px solid ${a.pinned ? C.accent : C.border}`,
              borderRadius: 4, padding: '5px 0', fontSize: 12, cursor: 'pointer', color: a.pinned ? C.accent : C.dim }}>
            {a.pinned ? '📌' : '📍'}
          </button>
          <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>
      ))}
      <p style={{ fontSize: 10, color: C.dim, margin: '4px 0 0' }}>📌 = pinned to its wall (plumbing/gas fixed) — the solver will never move it.</p>
    </div>
  );
}

// ==================== APPLIANCE BRAND PICKER ====================
function ApplianceBrandPicker({ selectedAppliances, onChange }) {
  const [activeBrand, setActiveBrand] = useState('subzero');
  const [activeType, setActiveType] = useState('');

  const brandIds = APPLIANCE_BRANDS.map(b => b.id);
  const brandAppliances = APPLIANCES.filter(a => a.brand === activeBrand && (!activeType || a.type === activeType));
  const typesForBrand = [...new Set(APPLIANCES.filter(a => a.brand === activeBrand).map(a => a.type))];

  const toggleAppliance = (appId) => {
    const exists = selectedAppliances.find(a => a.id === appId);
    if (exists) {
      onChange(selectedAppliances.filter(a => a.id !== appId));
    } else {
      const app = getApplianceById(appId);
      if (app) onChange([...selectedAppliances, { ...app, finish: app.panelReady ? 'panel' : 'ss' }]);
    }
  };

  const updateFinish = (appId, finish) => {
    onChange(selectedAppliances.map(a => a.id === appId ? { ...a, finish } : a));
  };

  const totalMSRP = selectedAppliances.reduce((s, a) => s + (a.msrp || 0), 0);

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={sectionTitle}>Appliance Selection</div>
        {totalMSRP > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: C.accent }}>Est. MSRP: {formatCurrency(totalMSRP)}</span>}
      </div>

      {/* Brand tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {brandIds.map(b => (
          <button key={b} onClick={() => { setActiveBrand(b); setActiveType(''); }}
            style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: 'none',
              background: activeBrand === b ? C.primary : C.bg, color: activeBrand === b ? '#fff' : C.muted, fontWeight: activeBrand === b ? 600 : 400 }}>
            {getBrandName(b)}
          </button>
        ))}
      </div>

      {/* Type filter */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setActiveType('')}
          style={{ padding: '3px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer', border: `1px solid ${C.border}`,
            background: !activeType ? C.surface2 : 'transparent', color: !activeType ? C.text : C.dim }}>
          All
        </button>
        {typesForBrand.map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            style={{ padding: '3px 8px', borderRadius: 3, fontSize: 10, cursor: 'pointer', border: `1px solid ${C.border}`,
              background: activeType === t ? C.surface2 : 'transparent', color: activeType === t ? C.text : C.dim }}>
            {t}
          </button>
        ))}
      </div>

      {/* Appliance grid */}
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {brandAppliances.map(app => {
          const isSelected = selectedAppliances.some(a => a.id === app.id);
          const sel = selectedAppliances.find(a => a.id === app.id);
          return (
            <div key={app.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px',
              marginBottom: 4, borderRadius: 6, cursor: 'pointer',
              background: isSelected ? '#f6efe2' : C.bg, border: `1px solid ${isSelected ? C.primary : C.border}`,
            }} onClick={() => toggleAppliance(app.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? C.text : C.muted }}>{app.model}</div>
                <div style={{ fontSize: 10, color: C.dim }}>{app.type} {app.subtype ? `(${app.subtype})` : ''} — {app.width}"W x {app.height}"H x {app.depth}"D</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 80 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: isSelected ? C.accent : C.dim }}>{formatCurrency(app.msrp)}</div>
                {isSelected && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4 }} onClick={e => e.stopPropagation()}>
                    {app.panelReady && (
                      <button onClick={() => updateFinish(app.id, 'panel')}
                        style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, border: 'none', cursor: 'pointer',
                          background: sel?.finish === 'panel' ? C.purple : C.bg, color: sel?.finish === 'panel' ? '#fff' : C.dim }}>
                        Panel Ready
                      </button>
                    )}
                    {app.ss && (
                      <button onClick={() => updateFinish(app.id, 'ss')}
                        style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, border: 'none', cursor: 'pointer',
                          background: sel?.finish === 'ss' ? C.accent : C.bg, color: sel?.finish === 'ss' ? '#fff' : C.dim }}>
                        Stainless
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected summary */}
      {selectedAppliances.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>Selected ({selectedAppliances.length}):</div>
          {selectedAppliances.map(a => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '3px 0' }}>
              <span style={{ color: C.text }}>{a.model} <span style={{ color: C.dim }}>({a.finish === 'panel' ? 'Panel' : 'SS'})</span></span>
              <span style={{ color: C.accent }}>{formatCurrency(a.msrp)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 13, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
            <span>Total Appliances MSRP</span>
            <span style={{ color: C.accent }}>{formatCurrency(totalMSRP)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== COUNTERTOP PICKER ====================
function CountertopPicker({ selection, onChange }) {
  const [activeBrand, setActiveBrand] = useState('caesarstone');
  const brandIds = Object.keys(COUNTERTOP_BRANDS);
  const colors = getColorsByBrand(activeBrand);
  const collections = getCollections(activeBrand);

  const pricing = COUNTERTOP_PRICING[activeBrand];
  const sqft = selection.sqft || 40;
  const estimate = selection.colorId ? estimateCountertopCost(selection.colorId, sqft, selection.edge || 'straight', selection.cutouts || 1) : null;

  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>Countertop Selection</div>

      {/* Brand tabs */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 10, flexWrap: 'wrap' }}>
        {brandIds.map(b => (
          <button key={b} onClick={() => setActiveBrand(b)}
            style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: 'none',
              background: activeBrand === b ? C.primary : C.bg, color: activeBrand === b ? '#fff' : C.muted, fontWeight: activeBrand === b ? 600 : 400 }}>
            {COUNTERTOP_BRANDS[b]}
          </button>
        ))}
      </div>

      {/* Brand info */}
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 10 }}>
        {pricing.material} — ${pricing.low}-${pricing.high}/sqft installed
      </div>

      {/* Color swatches by collection */}
      {collections.map(col => {
        const colColors = getColorsByCollection(activeBrand, col);
        return (
          <div key={col} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 4 }}>{col}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {colColors.map(c => {
                const isSelected = selection.colorId === c.id;
                return (
                  <button key={c.id} onClick={() => onChange({ ...selection, colorId: c.id, brand: activeBrand })}
                    title={`${c.name} — ${c.finishes.join(', ')}`}
                    style={{
                      width: 52, padding: '4px 2px', borderRadius: 6, cursor: 'pointer', textAlign: 'center',
                      background: isSelected ? '#f6efe2' : C.bg, border: `2px solid ${isSelected ? C.primary : C.border}`,
                    }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 4, margin: '0 auto 4px', border: `1px solid ${C.border}`,
                      background: c.hex,
                    }} />
                    <div style={{ fontSize: 9, color: isSelected ? C.text : C.dim, lineHeight: 1.2, wordBreak: 'break-word' }}>{c.name}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Configuration */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label style={labelStyle}>Square Feet</label>
            <input type="number" value={sqft} onChange={e => onChange({ ...selection, sqft: Number(e.target.value) })} style={inputStyle} min={10} max={200} />
          </div>
          <div>
            <label style={labelStyle}>Edge Profile</label>
            <select value={selection.edge || 'straight'} onChange={e => onChange({ ...selection, edge: e.target.value })} style={inputStyle}>
              {EDGE_PROFILES.map(ep => <option key={ep.id} value={ep.id}>{ep.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cutouts</label>
            <input type="number" value={selection.cutouts || 1} onChange={e => onChange({ ...selection, cutouts: Number(e.target.value) })} style={inputStyle} min={0} max={10} />
          </div>
        </div>

        {/* Thickness */}
        {THICKNESS_OPTIONS[activeBrand] && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Thickness</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {THICKNESS_OPTIONS[activeBrand].map(th => (
                <button key={th} onClick={() => onChange({ ...selection, thickness: th })}
                  style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: `1px solid ${C.border}`,
                    background: (selection.thickness || THICKNESS_OPTIONS[activeBrand][THICKNESS_OPTIONS[activeBrand].length - 1]) === th ? C.surface2 : 'transparent',
                    color: (selection.thickness || THICKNESS_OPTIONS[activeBrand][THICKNESS_OPTIONS[activeBrand].length - 1]) === th ? C.text : C.dim }}>
                  {th}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Estimate */}
      {estimate && (
        <div style={{ marginTop: 10, padding: 12, background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Material ({sqft} sqft)</span>
            <span style={{ fontSize: 12, color: C.text }}>{formatCurrency(estimate.materialLow)} – {formatCurrency(estimate.materialHigh)}</span>
          </div>
          {estimate.edgeCost > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: C.muted }}>Edge profile</span>
              <span style={{ fontSize: 12, color: C.text }}>{formatCurrency(estimate.edgeCost)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: C.muted }}>Cutouts ({selection.cutouts || 1})</span>
            <span style={{ fontSize: 12, color: C.text }}>{formatCurrency(estimate.cutoutCost)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: `1px solid ${C.border}`, fontWeight: 700, fontSize: 14 }}>
            <span>Estimated Total</span>
            <span style={{ color: C.accent }}>{formatCurrency(estimate.totalLow)} – {formatCurrency(estimate.totalHigh)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== TRIM / MOLDING PICKER ====================
function TrimPicker({ selections, onChange }) {
  const toggleField = (field) => onChange({ ...selections, [field]: !selections[field] });
  const setField = (field, val) => onChange({ ...selections, [field]: val });

  const trimItems = [
    { key: 'toeKick', label: 'Toe Kick', sku: 'TK-N/C', price: 'Included', desc: 'Standard recessed toe kick at cabinet base' },
    { key: 'crown', label: 'Crown Molding', sku: selections.crownProfile === 'furniture' ? "3FCR -10'" : "3 1/2CRN -10'",
      price: selections.crownProfile === 'furniture' ? '$348/10ft' : '$96/10ft', desc: 'Decorative molding at top of upper cabinets' },
    { key: 'lightRail', label: 'Light Rail / Under Cabinet', sku: '1 3/4 UCA', price: '$48-96/8ft', desc: 'Trim strip under upper cabinets for under-cabinet lighting' },
    { key: 'traditionalTrim', label: 'Traditional Trim', sku: "7/8TD -8'", price: 'Included', desc: 'Decorative rail between uppers and base cabinets' },
    { key: 'countertopEdge', label: 'Countertop Edge Profile', sku: '—', price: '—', desc: 'Visual countertop overhang rendering in elevations' },
  ];

  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>Trim & Molding</div>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 12 }}>
        Select which trim accessories to include. These appear in elevations and BOM.
      </div>

      {trimItems.map(item => (
        <div key={item.key} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 10px', marginBottom: 4, borderRadius: 6,
          background: selections[item.key] ? '#c8a96e22' : C.bg,
          border: `1px solid ${selections[item.key] ? C.primary : C.border}`,
          cursor: 'pointer',
        }} onClick={() => toggleField(item.key)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 4,
              border: `2px solid ${selections[item.key] ? C.primary : C.border}`,
              background: selections[item.key] ? C.primary : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: '#fff', fontWeight: 700,
            }}>{selections[item.key] ? '\u2713' : ''}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.label}</div>
              <div style={{ fontSize: 10, color: C.dim }}>{item.desc}</div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.muted, fontFamily: 'monospace' }}>{item.sku}</div>
            <div style={{ fontSize: 11, color: C.accent }}>{item.price}</div>
          </div>
        </div>
      ))}

      {/* Ceiling fit selector — how the uppers meet the ceiling */}
      <div style={{ marginTop: 8, padding: '8px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
        <label style={{ ...labelStyle, marginBottom: 6 }}>Ceiling Fit — how uppers meet the ceiling</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'crown', label: 'Crown', desc: 'Crown molding with a 1/4" reveal to the ceiling' },
            { v: 'fitted', label: 'Fitted to ceiling', desc: 'Flat riser/filler panel + scribe to the ceiling — no gap' },
            { v: 'open', label: 'Open above', desc: 'Unfitted: open reveal/storage space above the cabinets' },
          ].map(o => {
            const active = (selections.ceilingFit || 'crown') === o.v;
            return (
              <button key={o.v} onClick={() => setField('ceilingFit', o.v)} title={o.desc}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? C.primary : C.border}`,
                  background: active ? '#c8a96e22' : 'transparent', color: active ? C.text : C.muted }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          {(selections.ceilingFit || 'crown') === 'fitted'
            ? 'Cabinets fitted to the ceiling: a flat filler/riser panel bridges to the ceiling with a scribe to absorb out-of-level. Adds a riser-filler line to the quote.'
            : (selections.ceilingFit || 'crown') === 'open'
              ? 'Unfitted: the space above the cabinets is left open (display/seasonal storage). No crown, no panel.'
              : 'Crown molding sits on the cabinet tops and stops ~1/4" below the ceiling (it should never touch the ceiling).'}
        </div>
      </div>

      {/* Backsplash style — current high-end trend: full-height stone slab */}
      <div style={{ marginTop: 8, padding: '8px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
        <label style={{ ...labelStyle, marginBottom: 6 }}>Backsplash — counter-to-upper treatment</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'standard', label: 'Standard', desc: 'Short tile / 4" stone splash between counter and uppers' },
            { v: 'full_slab', label: 'Full-Height Slab', desc: 'Countertop stone runs full-height; feature slab behind the cooktop (current trend)' },
          ].map(o => {
            const active = (selections.backsplashStyle || 'standard') === o.v;
            return (
              <button key={o.v} onClick={() => setField('backsplashStyle', o.v)} title={o.desc}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? C.primary : C.border}`,
                  background: active ? '#c8a96e22' : 'transparent', color: active ? C.text : C.muted }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          {(selections.backsplashStyle || 'standard') === 'full_slab'
            ? 'The countertop material continues full-height as the backsplash, with a feature slab rising behind the cooktop — the dominant current look. Priced as added slab sq ft.'
            : 'A standard short backsplash band (tile or a 4" stone splash) between the counter and the wall cabinets.'}
        </div>
      </div>

      {/* Range-wall character — sculptural plaster hood + arched niche (warm-organic trend) */}
      <div style={{ marginTop: 8, padding: '8px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
        <label style={{ ...labelStyle, marginBottom: 6 }}>Range Wall — hood &amp; niche</label>
        <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>Hood style</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'steel', label: 'Steel / Insert', desc: 'Stainless chimney canopy or liner insert' },
            { v: 'plaster', label: 'Sculptural Plaster', desc: 'Soft matte-plaster canopy flaring over the cooktop (warm-organic / Mediterranean)' },
          ].map(o => {
            const active = (selections.hoodStyle || 'steel') === o.v;
            return (
              <button key={o.v} onClick={() => setField('hoodStyle', o.v)} title={o.desc}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? C.primary : C.border}`,
                  background: active ? '#c8a96e22' : 'transparent', color: active ? C.text : C.muted }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.dim, margin: '8px 0 4px' }}>Range niche</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { v: 'none', label: 'None', desc: 'Flat wall behind the range' },
            { v: 'arched', label: 'Arched Plaster', desc: 'Arched plaster alcove framing the range (Mediterranean look)' },
          ].map(o => {
            const active = (selections.rangeNiche || 'none') === o.v;
            return (
              <button key={o.v} onClick={() => setField('rangeNiche', o.v)} title={o.desc}
                style={{ flex: 1, padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  border: `1px solid ${active ? C.primary : C.border}`,
                  background: active ? '#c8a96e22' : 'transparent', color: active ? C.text : C.muted }}>
                {o.label}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
          {(selections.hoodStyle || 'steel') === 'plaster' || (selections.rangeNiche || 'none') === 'arched'
            ? 'Warm-organic range wall: a sculptural plaster hood and/or an arched plaster niche frame the cooktop — the Mediterranean look from the trend references.'
            : 'Standard stainless hood on a flat range wall. Switch to plaster / arched for the warm-organic look.'}
        </div>
      </div>

      {/* Crown profile sub-option */}
      {selections.crown && (selections.ceilingFit || 'crown') === 'crown' && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
          <label style={{ ...labelStyle, marginBottom: 6 }}>Crown Profile</label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { value: 'standard', label: '3 1/2" Crown Mould', price: '$96/10ft' },
              { value: 'furniture', label: '3" Furniture Crown', price: '$348/10ft' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setField('crownProfile', opt.value)}
                style={{
                  flex: 1, padding: '6px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                  border: selections.crownProfile === opt.value ? `2px solid ${C.primary}` : `1px solid ${C.border}`,
                  background: selections.crownProfile === opt.value ? '#c8a96e30' : C.bg,
                  color: selections.crownProfile === opt.value ? C.text : C.muted,
                }}>
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                <div style={{ color: C.accent, marginTop: 2 }}>{opt.price}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== TRAINING SCORE PANEL ====================
function TrainingScorePanel({ score }) {
  if (!score) return null;
  const topMatches = (score.matches || []).slice(0, 5);
  const gc = score.golaCompliance;

  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>Training Match</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Best: {score.bestMatch || 'N/A'}</span>
        <span style={{
          background: score.confidence >= 80 ? '#c8a96e22' : score.confidence >= 60 ? '#78350f20' : '#7f1d1d20',
          color: score.confidence >= 80 ? C.accent : score.confidence >= 60 ? C.warn : C.danger,
          border: `1px solid ${score.confidence >= 80 ? C.accent : score.confidence >= 60 ? C.warn : C.danger}`,
          padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600,
        }}>{score.confidence}%</span>
      </div>
      {topMatches.map((m, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < topMatches.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 13 }}>
          <span style={{ color: C.muted }}>{m.name || m.project}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 60, height: 5, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${m.score || m.confidence || 0}%`, height: '100%', background: (m.score || m.confidence || 0) >= 80 ? C.accent : C.warn, borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, minWidth: 30, textAlign: 'right' }}>{m.score || m.confidence || 0}%</span>
          </div>
        </div>
      ))}
      {gc && (
        <div style={{ marginTop: 12, padding: '8px 10px', background: gc.isGola ? '#7a6f9b22' : C.bg, borderRadius: 6, border: `1px solid ${gc.isGola ? C.purple : C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: gc.isGola ? '#c4b5fd' : C.muted, marginBottom: 4 }}>
            {gc.isGola ? 'Gola Compliance' : 'Standard (non-Gola)'}
          </div>
          {gc.isGola && (
            <div style={{ fontSize: 11, color: C.dim }}>
              FC- prefix: {gc.fcPrefix ? 'Y' : 'N'} | No uppers: {gc.noUppers ? 'Y' : 'N'} | B2TD: {gc.b2td ? 'Y' : 'N'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==================== COMPARISON PRICING ====================
function ComparisonPricingPanel({ placements, frameStyle }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runComparison = () => {
    setLoading(true);
    const { cabinets } = buildPricingPlacements(placements);
    const profile = pricingProfileOf(frameStyle);
    const comparisons = COMPARE_COMBOS.map(combo => {
      const q = calculateLayoutPrice(cabinets, {
        species: combo.species, construction: combo.construction,
        door: combo.door, drawerFront: 'DF-' + combo.door, drawerBox: '5/8-STD',
        profile,
      }, findSkuNormalized);
      return { ...combo, subtotal: q.subtotal, items: q.items.length, found: q.items.filter(i => !i.error).length };
    });
    setResults(comparisons);
    setLoading(false);
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={sectionTitle}>Compare Finishes</div>
        <button onClick={runComparison} disabled={loading || !placements?.length}
          style={{ background: C.purple, color: '#fff', border: 'none', borderRadius: 4, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: placements?.length ? 1 : 0.5 }}>
          {loading ? '...' : 'Compare 4 Options'}
        </button>
      </div>
      {results && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {results.map((r, i) => {
            const isMin = r.subtotal === Math.min(...results.map(x => x.subtotal));
            const isMax = r.subtotal === Math.max(...results.map(x => x.subtotal));
            return (
              <div key={i} style={{ background: C.bg, borderRadius: 6, padding: 12, border: `1px solid ${isMin ? C.accent : isMax ? C.warn : C.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 6 }}>{r.species} / {r.construction}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: isMin ? C.accent : isMax ? C.warn : C.text }}>{formatCurrency(r.subtotal)}</div>
                <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{r.found}/{r.items} SKUs</div>
              </div>
            );
          })}
        </div>
      )}
      {!results && <p style={{ fontSize: 12, color: C.dim, margin: 0 }}>Price the same layout across TFL, Maple, Walnut, and White Oak.</p>}
    </div>
  );
}

// ==================== LINE MODIFICATIONS (official v8.8 codes) ====================
// Per-cabinet modification picker: only the codes the official applicability
// matrix allows for that SKU. Charges are flat $ or % of the line's list base.
function LineModEditor({ item, lineMods, onChange }) {
  const avail = applicableMods(item.sku);
  const applied = lineMods[item.lineKey] || [];
  if (!avail.length && !applied.length) return null;
  const addable = avail.filter(m => !applied.includes(m.code));
  return (
    <tr style={{ background: '#faf8f3' }}>
      <td colSpan={8} style={{ padding: '4px 8px 6px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9.5, color: C.dim, textTransform: 'uppercase', letterSpacing: 0.5 }}>Mods</span>
          {applied.map(code => {
            const m = findMod(code);
            return (
              <span key={code} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, background: '#fff', border: `1px solid ${C.gold}`, borderRadius: 4, padding: '2px 7px' }}>
                <strong>{code}</strong>
                <span style={{ color: C.dim }}>{m ? (m.pct ? `+${Math.round(m.pct * 100)}%` : m.flat ? `+${formatCurrency(m.flat)}` : 'N/C') : ''}</span>
                <button onClick={() => onChange({ ...lineMods, [item.lineKey]: applied.filter(c => c !== code) })}
                  style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
              </span>
            );
          })}
          {addable.length > 0 && (
            <select value="" onChange={e => { if (e.target.value) onChange({ ...lineMods, [item.lineKey]: [...applied, e.target.value] }); }}
              style={{ ...inputStyle, width: 'auto', maxWidth: 360, padding: '3px 6px', fontSize: 11 }}>
              <option value="">+ add modification ({addable.length} available)…</option>
              {addable.map(m => (
                <option key={m.code} value={m.code}>
                  {m.code} — {m.desc} ({m.pct ? `+${Math.round(m.pct * 100)}%` : m.flat ? `+$${m.flat}` : 'N/C'})
                </option>
              ))}
            </select>
          )}
          {item.modChg > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginLeft: 'auto' }}>mods +{formatCurrency(item.modChg)}</span>}
        </div>
      </td>
    </tr>
  );
}

// ==================== ACK RECONCILIATION (T3b) ====================
// The dealer has 24 hours to review the W.W. Wood confirmation. Paste its
// text (open the PDF → select all → copy) and diff it against this quote.
function AckCheckPanel({ quote }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);

  const run = () => {
    const ack = parseAcknowledgment(text);
    setResult({ ack, rec: reconcile(ack, quote) });
  };

  return (
    <div style={panelStyle}>
      <div style={sectionTitle}>Acknowledgment Check — 24-hour review window</div>
      <p style={{ fontSize: 12, color: C.muted, margin: '0 0 8px' }}>
        When the order confirmation arrives, open the PDF, select all, copy, and paste it here. Every line is diffed against this quote so corrections can go back to orders@wwinc.com the same day.
      </p>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5}
        placeholder="Paste the full text of the W.W. Wood order confirmation here…"
        style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }} />
      <button onClick={run} disabled={!text.trim()} style={{ ...btnPrimary, marginTop: 8, opacity: text.trim() ? 1 : 0.5 }}>
        Reconcile against quote
      </button>

      {result && (() => {
        const { rec, ack } = result;
        return (
          <div style={{ marginTop: 14 }}>
            <div style={{ padding: '10px 12px', borderRadius: 6, fontWeight: 700, fontSize: 13,
              background: rec.clean ? '#e7f5ec' : '#fdecea',
              border: `1px solid ${rec.clean ? '#1c7c45' : C.danger}`,
              color: rec.clean ? '#1c7c45' : C.danger }}>
              {rec.clean
                ? `✓ CLEAN — ${rec.matched.length} line${rec.matched.length === 1 ? '' : 's'} match${ack.orderNumber ? ` (order #${ack.orderNumber})` : ''}. Subtotal agrees${rec.ackTotals.cabinetTotal != null ? ` at ${formatCurrency(rec.ackTotals.cabinetTotal)}` : ''}.`
                : `✗ VARIANCES FOUND${ack.orderNumber ? ` (order #${ack.orderNumber})` : ''} — mark these on the acknowledgment and resend within 24 hours.`}
            </div>
            {rec.totalDelta != null && Math.abs(rec.totalDelta) > 0.02 && (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                <strong>Cabinet Total:</strong> acknowledgment {formatCurrency(rec.ackTotals.cabinetTotal)} vs quote {formatCurrency(rec.quoteSubtotal)} —{' '}
                <span style={{ color: rec.totalDelta > 0 ? C.danger : '#1c7c45', fontWeight: 700 }}>
                  {rec.totalDelta > 0 ? '+' : '−'}{formatCurrency(Math.abs(rec.totalDelta))}
                </span>
              </div>
            )}
            {rec.priceDiffs.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Price differences</div>
                {rec.priceDiffs.map((d, i) => (
                  <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: `1px solid ${C.border}`, fontFamily: 'monospace' }}>
                    {d.sku}: ack {formatCurrency(d.ack)} vs quote {formatCurrency(d.quote)} ({d.delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(d.delta))})
                  </div>
                ))}
              </div>
            )}
            {rec.onlyQuote.length > 0 && (
              <div style={{ marginTop: 10, fontSize: 12 }}>
                <strong style={{ color: C.danger }}>On the quote but NOT acknowledged:</strong>{' '}
                {rec.onlyQuote.map(q => q.sku).join(', ')}
              </div>
            )}
            {rec.onlyAck.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 12 }}>
                <strong style={{ color: C.warn }}>Acknowledged but NOT on the quote:</strong>{' '}
                {rec.onlyAck.map(a => `${a.sku} (${formatCurrency(a.total)})`).join(', ')}
              </div>
            )}
            <p style={{ fontSize: 10, color: C.dim, marginTop: 8 }}>
              Parsed {ack.parsedLines} priced line(s) from the paste. Text-layer parsing is best-effort — always sight-check species, door style, and ship date on the acknowledgment itself.
            </p>
          </div>
        );
      })()}
    </div>
  );
}

// ==================== RESULTS VIEW ====================
const DEALER_SETTINGS_KEY = 'ekd.dealerSettings';
const DEALER_DEFAULTS = { multiplier: 1.0, marginPct: 0, marginMethod: 'markup', taxPct: 0, freight: 0, install: 0 };
// Discount-multiplier presets from W.W. Wood order confirmations. The
// confirmation math is: Cabinet Total − Dealer Discount − Rep Discount =
// Order Amount. June 2026 (#45923/#45928/#45933): dealer discount 47% →
// dealer net ×0.53; rep pays ×0.265 of list. (Aug 2025 confirmations show
// dealer net ×0.57 — terms improved; adjust the number to current terms.)
const MULTIPLIER_PRESETS = [
  { label: 'List', value: 1.0 },
  { label: 'Dealer ×0.53', value: 0.53 },
  { label: 'Rep ×0.265', value: 0.265 },
];
function loadDealerSettings() {
  try { return { ...DEALER_DEFAULTS, ...(JSON.parse(localStorage.getItem(DEALER_SETTINGS_KEY)) || {}) }; }
  catch { return { ...DEALER_DEFAULTS }; }
}

function ResultsView({ solverResult, quote, trainingScore, applianceTotal, countertopEstimate, onBack,
  materials, selectedAppliances, countertopColor, prefs, trimSelections,
  projectMeta = {}, revisions = [], onRestoreRevision, walls = [], orderSpec = {},
  lineMods = {}, onChangeLineMods, onEditInStudio }) {
  const [tab, setTab] = useState('floorplan');
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dealer, setDealer] = useState(loadDealerSettings);
  useEffect(() => {
    try { localStorage.setItem(DEALER_SETTINGS_KEY, JSON.stringify(dealer)); } catch { /* private mode */ }
  }, [dealer]);
  if (!solverResult) return null;

  const placements = solverResult.placements || [];
  const wallGroups = {};
  placements.forEach(p => { const wall = p.wall || p.zone || 'other'; (wallGroups[wall] = wallGroups[wall] || []).push(p); });

  const cabinetTotal = quote?.subtotal || 0;
  const fabricationTotal = quote?.fabrication?.subtotal || 0;
  const fallbackCount = quote?.fallbackCount || 0;
  const countertopMid = countertopEstimate?.totalLow ? (countertopEstimate.totalLow + countertopEstimate.totalHigh) / 2 : 0;

  // Customer-ready math: the C3 quote is LIST pricing. W.W. Wood invoices at
  // a discount multiplier off list (order confirmations show dealer ×0.47,
  // rep ×0.265), so: list × multiplier = net cost → margin → sell. Freight &
  // install flat; tax on materials (not install labor).
  const listSubtotal = cabinetTotal + fabricationTotal;
  const mult = dealer.multiplier > 0 ? dealer.multiplier : 1.0;
  const netCost = listSubtotal * mult;
  const cabinetSell = calculateDealerPrice(netCost, dealer.marginPct || 0, dealer.marginMethod).sellPrice;
  const taxableBase = cabinetSell + (dealer.freight || 0) + (applianceTotal || 0) + countertopMid;
  const taxAmt = taxableBase * ((dealer.taxPct || 0) / 100);
  const customerTotal = taxableBase + (dealer.install || 0) + taxAmt;
  const grandTotal = customerTotal;
  const isGola = placements.some(p => p.sku?.startsWith('FC-'));

  return (
    <div>
      <button onClick={onBack} style={{ ...btnOutline, marginBottom: 16 }}>Back to Designer</button>
      {onEditInStudio && (
        <button onClick={onEditInStudio} style={{ ...btnOutline, marginBottom: 16, marginLeft: 8, borderColor: C.accent, color: C.accent }}
          title="Load this exact layout into the Design Studio canvas — drag cabinets, swap SKUs, then re-price.">
          ✎ Edit in Design Studio
        </button>
      )}

      {materials?.brand === 'shiloh' && (
        <div style={{ marginBottom: 16, padding: '10px 12px', background: '#c8a96e22', border: `1px solid ${C.gold}`, borderRadius: 8, fontSize: 12, color: C.text }}>
          <strong>Shiloh (framed) — {getConstruction(materials.frameStyle).label}.</strong> Cabinet pricing below is <strong>interim</strong>: cabinet bodies use <strong>Shiloh catalog v3.42 prices scraped from the spec book</strong> ({SHILOH_SKU_COUNT}{' '}SKUs); accessories/fillers/derived variants fall back to the Eclipse list. Construction, depths, and drawings are Shiloh-correct. Figures will be finalized against the official Shiloh price CSV.
          {fallbackCount > 0 && (
            <div style={{ marginTop: 6, fontWeight: 600, color: C.warn }}>
              ⚠ {fallbackCount} of {(quote?.items || []).length} line items priced from the <u>Eclipse</u> list (no Shiloh match — marked "≈ Eclipse" below). Shiloh framed typically lists 5–15% higher; review before quoting.
            </div>
          )}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cabinets', value: solverResult.metadata?.totalCabinets || placements.filter(x => x.type !== 'appliance').length },
          { label: 'Layout', value: solverResult.layoutType || '-' },
          { label: 'Style', value: isGola ? 'Gola' : 'Standard' },
          { label: 'Training Match', value: trainingScore ? `${trainingScore.confidence}%` : 'N/A' },
          { label: 'Cabinetry', value: formatCurrency(cabinetTotal), accent: true },
          { label: 'Trim & Fabrication', value: fabricationTotal > 0 ? formatCurrency(fabricationTotal) : 'Included' },
          { label: 'Appliances', value: applianceTotal > 0 ? formatCurrency(applianceTotal) : 'N/A' },
          { label: 'Countertops', value: countertopEstimate ? `${formatCurrency(countertopEstimate.totalLow)}-${formatCurrency(countertopEstimate.totalHigh)}` : 'N/A' },
          { label: 'Est. Customer Total', value: formatCurrency(grandTotal), accent: true },
        ].map((s, i) => (
          <div key={i} style={{ background: C.surface, borderRadius: 8, padding: 14, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, color: C.dim, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: s.accent ? 18 : 16, fontWeight: 700, color: s.accent ? C.accent : C.text }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { id: 'floorplan', label: 'Floor Plan' },
          { id: 'elevations', label: 'Elevations' },
          { id: 'rendering', label: 'AI Rendering' },
          { id: '3d', label: '3D View' },
          { id: 'layout', label: 'Cabinet List' },
          { id: 'quote', label: 'Quote' },
          { id: 'order', label: 'Order' },
          { id: 'revisions', label: `Revisions${revisions.length ? ` (${revisions.length})` : ''}` },
          { id: 'training', label: 'Training' },
          { id: 'compare', label: 'Compare' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none',
              background: tab === t.id ? C.primary : 'transparent', color: tab === t.id ? '#fff' : C.muted }}>
            {t.label}
          </button>
        ))}
        {/* PDF Export button */}
        <button onClick={async () => {
          setExporting(true);
          try {
            // Project-wide BOM: aggregate placements by SKU with dims + locations.
            const bomMap = new Map();
            for (const p of placements) {
              if (!p.sku) continue;
              const key = p.sku;
              const e = bomMap.get(key) || { sku: p.sku, qty: 0, w: p.width || '', h: p._elev?.height || p.height || '', d: p._elev?.depth || p.depth || '', wallSet: new Set() };
              e.qty += p.qty || 1;
              if (p.wall) e.wallSet.add(p.wall === 'island' ? 'Island' : `Wall ${p.wall}`);
              bomMap.set(key, e);
            }
            const bom = [...bomMap.values()]
              .map(e => ({ ...e, walls: [...e.wallSet].join(', ') }))
              .sort((a, b) => a.sku.localeCompare(b.sku));
            const constr = getConstruction(materials?.frameStyle);
            const specs = [
              `${materials.brand === 'shiloh' ? 'Shiloh (framed)' : 'Eclipse (frameless)'} — ${constr.note || constr.label}`,
              `Species/finish: ${materials.species}${materials.finishColor && materials.finishColor !== 'Natural' ? ` · ${materials.finishColor}` : ' · Natural'}${materials.islandSpecies ? ` (island: ${materials.islandSpecies})` : ''}`,
              `Door style: ${materials.door} · Box: ${materials.construction}` ,
              `Hardware: ${materials.hardware === 'bar' ? 'Bar pull' : 'Knob'}${materials.hardwareFinish ? ` (${materials.hardwareFinish})` : ''} — base pulls top rail, upper pulls bottom rail`,
              `Backsplash: ${trimSelections?.backsplashStyle === 'full_slab' ? 'Full-height slab' : 'Standard 18" band'} · Ceiling fit: ${trimSelections?.ceilingFit || 'crown'}`,
              ...(trimSelections?.crown ? [`Crown moulding: ${trimSelections.crownProfile === 'furniture' ? 'furniture profile' : 'standard 3½"'}`] : []),
              ...(trimSelections?.lightRail ? ['Light rail under uppers'] : []),
              'All dimensions to face of finished cabinet U.N.O. — verify in field before fabrication.',
              'Appliances & fixtures by others — confirm rough-ins and cut-outs against manufacturer specs.',
            ];
            await exportPDF({
              title: projectMeta.name
                ? `${projectMeta.name}${projectMeta.customer ? ' — ' + projectMeta.customer : ''}`
                : 'Eclipse Kitchen Designer',
              layoutType: solverResult.layoutType,
              roomType: solverResult.roomType,
              materials,
              cabinetTotal,
              applianceTotal: applianceTotal || 0,
              countertopEstimate,
              formatCurrency,
              bom,
              specs,
            });
          } catch (e) { console.error('PDF export failed:', e); }
          setExporting(false);
        }} disabled={exporting}
          style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: `1px solid ${C.accent}`,
            background: 'transparent', color: C.accent, fontWeight: 600, marginLeft: 'auto' }}>
          {exporting ? 'Exporting...' : 'Export PDF'}
        </button>
        <button onClick={() => setDebugOverlay(d => !d)}
          style={{ padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            border: `1px solid ${debugOverlay ? '#E91E63' : '#999'}`,
            background: debugOverlay ? '#FDE8EF' : 'transparent',
            color: debugOverlay ? '#E91E63' : '#666', fontWeight: 600, marginLeft: 8 }}>
          {debugOverlay ? 'Debug ON' : 'Debug'}
        </button>
      </div>

      {/* Floor Plan tab */}
      {tab === 'floorplan' && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div data-pdf="floorplan" style={{ flex: '1 1 520px', minWidth: 0 }}>
            <FloorPlanView solverResult={solverResult} inputWalls={solverResult._inputWalls} debug={debugOverlay}
              titleBlock={{
                project: projectMeta.name || `${solverResult?.roomType || 'Kitchen'} Floor Plan`,
                client: [projectMeta.customer, projectMeta.jobNumber && `Job #${projectMeta.jobNumber}`, projectMeta.address].filter(Boolean).join('  ·  '),
                designer: projectMeta.designer || 'Eclipse Kitchen Designer',
                date: new Date().toLocaleDateString('en-US'),
              }} />
          </div>
        </div>
      )}

      {/* Elevations tab */}
      {tab === 'elevations' && (
        <div>
          <ElevationView solverResult={solverResult} trim={trimSelections} debug={debugOverlay} doorStyle={materials?.door} species={materials?.species} countertopColor={countertopColor} finishColor={materials?.finishColor} grainHorizontal={materials?.grainHorizontal} hardware={materials?.hardware} hardwareFinish={materials?.hardwareFinish} appliances={selectedAppliances} construction={getConstruction(materials?.frameStyle)} titleBlock={{
            project: projectMeta.name || `${solverResult?.roomType || 'Kitchen'}${solverResult?.layoutType ? ' \u2014 ' + solverResult.layoutType : ''}`,
            client: [projectMeta.customer, projectMeta.jobNumber && `Job #${projectMeta.jobNumber}`, projectMeta.address].filter(Boolean).join('  \u00b7  '),
            designer: projectMeta.designer || 'Eclipse Kitchen Designer',
            date: new Date().toLocaleDateString('en-US'), scale: '1/2" = 1\'-0"' }} />
          {/* Tag SVGs for PDF export */}
          <style>{`[data-pdf="elevation"] { /* marker */ }`}</style>
        </div>
      )}

      {/* AI Rendering tab */}
      {tab === 'rendering' && (
        <LeonardoRenderer
          solverResult={solverResult}
          materials={materials}
          selectedAppliances={selectedAppliances}
          countertopColor={countertopColor}
          prefs={prefs}
          trim={trimSelections}
          construction={getConstruction(materials?.frameStyle)}
        />
      )}

      {/* 3D View tab */}
      {tab === '3d' && (
        <Kitchen3DView
          solverResult={solverResult}
          materials={materials}
          construction={getConstruction(materials?.frameStyle)}
          countertopColor={countertopColor}
          trim={trimSelections}
          prefs={prefs}
          selectedAppliances={selectedAppliances}
        />
      )}

      {/* Layout tab — Professional Cabinet Schedule */}
      {tab === 'layout' && (() => {
        // Build sequential KD-numbered schedule matching elevation/floor plan tags
        let tagNum = 1;
        const scheduleRows = [];
        const wallKeys = Object.keys(wallGroups).sort();

        // Helper: parse description from SKU
        const skuDesc = (sku, type, appType) => {
          if (type === 'appliance') return appType ? appType.replace(/([A-Z])/g, ' $1').trim() : 'Appliance';
          if (!sku) return type || 'Cabinet';
          const O = sku.toUpperCase().replace(/^FC-/, '');
          // Exact matches first
          if (O === 'OVF3') return 'Overlay Filler';
          if (O === 'DP') return 'Dishwasher Panel';
          if (O === 'BCF') return 'Beverage Center Front';
          if (O.startsWith('TK')) return 'Toe Kick';
          if (O.match(/UCA/)) return 'Light Rail / Under Cabinet';
          // Tall cabinets (before base to avoid B-prefix collision)
          if (O.startsWith('O') && O.match(/^O\d/)) return 'Oven Cabinet';
          if (O.startsWith('U') && O.match(/^U\d/) && O.includes('FHD')) return 'Utility Full Height Door';
          if (O.startsWith('U') && O.match(/^U\d/)) return 'Utility Cabinet';
          // Wall cabinets
          if (O.startsWith('RW')) return 'Refrigerator Wall Cabinet';
          if (O.startsWith('SW')) return 'Stacked Wall Cabinet';
          if (O.startsWith('WBC')) return 'Wall Blind Corner';
          if (O.startsWith('WEP')) return 'Wall End Panel';
          if (O.startsWith('W') && O.match(/^W\d/)) return 'Wall Cabinet';
          // Special base cabinets
          if (O.startsWith('BWDMW')) return 'Base Waste Door Mount';
          if (O.startsWith('BPOS')) return 'Base Pull-Out Shelf';
          if (O.startsWith('B3D') || O.startsWith('B4D')) {
            const n = O.match(/^B(\d)D/);
            return `${n ? n[1] : 3}-Drawer Base`;
          }
          if (O.startsWith('BSB') || O.startsWith('SB')) {
            return O.includes('FHD') ? 'Sink Base Full Height Door' : 'Sink Base';
          }
          if (O.startsWith('BBC')) return O.includes('MC') ? 'Magic Corner Base' : 'Blind Base Corner';
          if (O.startsWith('BL') && O.includes('SS')) {
            return O.includes('WSS') ? 'Lazy Susan Wire Super Susan' : 'Lazy Susan Super Susan';
          }
          if (O.startsWith('BO') && O.match(/^BO\d/)) return 'Base Oven';
          if (O.startsWith('BTR')) return 'Tray Base';
          if (O.startsWith('BEP')) return 'Base End Panel';
          if (O.startsWith('DSB')) return 'Diagonal Sink Base';
          if (O.startsWith('RTB')) return 'Range Top Base';
          if (O.startsWith('REP')) return 'Refrigerator End Panel';
          if (O.startsWith('ROT')) return O.includes('FM') ? 'Rollout Tray Floor Mount' : 'Rollout Tray';
          if (O.startsWith('DMW')) return 'Drawer Microwave';
          if (O.startsWith('IBS')) return 'Island Bar Sink';
          if (O.startsWith('IWS')) return 'Island Work Sink';
          // Generic base with modifiers
          if (O.startsWith('B') && O.includes('FHD')) return 'Full-Height Door Base';
          if (O.startsWith('B') && O.includes('RT')) return 'Roll-Out Tray Base';
          if (O.startsWith('B') && O.match(/^B\d/)) return 'Base Cabinet';
          // Fillers
          if (O.startsWith('F') && O.match(/^F\d/)) return 'Filler Strip';
          if (O.startsWith('OVF')) return 'Overlay Filler';
          if (O.startsWith('FWEP')) return 'Flush Wall End Panel';
          if (O.startsWith('LB-')) return 'Light Bridge';
          if (O.startsWith('SWBC')) return 'Stacked Wall Blind Corner';
          if (O.startsWith('CRN')) return 'Crown Molding';
          if (O.startsWith('LR-')) return 'Light Rail';
          if (O.startsWith('SCRIBE')) return 'Scribe Molding';
          if (O.startsWith('DWP')) return 'Dishwasher Panel';
          return type || 'Cabinet';
        };

        // ── SKU-based height/depth parsers (type-independent) ──
        function parseHeightFromSku(sku, fallback) {
          const s = (sku || '').toUpperCase().replace(/^FC-/, '');
          let m;
          m = s.match(/^W(\d{2,3})(\d{2})[LR]?$/); if (m) return parseInt(m[2]);
          m = s.match(/^SW(\d{2,3})(\d{2})/); if (m) return parseInt(m[2]);
          m = s.match(/^RW(\d{2})(\d{2})/); if (m) return parseInt(m[2]);
          m = s.match(/^WBC(\d{2})(\d{2})/); if (m) return parseInt(m[2]);
          m = s.match(/^SWBC(\d{2})(\d{2})/); if (m) return parseInt(m[2]);
          m = s.match(/^[UO](\d{2,3})(\d{2,3})/);
          if (m) { const d = m[1] + m[2]; if (d.length >= 4) return parseInt(d.slice(2)); }
          m = s.match(/REP.*?(\d{2,3})FTK/); if (m) return parseInt(m[1]);
          m = s.match(/^F(\d)(\d{2,3})$/); if (m) return parseInt(m[2]);
          if (/^B\d|^SB|^BBC|^BL|^RTB|^BO|^BPOS|^BWDMW|^BTR|^DSB/.test(s)) return 34.5;
          return fallback;
        }

        function parseDepthFromSku(sku, fallback) {
          const s = (sku || '').toUpperCase().replace(/^FC-/, '');
          let m;
          m = s.match(/-(\d{2})$/); if (m && /^[UO]|^RW/.test(s)) return parseInt(m[1]);
          m = s.match(/FTK-(\d{2})/); if (m) return parseInt(m[1]);
          if (/^W\d|^SW\d|^WBC|^SWBC/.test(s)) return 13;
          if (/^RW/.test(s)) return 27;
          if (/^B\d|^SB|^BBC|^BL|^RTB|^BO|^BPOS|^BWDMW|^BTR|^DSB/.test(s)) return 24;
          return fallback;
        }

        // Parse height from SKU for uppers/talls
        const skuH = (sku, def) => {
          if (!sku) return def;
          const s = sku.toUpperCase().replace(/^FC-/, '');
          // Wall cabinet: W{width}{height}[L|R]
          const wm = s.match(/^W(\d{2,3})(\d{2})[LR]?$/);
          if (wm) return parseInt(wm[2]);
          // Stacked wall: SW{width}{height}
          const swm = s.match(/^SW(\d{2,3})(\d{2})$/);
          if (swm) return parseInt(swm[2]);
          // RW: RW{w}{h}-{d}
          const rwm = s.match(/^RW(\d{2})(\d{2})-/);
          if (rwm) return parseInt(rwm[2]);
          // WBC
          const wbcm = s.match(/^WBC(\d{2})(\d{2})$/);
          if (wbcm) return parseInt(wbcm[2]);
          // Utility/Oven tall: U or O followed by digits
          if (/^[UO]\d/.test(s)) {
            const afterPrefix = s.replace(/^[UO]/, '');
            const digits = afterPrefix.match(/^(\d+)/);
            if (digits) {
              const allDigits = digits[1];
              if (allDigits.length === 5) return parseInt(allDigits.slice(2)); // U36102 → 102
              if (allDigits.length === 4) return parseInt(allDigits.slice(2)); // U3696 → 96
              if (allDigits.length === 3) return parseInt(allDigits.slice(1)); // U384 → 84
            }
          }
          return def;
        };

        // Helper: map appliance types to SKU format
        function applianceSku(appType, width) {
          const t = (appType || '').toLowerCase().replace(/_/g, '');
          if (t === 'refrigerator' || t === 'freezer') return `REF${width || 36}`;
          if (t === 'dishwasher') return `DW${width || 24}`;
          if (t === 'range') return `RNG${width || 36}`;
          if (t === 'cooktop') return `CT${width || 36}`;
          if (t === 'walloven' || t === 'wall_oven') return `WO${width || 30}`;
          if (t === 'microwave') return `MW${width || 30}`;
          if (t === 'hood' || t === 'venthood') return `VH${width || 36}`;
          return appType || '-';
        }

        // Determine hinge side based on nearest appliance
        const determineHinge = (cab, width, wallCabs) => {
          if (width > 24) return '-';
          const s = (cab.sku || '').toUpperCase().replace(/^FC-/, '');
          if (/^B[34]D/.test(s) || /^RTB/.test(s) || /^BPOS/.test(s) || /^F\d|^OVF|^REP|^WEP|^BEP|^TK|^CRN|^LR|^SCRIBE|^LB-/.test(s)) return '-';
          const appliances = (wallCabs || []).filter(c =>
            c.type === 'appliance' || c.role === 'sink' || c.role === 'range' ||
            c.role === 'dishwasher' || c.role === 'refrigerator'
          );
          const cabCenter = (cab.position || 0) + (width / 2);
          if (appliances.length === 0) {
            const wallEnd = wallCabs.reduce((max, c) => Math.max(max, (c.position || 0) + (c.width || 0)), 0);
            return cabCenter < wallEnd / 2 ? 'R' : 'L';
          }
          let nearest = appliances[0], nearestDist = Infinity;
          for (const app of appliances) {
            const appCenter = (app.position || 0) + ((app.width || 0) / 2);
            const dist = Math.abs(cabCenter - appCenter);
            if (dist < nearestDist) { nearestDist = dist; nearest = app; }
          }
          const appCenter = (nearest.position || 0) + ((nearest.width || 0) / 2);
          return cabCenter < appCenter ? 'R' : 'L';
        };

        for (const wall of wallKeys) {
          const items = wallGroups[wall];
          items.forEach(p => {
            const isApp = p.type === 'appliance';
            const pricedItem = quote?.items?.find(qi => qi.sku === p.sku);
            const w = p.width || 0;
            const h = parseHeightFromSku(p.sku, p.type === 'upper' ? 36 : p.type === 'tall' ? 96 : 34.5);
            const d = parseDepthFromSku(p.sku, p.type === 'upper' ? 13 : p.type === 'tall' ? 24 : 24);
            scheduleRows.push({
              tag: `KD${String(tagNum++).padStart(2, '0')}`,
              wall,
              sku: p.type === 'appliance' && !p.sku ? applianceSku(p.applianceType, p.width) : (p.sku || p.applianceType || '-').replace(/^FC-/, ''),
              desc: skuDesc(p.sku, p.type, p.applianceType),
              width: w,
              height: h,
              depth: d,
              mods: p._modWidth ? p._modWidthNote : (p.hingeSide ? `Hinge ${p.hingeSide}` : ''),
              hingeSide: p.hingeSide || determineHinge(p, w, items),
              unitPrice: pricedItem?.unitPrice || 0,
              extPrice: pricedItem?.totalPrice || pricedItem?.unitPrice || 0,
              isApp,
              isAccessory: p.role === 'filler' || p.role === 'end_panel' || p.type === 'end_panel',
            });

            // Add modification sub-row if cabinet was width-modified
            if (p._modWidth) {
              scheduleRows.push({
                tag: '', wall: '', sku: 'MOD WIDTH N/C',
                desc: `Modified to ${p._modWidth}"`, width: p._modWidth,
                height: '', depth: '', mods: '', hingeSide: '',
                unitPrice: 0, extPrice: 0, isApp: false, isAccessory: false,
                isModification: true,
              });
            }
          });
        }

        const cabinetRows = scheduleRows.filter(r => !r.isAccessory);
        const accessoryRows = scheduleRows.filter(r => r.isAccessory);

        const thStyle = { padding: '6px 8px', textAlign: 'left', color: C.dim, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: `2px solid ${C.border}` };
        const tdStyle = { padding: '5px 8px', fontSize: 11, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle', color: C.text };
        const tdR = { ...tdStyle, textAlign: 'right' };

        return (
          <div style={panelStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: C.primary }}>
              Cabinet Schedule — Eclipse C3 Frameless
            </h3>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
              Material: {materials?.species || 'Maple'} | Door Style: {materials?.door || 'MET-V'} | Construction: Frameless | Date: {new Date().toLocaleDateString()}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Item #', 'Wall', 'SKU', 'Description', 'W"', 'H"', 'D"', 'Modifications', 'Hinge', 'Unit $', 'Ext $'].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: h.includes('$') || h === 'W"' || h === 'H"' || h === 'D"' ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Group by wall with subtotals */}
                  {wallKeys.map(wall => {
                    const wallCabs = cabinetRows.filter(r => r.wall === wall);
                    if (wallCabs.length === 0) return null;
                    const wallSubtotal = wallCabs.reduce((s, r) => s + r.extPrice, 0);
                    return (
                      <React.Fragment key={wall}>
                        {wallCabs.map((r, i) => (
                          <tr key={`${wall}-${i}`} style={{ background: r.isApp ? '#fef9f0' : (i % 2 === 0 ? '#fafafa' : '#fff') }}>
                            <td style={{ ...tdStyle, fontWeight: 700, color: C.primary }}>{r.tag}</td>
                            <td style={tdStyle}>{r.wall}</td>
                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, fontSize: 10 }}>{r.sku}</td>
                            <td style={tdStyle}>{r.desc}</td>
                            <td style={tdR}>{r.width || ''}</td>
                            <td style={tdR}>{r.height || ''}</td>
                            <td style={tdR}>{r.depth || ''}</td>
                            <td style={{ ...tdStyle, fontSize: 10, color: C.muted }}>{r.mods}</td>
                            <td style={{ ...tdStyle, textAlign: 'center' }}>{r.hingeSide}</td>
                            <td style={tdR}>{r.unitPrice > 0 ? formatCurrency(r.unitPrice) : '-'}</td>
                            <td style={{ ...tdR, fontWeight: 600 }}>{r.extPrice > 0 ? formatCurrency(r.extPrice) : '-'}</td>
                          </tr>
                        ))}
                        <tr style={{ background: '#f0f4f8' }}>
                          <td colSpan={9} style={{ ...tdStyle, fontWeight: 700, textAlign: 'right', color: C.primary }}>Wall {wall} Subtotal</td>
                          <td style={tdR}></td>
                          <td style={{ ...tdR, fontWeight: 700, color: C.accent }}>{wallSubtotal > 0 ? formatCurrency(wallSubtotal) : '-'}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Accessories section */}
            {accessoryRows.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: C.muted }}>Accessories (Fillers, End Panels, Trim)</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      {['Item #', 'Wall', 'SKU', 'Description', 'W"', 'Unit $'].map(h => (
                        <th key={h} style={{ ...thStyle, textAlign: h.includes('$') || h === 'W"' ? 'right' : 'left' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {accessoryRows.map((r, i) => (
                      <tr key={`acc-${i}`} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: C.muted }}>{r.tag}</td>
                        <td style={tdStyle}>{r.wall}</td>
                        <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10 }}>{r.sku}</td>
                        <td style={tdStyle}>{r.desc}</td>
                        <td style={tdR}>{r.width || ''}</td>
                        <td style={tdR}>{r.unitPrice > 0 ? formatCurrency(r.unitPrice) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Non-Plan Items (Toe Kick, Touch-Up Kit, Light Rail) */}
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#64748b' }}>Non-Plan Items</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <tbody>
                  {[
                    { sku: 'TK-N/C', desc: 'Toe Kick (included)', qty: Math.max(1, Math.ceil((cabinetRows.reduce((s, r) => s + (r.width || 0), 0)) / 96)) },
                    { sku: 'TUK-STAIN', desc: 'Touch-Up Kit', qty: 1 },
                    ...(trimSelections?.lightRail ? [{ sku: '1 3/4 UCA', desc: 'Light Rail', qty: Math.max(1, Math.ceil((cabinetRows.filter(r => r.desc === 'Wall Cabinet').reduce((s, r) => s + (r.width || 0), 0)) / 96)) }] : []),
                    ...(trimSelections?.ceilingFit === 'fitted' ? [
                      { sku: 'WFC3(12-42)-15', desc: 'Riser / Filler Panel to Ceiling', qty: Math.max(1, Math.ceil((cabinetRows.filter(r => r.desc === 'Wall Cabinet').reduce((s, r) => s + (r.width || 0), 0)) / 96)) },
                      { sku: '3SRM3F', desc: 'Ceiling Scribe Molding', qty: Math.max(1, Math.ceil((cabinetRows.filter(r => r.desc === 'Wall Cabinet').reduce((s, r) => s + (r.width || 0), 0)) / 120)) },
                    ] : []),
                  ].map((item, i) => (
                    <tr key={`np-${i}`} style={{ background: i % 2 === 0 ? '#fafafa' : '#fff' }}>
                      <td style={{ ...tdStyle, color: C.text }}>*</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10, color: C.text }}>{item.sku}</td>
                      <td style={{ ...tdStyle, color: C.text }}>{item.desc}</td>
                      <td style={{ ...tdR, color: C.text }}>Qty: {item.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grand Total */}
            <div style={{ marginTop: 16, padding: '12px 16px', background: C.primary, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Grand Total ({scheduleRows.length} items)</span>
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 18 }}>{formatCurrency(scheduleRows.reduce((s, r) => s + r.extPrice, 0))}</span>
            </div>
          </div>
        );
      })()}

      {/* Quote tab */}
      {tab === 'quote' && quote && (
        <div>
          {Object.entries((() => {
            const byWall = {};
            (quote.items || []).forEach(item => { const w = item.wall || 'other'; (byWall[w] = byWall[w] || []).push(item); });
            return byWall;
          })()).map(([wall, items]) => {
            const wallTotal = items.reduce((s, i) => s + (i.totalPrice || 0), 0);
            return (
              <div key={wall} style={panelStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Wall {wall}</h4>
                  <span style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{formatCurrency(wallTotal)}</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                      {['SKU', 'Qty', 'Doors', 'Dwrs', 'Stock', 'Door Chg', 'Constr.', 'Unit Price'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: h === 'SKU' ? 'left' : 'right', color: C.dim, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <React.Fragment key={i}>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 11, color: item.error ? C.warn : C.text }}>
                          {item.sku}
                          {item._fallback && (
                            <span title="No Shiloh catalog match — priced from the Eclipse list. Review before quoting."
                              style={{ marginLeft: 6, padding: '1px 5px', borderRadius: 3, fontSize: 9, fontFamily: 'inherit', fontWeight: 700, background: '#fdf3e0', color: C.warn, border: `1px solid ${C.warn}` }}>
                              ≈ ECLIPSE
                            </span>
                          )}
                        </td>
                        {item.error ? (
                          <td colSpan={7} style={{ padding: '5px 8px', color: C.warn, fontStyle: 'italic', fontSize: 11 }}>{item.error}</td>
                        ) : (<>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.qty || 1}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.doorCount || 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.drawerCount || 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.stockBase || 0)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.doorChg > 0 ? formatCurrency(item.doorChg) : '—'}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {item.overlayChg > 0 ? `+${formatCurrency(item.overlayChg)}` : item.insetPct > 0 ? `+${item.insetPct}%` : '—'}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.unitPrice || 0)}</td>
                        </>)}
                      </tr>
                      {!item.error && onChangeLineMods && (
                        <LineModEditor item={item} lineMods={lineMods} onChange={onChangeLineMods} />
                      )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* Trim, panels & fabrication — explicit line items, never silently $0 */}
          {quote.fabrication?.items?.length > 0 && (
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Trim, Panels &amp; Fabrication</h4>
                <span style={{ color: C.accent, fontWeight: 700, fontSize: 14 }}>{formatCurrency(fabricationTotal)}</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    {['SKU', 'Description', 'Qty', 'Unit', 'Ext.'].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: ['Qty', 'Unit', 'Ext.'].includes(h) ? 'right' : 'left', color: C.dim, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quote.fabrication.items.map((f, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 11 }}>{f.sku}</td>
                      <td style={{ padding: '5px 8px', fontSize: 11, color: C.muted }}>
                        {f.label}
                        {f.estimate && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: C.warn }}>EST.</span>}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>{f.qty}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {f.included ? <span style={{ color: C.dim, fontStyle: 'italic' }}>Included</span>
                          : f.needsQuote ? <span style={{ color: C.warn, fontStyle: 'italic' }}>Quote separately</span>
                          : formatCurrency(f.unitPrice)}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {f.included || f.needsQuote ? '—' : formatCurrency(f.totalPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {quote.fabrication.needsQuoteCount > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: C.warn }}>
                  ⚠ {quote.fabrication.needsQuoteCount} item{quote.fabrication.needsQuoteCount > 1 ? 's' : ''} need{quote.fabrication.needsQuoteCount > 1 ? '' : 's'} a separate quote — not included in totals.
                </div>
              )}
            </div>
          )}

          {/* Dealer pricing — margin, freight, install, tax → customer total */}
          <div style={panelStyle}>
            <div style={sectionTitle}>Dealer Pricing</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelStyle}>Discount Multiplier (× list)</label>
                <input type="number" min="0.05" max="1" step="0.005" value={dealer.multiplier}
                  onChange={e => setDealer(d => ({ ...d, multiplier: Math.min(1, Math.max(0.05, Number(e.target.value) || 1)) }))} style={inputStyle} />
                <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                  {MULTIPLIER_PRESETS.map(p => (
                    <button key={p.label} onClick={() => setDealer(d => ({ ...d, multiplier: p.value }))}
                      style={{ padding: '2px 7px', borderRadius: 3, fontSize: 10, cursor: 'pointer', fontWeight: 600,
                        border: `1px solid ${dealer.multiplier === p.value ? C.accent : C.border}`,
                        background: dealer.multiplier === p.value ? '#c8a96e22' : 'transparent',
                        color: dealer.multiplier === p.value ? C.accent : C.dim }}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Margin %</label>
                <input type="number" min="0" max="80" step="1" value={dealer.marginPct}
                  onChange={e => setDealer(d => ({ ...d, marginPct: Math.max(0, Number(e.target.value) || 0) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Method</label>
                <select value={dealer.marginMethod} onChange={e => setDealer(d => ({ ...d, marginMethod: e.target.value }))} style={inputStyle}>
                  <option value="markup">Markup (cost × 1.X)</option>
                  <option value="margin">Margin (cost ÷ (1−X))</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Freight $</label>
                <input type="number" min="0" step="25" value={dealer.freight}
                  onChange={e => setDealer(d => ({ ...d, freight: Math.max(0, Number(e.target.value) || 0) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Install $</label>
                <input type="number" min="0" step="100" value={dealer.install}
                  onChange={e => setDealer(d => ({ ...d, install: Math.max(0, Number(e.target.value) || 0) }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sales Tax %</label>
                <input type="number" min="0" max="15" step="0.1" value={dealer.taxPct}
                  onChange={e => setDealer(d => ({ ...d, taxPct: Math.max(0, Number(e.target.value) || 0) }))} style={inputStyle} />
              </div>
            </div>
            {[
              { label: `Cabinetry list (${(quote.items || []).length} items)`, value: cabinetTotal },
              { label: 'Trim & fabrication (list)', value: fabricationTotal },
              ...(mult !== 1 ? [{ label: `Your cost — multiplier ×${mult}`, value: netCost }] : []),
              ...(dealer.marginPct > 0 ? [{ label: `Dealer ${dealer.marginMethod} ${dealer.marginPct}%`, value: cabinetSell - netCost }] : []),
              ...(applianceTotal > 0 ? [{ label: 'Appliances (MSRP)', value: applianceTotal }] : []),
              ...(countertopMid > 0 ? [{ label: 'Countertops (est. midpoint)', value: countertopMid }] : []),
              ...(dealer.freight > 0 ? [{ label: 'Freight', value: dealer.freight }] : []),
              ...(dealer.install > 0 ? [{ label: 'Installation (not taxed)', value: dealer.install }] : []),
              ...(taxAmt > 0 ? [{ label: `Sales tax ${dealer.taxPct}%`, value: taxAmt }] : []),
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.muted }}>{row.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(row.value)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 16 }}>CUSTOMER TOTAL</span>
              <span style={{ color: C.accent, fontSize: 22, fontWeight: 700 }}>{formatCurrency(customerTotal)}</span>
            </div>
            {(mult === 1 && dealer.marginPct === 0 && dealer.taxPct === 0 && !dealer.freight && !dealer.install) && (
              <div style={{ marginTop: 8, fontSize: 11, color: C.warn }}>
                Multiplier is 1.0 and margin, freight, install, and tax are all zero — this total is manufacturer <strong>list</strong> price, not your cost and not a customer-ready price.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ORDER tab: readiness gate → W.W. Wood order package → ack reconciliation ── */}
      {tab === 'order' && (() => {
        const construction = getConstruction(materials?.frameStyle);
        const readiness = evaluateOrderReadiness({
          solverResult, quote, walls, selectedAppliances, projectMeta, orderSpec, construction, materials,
        });
        const handleGenerate = () => {
          const { rows, cutouts } = buildOrderItems(placements, quote, { inset: !!construction.inset });
          const appliancesByType = {};
          for (const a of selectedAppliances) if (a.type && !appliancesByType[a.type]) appliancesByType[a.type] = { ...a, brandName: getBrandName(a.brand) || a.brand };
          const customQuoteItems = (quote?.fabrication?.items || []).filter(i => i.needsQuote);
          const cover = {
            businessName: orderSpec.businessName, customerNumber: orderSpec.customerNumber,
            po: projectMeta.jobNumber || '', jobName: projectMeta.name || projectMeta.customer || '',
            species: materials.species, color: materials.finishColor || 'Natural',
            glaze: (GLAZES.find(g => g.v === orderSpec.glaze) || {}).l, highlight: (HIGHLIGHTS.find(g => g.v === orderSpec.highlight) || {}).l,
            upperDoor: orderSpec.upperDoor || materials.door, lowerDoor: materials.door,
            edgeProfile: orderSpec.edgeProfile, drawerBox: orderSpec.drawerBox,
            drawerFrontStyle: 'DF-' + materials.door, drawerGuide: orderSpec.drawerGuide,
            tipOn: orderSpec.tipOn, materialType: materials.construction,
            interiorFinish: (INTERIORS.find(g => g.v === orderSpec.interiorFinish) || {}).l,
            constructionNote: construction.note || construction.label,
            charTechniques: orderSpec.charTechniques !== 'NONE' ? (CHAR_TECHNIQUES.find(g => g.v === orderSpec.charTechniques) || {}).l : 'None',
            orderDate: new Date().toLocaleDateString('en-US'),
            salesperson: projectMeta.designer || '', contactPhone: orderSpec.contactPhone, contactEmail: orderSpec.contactEmail,
            pageCount: `${Math.max(1, Math.ceil(rows.length / 30)) + cutouts.length + (customQuoteItems.length ? 1 : 0)}`,
            specialInstructions: orderSpec.specialInstructions,
          };
          generateOrderPackage({
            brand: materials.brand, cover, items: rows, cutouts, customQuoteItems, appliancesByType,
            orderReady: readiness.ready,
            readinessIssues: readiness.checks.filter(c => !c.pass && c.severity === 'blocker').map(c => c.label),
            fmtMoney: formatCurrency,
          });
        };
        return (
          <div>
            {/* Grade banner */}
            <div style={{ marginBottom: 14, padding: '12px 16px', borderRadius: 8, fontWeight: 700, fontSize: 14,
              background: readiness.ready ? '#e7f5ec' : '#fdf3e0',
              border: `1px solid ${readiness.ready ? '#1c7c45' : C.warn}`,
              color: readiness.ready ? '#1c7c45' : C.warn }}>
              {readiness.ready ? '✓ ORDER GRADE — all checks pass; the package below is submission-ready.'
                : `BUDGET GRADE — ${readiness.blockers.length} blocking item${readiness.blockers.length === 1 ? '' : 's'} before this can be ordered. The package generates with a NOT-FOR-ORDER watermark.`}
            </div>

            {/* Readiness checklist */}
            <div style={panelStyle}>
              <div style={sectionTitle}>Order Readiness — Dealer Hub SOP checks</div>
              {readiness.checks.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, padding: '7px 4px', borderBottom: `1px solid ${C.border}`, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, width: 18 }}>{c.pass ? '✅' : c.severity === 'blocker' ? '🛑' : '⚠️'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: c.pass ? C.dim : (c.severity === 'blocker' ? C.danger : C.warn) }}>{c.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Package generation */}
            <div style={panelStyle}>
              <div style={sectionTitle}>W.W. Wood Order Package</div>
              <p style={{ fontSize: 12, color: C.muted, margin: '0 0 10px' }}>
                One PDF in the manufacturer's format: cover sheet ({materials.brand === 'shiloh' ? 'SHI' : 'ECL'}-SO-CS) · item list with drawing-matched cab numbers · pre-filled appliance cutout sheets · custom-quote worksheet. Submit to Orders@wwinc.com{readiness.ready ? '.' : ' — after clearing the blockers above.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={handleGenerate} style={{ ...btnPrimary, background: readiness.ready ? '#1c7c45' : C.warn }}>
                  {readiness.ready ? 'Generate Order Package' : 'Generate (BUDGET watermark)'}
                </button>
                <button onClick={() => window.open('https://pinnaclesales.biz/dealer-hub/submit', '_blank', 'noopener')} style={btnOutline}
                  title="Per the Dealer Hub SOP, email your first 3-4 projects to Pinnacle for pre-order review. Attach the order package PDF and your project file.">
                  Submit to Pinnacle for Review
                </button>
              </div>
              <p style={{ fontSize: 10.5, color: C.dim, marginTop: 8 }}>
                Reminder: cutout sheets require the manufacturer's appliance installation specs attached. Changes after the confirmation are allowed for 24 hours only.
              </p>
            </div>

            <AckCheckPanel quote={quote} />
          </div>
        );
      })()}

      {/* Revisions tab — every solve is a snapshot; restore loads it back into the designer */}
      {tab === 'revisions' && (
        <div style={panelStyle}>
          <div style={sectionTitle}>Revision History</div>
          {revisions.length === 0 && <p style={{ fontSize: 13, color: C.dim }}>Each solve is recorded here. Adjust the design and re-solve to build history.</p>}
          {revisions.map((rev, i) => {
            const current = i === 0;
            const delta = rev.subtotal - (revisions[0]?.subtotal || 0);
            return (
              <div key={rev.at || i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: `1px solid ${C.border}`, background: current ? '#c8a96e15' : 'transparent', borderRadius: 6 }}>
                <div style={{ width: 30, textAlign: 'center', fontWeight: 700, fontSize: 12, color: current ? C.accent : C.dim }}>
                  R{revisions.length - i}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {rev.label || 'Revision'}{current ? '  (current)' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim }}>
                    {new Date(rev.at).toLocaleString('en-US')} · {rev.cabinetCount} cabinets
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(rev.subtotal || 0)}</div>
                  {!current && Math.abs(delta) > 0.5 && (
                    <div style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: delta > 0 ? C.danger : '#1c7c45' }}>
                      {delta > 0 ? '+' : '−'}{formatCurrency(Math.abs(delta))} vs current
                    </div>
                  )}
                </div>
                {!current && onRestoreRevision && (
                  <button onClick={() => onRestoreRevision(rev)} title="Load this revision back into the designer (re-solve to see it)"
                    style={{ ...btnOutline, padding: '4px 12px', fontSize: 11 }}>Restore</button>
                )}
              </div>
            );
          })}
          <p style={{ fontSize: 10, color: C.dim, marginTop: 10 }}>
            "Restore" loads that revision's full design state into the designer — review and Solve to bring it back. List totals shown (cabinets + fabrication, before discounts).
          </p>
        </div>
      )}

      {tab === 'training' && <TrainingScorePanel score={trainingScore} />}
      {tab === 'compare' && <ComparisonPricingPanel placements={placements} frameStyle={materials?.frameStyle} />}
    </div>
  );
}

// ==================== STEP INDICATOR ====================
function StepIndicator({ steps, current, onStep }) {
  return (
    <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>
      {steps.map((s, i) => (
        <button key={i} onClick={() => onStep(i)}
          style={{
            flex: 1, padding: '8px 4px', borderRadius: i === 0 ? '6px 0 0 6px' : i === steps.length - 1 ? '0 6px 6px 0' : 0,
            cursor: 'pointer', border: 'none', fontSize: 12, fontWeight: current === i ? 700 : 400, transition: 'all 0.15s',
            background: current === i ? C.primary : i < current ? '#c8a96e22' : C.bg,
            color: current === i ? '#fff' : i < current ? C.accent : C.dim,
          }}>
          {i < current ? '\u2713 ' : ''}{s}
        </button>
      ))}
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [view, setView] = useState('designer');
  const [step, setStep] = useState(0);

  // Layout state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [layoutType, setLayoutType] = useState('l-shape');
  const [roomType, setRoomType] = useState('kitchen');
  const [walls, setWalls] = useState([
    { id: 'A', length: 156, role: 'range' },
    { id: 'B', length: 120, role: 'sink' },
  ]);
  const [appliances, setAppliances] = useState([
    { type: 'range', width: 30, wall: 'A' },
    { type: 'sink', width: 36, wall: 'B' },
    { type: 'dishwasher', width: 24, wall: 'B' },
    { type: 'refrigerator', width: 36, wall: 'A' },
  ]);
  const [island, setIsland] = useState(null);
  const [peninsula, setPeninsula] = useState(null);
  const [prefs, setPrefs] = useState({
    sophistication: 'standard', ceilingHeight: 96, cornerTreatment: 'auto',
    preferDrawerBases: true, golaChannel: false, featureHood: false,
  });

  // Materials
  const [materials, setMaterials] = useState({
    brand: 'eclipse', frameStyle: 'eclipse_frameless',
    species: 'Maple', door: 'MET-V', construction: 'Standard', islandSpecies: '', finishColor: 'Natural', grainHorizontal: false, hardware: 'knob', hardwareFinish: 'Brushed Nickel',
  });

  // Appliance selections
  const [selectedBrandAppliances, setSelectedBrandAppliances] = useState([]);
  const [applianceTier, setApplianceTier] = useState(null);  // which recommended package was adopted (null = custom)

  // ── Order spec (W.W. Wood cover-sheet fields). Dealer-constant identity
  //    fields persist in localStorage; style fields travel with the project. ──
  const ORDER_SPEC_DEFAULTS = {
    businessName: '', customerNumber: '', contactPhone: '', contactEmail: '',
    glaze: 'NONE', highlight: 'NONE', charTechniques: 'NONE', interiorFinish: 'STD-MAPL',
    edgeProfile: 'MATCH', tipOn: false, upperDoor: '', drawerBox: '5/8" Hdwd Dovetail',
    drawerGuide: 'Blum FEG Full Extension (soft-close)', specialInstructions: '',
  };
  const [orderSpec, setOrderSpec] = useState(() => {
    try { return { ...ORDER_SPEC_DEFAULTS, ...(JSON.parse(localStorage.getItem('ekd.orderSpec')) || {}) }; }
    catch { return { ...ORDER_SPEC_DEFAULTS }; }
  });
  useEffect(() => {
    const { businessName, customerNumber, contactPhone, contactEmail } = orderSpec;
    try { localStorage.setItem('ekd.orderSpec', JSON.stringify({ businessName, customerNumber, contactPhone, contactEmail })); } catch { /* private mode */ }
  }, [orderSpec]);

  // Countertop selections
  const [countertopSelection, setCountertopSelection] = useState({ sqft: 40, edge: 'straight', cutouts: 1, colorId: null, brand: null, thickness: null });

  // Trim / molding selections
  const [trimSelections, setTrimSelections] = useState({
    toeKick: true,       // TK-N/C (included with order)
    crown: true,         // 3 1/2CRN -10'
    crownProfile: 'standard', // 'standard' | 'furniture'
    lightRail: true,     // 1 3/4 UCA
    traditionalTrim: false,  // 7/8TD -8'
    countertopEdge: true,
    ceilingFit: 'crown', // 'crown' | 'fitted' (riser panel to ceiling) | 'open' (unfitted gap)
    backsplashStyle: 'standard', // 'standard' (tile/short) | 'full_slab' (full-height stone slab — current trend)
    hoodStyle: 'steel',       // 'steel' (chimney/insert) | 'plaster' (sculptural plaster canopy — warm-organic)
    rangeNiche: 'none',       // 'none' | 'arched' (arched plaster niche behind the range — Mediterranean)
  });

  // Results
  const [solverResult, setSolverResult] = useState(null);
  const [quote, setQuote] = useState(null);
  const [lineMods, setLineMods] = useState({});   // lineKey -> [mod codes]
  const [designMode, setDesignMode] = useState('auto');   // 'auto' (solver) | 'manual' (Design Studio)
  const [manualItems, setManualItems] = useState([]);     // hand-placed cabinets/appliances
  const [ghostResult, setGhostResult] = useState(null);   // live solver preview for the room canvas
  const [trainingScore, setTrainingScore] = useState(null);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState(null);

  // ── Project (dealer workflow): metadata, save/load, revisions ──
  const [projectId, setProjectId] = useState(null);
  const [projectMeta, setProjectMeta] = useState({ name: '', customer: '', jobNumber: '', address: '', designer: '' });
  const [revisions, setRevisions] = useState([]);   // newest first; persisted per-project
  const [showProjects, setShowProjects] = useState(false);
  const [saveFlash, setSaveFlash] = useState('');
  const [, setProjectsVersion] = useState(0);  // bump to refresh the projects dialog list

  // Full designer state snapshot — everything needed to reproduce a design.
  const collectState = () => ({
    layoutType, roomType, walls, appliances, island, peninsula, prefs,
    materials, selectedBrandAppliances, countertopSelection, trimSelections, selectedTemplate, orderSpec, lineMods,
    designMode, manualItems,
  });
  const applyState = (s) => {
    if (!s) return;
    setLayoutType(s.layoutType || 'l-shape'); setRoomType(s.roomType || 'kitchen');
    setWalls(s.walls || []); setAppliances(s.appliances || []);
    setIsland(s.island || null); setPeninsula(s.peninsula || null);
    setPrefs(p => ({ ...p, ...(s.prefs || {}) }));
    setMaterials(m => ({ ...m, ...(s.materials || {}) }));
    setSelectedBrandAppliances(s.selectedBrandAppliances || []);
    setCountertopSelection(c => ({ ...c, ...(s.countertopSelection || {}) }));
    setTrimSelections(t => ({ ...t, ...(s.trimSelections || {}) }));
    setSelectedTemplate(s.selectedTemplate || null);
    if (s.orderSpec) setOrderSpec(o => ({ ...o, ...s.orderSpec }));
    setLineMods(s.lineMods || {});
    setDesignMode(s.designMode || 'auto');
    setManualItems(s.manualItems || []);
    setSolverResult(null); setQuote(null); setView('designer');
  };

  const handleSaveProject = () => {
    const id = projectId || newProjectId();
    const name = projectMeta.name || projectMeta.customer || `${roomType} ${new Date().toLocaleDateString('en-US')}`;
    const ok = saveProject({ id, name, meta: projectMeta, state: collectState() });
    if (!projectId) setProjectId(id);
    setSaveFlash(ok ? 'Saved ✓' : 'Save failed');
    setTimeout(() => setSaveFlash(''), 2000);
  };
  const handleLoadProject = (id) => {
    const p = loadProject(id);
    if (!p) return;
    setProjectId(p.id);
    setProjectMeta({ name: p.name, customer: '', jobNumber: '', address: '', designer: '', ...(p.meta || {}) });
    setRevisions(p.revisions || []);
    applyState(p.state);
    setShowProjects(false);
    setStep(0);
  };
  const handleNewProject = () => {
    setProjectId(null);
    setProjectMeta({ name: '', customer: '', jobNumber: '', address: '', designer: projectMeta.designer || '' });
    setRevisions([]);
    setShowProjects(false);
  };
  const handleRestoreRevision = (rev) => {
    applyState(rev.state);
  };

  const speciesPct = SPECIES_PCT[materials.species] || 0;
  const doorInfo = DOORS.find(d => d.v === materials.door);
  const constPct = CONSTRUCTION_PCT[materials.construction] || 0;
  const applianceTotal = selectedBrandAppliances.reduce((s, a) => s + (a.msrp || 0), 0);
  const countertopEstimate = countertopSelection.colorId
    ? estimateCountertopCost(countertopSelection.colorId, countertopSelection.sqft || 40, countertopSelection.edge || 'straight', countertopSelection.cutouts || 1)
    : null;

  // Room-shape templates for the Design Studio: switch the footprint while
  // preserving wall lengths/openings/measure-grades where walls carry over;
  // hand-placed items on removed walls are dropped.
  const applyShape = useCallback((shape) => {
    const counts = { 'single-wall': 1, 'galley': 2, 'l-shape': 2, 'u-shape': 3, 'g-shape': 4 };
    const n = counts[shape] || 2;
    const defaults = [144, 120, 96, 84];
    const next = Array.from({ length: n }, (_, i) =>
      walls[i] ? { ...walls[i] } : { id: String.fromCharCode(65 + i), length: defaults[i], role: 'general' });
    const keep = new Set(next.map(w => w.id));
    setWalls(next);
    setLayoutType(shape);
    setManualItems(items => items.filter(i => keep.has(i.wall)));
  }, [walls]);

  // Live solver ghost for the room canvas (auto mode): debounce-solve as the
  // designer drags walls so the cabinet layout previews in place.
  useEffect(() => {
    if (designMode !== 'auto' || step !== 0 || !walls.length) { setGhostResult(null); return; }
    const t = setTimeout(() => {
      try {
        const ceilH = Number(prefs.ceilingHeight) || 96;
        const r = solve({ layoutType, roomType, walls: walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || ceilH })), appliances, prefs, ...(island ? { island } : {}) });
        setGhostResult(r);
      } catch { setGhostResult(null); }
    }, 500);
    return () => clearTimeout(t);
  }, [designMode, step, walls, appliances, island, layoutType, roomType, prefs]);

  // Apply template
  const handleTemplateSelect = useCallback((templateId) => {
    const tmpl = getTemplate(templateId);
    if (!tmpl) return;
    setSelectedTemplate(templateId);
    setLayoutType(tmpl.input.layoutType);
    setRoomType(tmpl.input.roomType);
    setWalls(tmpl.input.walls);
    setAppliances(tmpl.input.appliances || []);
    setIsland(tmpl.input.island || null);
    setPeninsula(tmpl.input.peninsula || null);
    if (tmpl.input.prefs) {
      setPrefs(p => ({ ...p, ...tmpl.input.prefs }));
    }
  }, []);

  // Price (or re-price) a solved design — used by handleSolve and whenever
  // per-line modifications change (mods reprice without a re-solve).
  const priceDesign = useCallback((result, mods) => {
    const { cabinets, fabrication } = buildPricingPlacements(result.placements || [], mods);
    setPricingBrand(materials.brand);
    const quoteResult = calculateLayoutPrice(cabinets, {
      species: materials.species, construction: materials.construction,
      door: materials.door, drawerFront: 'DF-' + materials.door, drawerBox: '5/8-STD',
      profile: pricingProfileOf(materials.frameStyle),
    }, findSkuNormalized);
    quoteResult.fabrication = priceFabricationItems(fabrication);
    return quoteResult;
  }, [materials]);

  useEffect(() => {
    if (solverResult) setQuote(priceDesign(solverResult, lineMods));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineMods]);

  const handleSolve = useCallback(() => {
    setSolving(true);
    setError(null);

    try {
      // Ceiling height lives in prefs; the solver + elevation read it per-wall,
      // so inject it onto each wall before solving (else it defaults to 96").
      const ceilH = Number(prefs.ceilingHeight) || 96;
      const wallsC = walls.map(w => ({ ...w, ceilingHeight: w.ceilingHeight || ceilH }));
      const input = { layoutType, roomType, walls: wallsC, appliances, prefs };
      if (island) input.island = island;
      if (peninsula) input.peninsula = peninsula;

      const result = designMode === 'manual'
        ? buildManualResult({ walls: wallsC, items: manualItems, island, roomType, layoutType })
        : solve(input);

      // Ensure _inputWalls carries id/length AND ceilingHeight for the views
      // (FloorPlanView / ElevationView CLG line). The solver reduces
      // ceilingHeight internally on soffited walls; the drawings want the TRUE
      // ceiling (_realCeilingHeight) with the soffit drawn explicitly.
      result._inputWalls = (result._inputWalls || wallsC).map(w => ({
        ...w, id: w.id, length: w.length,
        ceilingHeight: w._realCeilingHeight || w.ceilingHeight || ceilH,
      }));
      // Also ensure result.walls items have .id and .length aliases for views
      if (result.walls && result.walls[0] && !result.walls[0].id) {
        result.walls.forEach(w => {
          w.id = w.wallId;
          w.length = w.wallLength;
        });
      }

      setSolverResult(result);

      const score = designMode === 'manual' ? null : scoreAgainstTraining(result);
      setTrainingScore(score);

      const quoteResult = priceDesign(result, lineMods);
      setQuote(quoteResult);

      // Record this solve as a revision (newest first). Persists when a
      // project is active; otherwise stays in-session.
      const snapshot = {
        label: `${result.layoutType || layoutType} · ${materials.species}${materials.brand === 'shiloh' ? ' · Shiloh' : ''}`,
        cabinetCount: result.metadata?.totalCabinets || (result.placements || []).filter(x => x.type !== 'appliance').length,
        subtotal: (quoteResult.subtotal || 0) + (quoteResult.fabrication?.subtotal || 0),
        state: { layoutType, roomType, walls, appliances, island, peninsula, prefs,
          materials, selectedBrandAppliances, countertopSelection, trimSelections, selectedTemplate },
      };
      setRevisions(prev => [{ at: Date.now(), ...snapshot }, ...prev].slice(0, 20));
      if (projectId) addRevision(projectId, snapshot);

      setView('results');
    } catch (err) {
      setError(err.message);
      console.error('Solver error:', err);
    }
    setSolving(false);
  }, [layoutType, roomType, walls, appliances, prefs, materials, island, peninsula,
      selectedBrandAppliances, countertopSelection, trimSelections, selectedTemplate, projectId, lineMods, priceDesign,
      designMode, manualItems]);

  const STEPS = ['Layout', 'Materials', 'Appliances', 'Countertops', 'Trim & Molding', 'Review'];

  return (
    <div style={{ fontFamily: "'Questrial', 'Helvetica Neue', Arial, sans-serif", color: C.text, background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: C.surface, borderTop: `3px solid ${C.gold}`, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
            <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', color: C.gold, fontWeight: 600 }}>Pinnacle Sales</span>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 600, letterSpacing: 0.3 }}>Eclipse Kitchen Designer</h1>
          </div>
          <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 3, fontSize: 11, fontWeight: 600, letterSpacing: 0.5, background: '#c8a96e22', color: C.accent, border: `1px solid ${C.gold}` }}>Configurator</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {(projectMeta.name || projectMeta.customer) && (
            <span style={{ fontSize: 12, color: C.muted, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong>{projectMeta.name || projectMeta.customer}</strong>
              {projectMeta.jobNumber ? ` · #${projectMeta.jobNumber}` : ''}
            </span>
          )}
          {saveFlash && <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{saveFlash}</span>}
          <button onClick={handleSaveProject} style={{ ...btnOutline, padding: '5px 12px', fontSize: 12 }}>Save</button>
          <button onClick={() => setShowProjects(true)} style={{ ...btnOutline, padding: '5px 12px', fontSize: 12 }}>Projects</button>
        </div>
      </header>

      {/* ── Projects dialog ── */}
      {showProjects && (
        <div onClick={() => setShowProjects(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: C.bg, borderRadius: 10, border: `1px solid ${C.border}`, width: 520, maxHeight: '70vh', overflow: 'auto', padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>Projects</h3>
              <button onClick={handleNewProject} style={{ ...btnPrimary, padding: '5px 12px', fontSize: 12 }}>+ New Project</button>
            </div>
            {listProjects().length === 0 && (
              <p style={{ fontSize: 13, color: C.dim }}>No saved projects yet. Configure a design and click Save.</p>
            )}
            {listProjects().map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px', borderBottom: `1px solid ${C.border}`, background: p.id === projectId ? '#c8a96e15' : 'transparent', borderRadius: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name}{p.id === projectId ? '  (open)' : ''}</div>
                  <div style={{ fontSize: 11, color: C.dim }}>
                    {[p.meta?.customer, p.meta?.jobNumber && `#${p.meta.jobNumber}`].filter(Boolean).join(' · ') || '—'}
                    {' · '}{p.revisionCount} rev{p.revisionCount === 1 ? '' : 's'}
                    {' · '}{new Date(p.updatedAt).toLocaleDateString('en-US')}
                  </div>
                </div>
                <button onClick={() => handleLoadProject(p.id)} style={{ ...btnPrimary, padding: '4px 12px', fontSize: 11 }}>Open</button>
                <button onClick={() => { if (confirm(`Delete project "${p.name}"? This cannot be undone.`)) { deleteProject(p.id); if (p.id === projectId) handleNewProject(); setProjectsVersion(v => v + 1); } }}
                  style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            ))}
            <p style={{ fontSize: 10, color: C.dim, marginTop: 10 }}>Projects are saved in this browser. Export the PDF for a portable record.</p>
          </div>
        </div>
      )}

      {/* Main */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        {view === 'results' ? (
          <ResultsView solverResult={solverResult} quote={quote} trainingScore={trainingScore}
            applianceTotal={applianceTotal} countertopEstimate={countertopEstimate}
            materials={materials} selectedAppliances={selectedBrandAppliances}
            countertopColor={countertopSelection.colorId ? getColorById(countertopSelection.colorId) : null}
            prefs={prefs} trimSelections={trimSelections}
            projectMeta={projectMeta} revisions={revisions} onRestoreRevision={handleRestoreRevision}
            walls={walls} orderSpec={orderSpec}
            lineMods={lineMods} onChangeLineMods={setLineMods}
            onEditInStudio={() => {
              setManualItems(seedFromSolverResult(solverResult));
              setDesignMode('manual');
              setView('designer'); setStep(0);
            }}
            onBack={() => { setView('designer'); setStep(5); }} />
        ) : (
          <>
            <StepIndicator steps={STEPS} current={step} onStep={setStep} />

            {/* ═══ STEP 0: LAYOUT ═══ */}
            {step === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
                <div>
                  {/* ── Design mode: solver-designed vs hand-designed (2020-style) ── */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                    {[['auto', 'App designs it', 'Pick a template, set the room — the solver lays out the cabinets.'],
                      ['manual', 'Design Studio — I\'ll design it', 'Draw the room and place every cabinet yourself from the catalog (2020-style).']].map(([m, label, hint]) => (
                      <button key={m} onClick={() => setDesignMode(m)} title={hint}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                          border: `2px solid ${designMode === m ? C.accent : C.border}`,
                          background: designMode === m ? '#c8a96e22' : C.bg, color: designMode === m ? C.accent : C.muted }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {designMode === 'manual' ? (
                    <DesignStudio walls={walls} onWallsChange={setWalls}
                      items={manualItems} onItemsChange={setManualItems}
                      brand={materials.brand} mode="full"
                      layoutType={layoutType} onApplyShape={applyShape} />
                  ) : (
                    <>
                      <TemplatePicker onSelect={handleTemplateSelect} selected={selectedTemplate} />
                      {selectedTemplate && (
                        <DimensionAdjuster walls={walls} onChange={setWalls}
                          island={island} onIslandChange={setIsland}
                          peninsula={peninsula} onPeninsulaChange={setPeninsula} />
                      )}
                      <div style={{ marginTop: 14 }}>
                        <DesignStudio walls={walls} onWallsChange={setWalls}
                          items={[]} onItemsChange={() => {}}
                          brand={materials.brand} mode="room" ghost={ghostResult} />
                        <p style={{ fontSize: 10.5, color: C.dim, margin: '6px 0 0' }}>
                          Room canvas: drag wall ends, click a dimension to type the laser number, drag windows/doors. The dashed boxes are the solver's live layout preview.
                        </p>
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <div style={panelStyle}>
                    <div style={sectionTitle}>Project Info</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {[
                        ['name', 'Project name', 'Smith Kitchen Remodel'],
                        ['customer', 'Customer', 'John & Amy Smith'],
                        ['jobNumber', 'Job #', 'J-1042'],
                        ['designer', 'Designer', 'Your name'],
                      ].map(([k, label, ph]) => (
                        <div key={k}>
                          <label style={labelStyle}>{label}</label>
                          <input value={projectMeta[k] || ''} placeholder={ph}
                            onChange={e => setProjectMeta(m => ({ ...m, [k]: e.target.value }))} style={inputStyle} />
                        </div>
                      ))}
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Job address</label>
                        <input value={projectMeta.address || ''} placeholder="123 Main St, City"
                          onChange={e => setProjectMeta(m => ({ ...m, address: e.target.value }))} style={inputStyle} />
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: C.dim, margin: '6px 0 0' }}>Appears on every drawing's title block and the PDF packet.</p>
                  </div>
                  <div style={panelStyle}>
                    <div style={sectionTitle}>Manual Override</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <label style={labelStyle}>Layout Type</label>
                        <select value={layoutType} onChange={e => setLayoutType(e.target.value)} style={inputStyle}>
                          {LAYOUT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Room Type</label>
                        <select value={roomType} onChange={e => setRoomType(e.target.value)} style={inputStyle}>
                          {ROOM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                  <WallEditor walls={walls} onChange={setWalls} />
                  <ApplianceEditor appliances={appliances} walls={walls} onChange={setAppliances} />

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => setStep(1)} style={btnPrimary}>Next: Materials &rarr;</button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ STEP 1: MATERIALS ═══ */}
            {step === 1 && (
              <div style={{ maxWidth: 700, margin: '0 auto' }}>
                <div style={panelStyle}>
                  <div style={sectionTitle}>Materials & Pricing</div>

                  {/* ── Cabinet line + framed/inset construction ── */}
                  <div style={{ marginBottom: 12, padding: '10px', background: C.bg, borderRadius: 6, border: `1px solid ${C.border}` }}>
                    <label style={{ ...labelStyle, marginBottom: 6 }}>Cabinet Line</label>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {BRANDS.map(b => {
                        const active = (materials.brand || 'eclipse') === b.id;
                        return (
                          <button key={b.id} onClick={() => setMaterials(m => ({ ...m, brand: b.id, frameStyle: DEFAULT_CONSTRUCTION_BY_BRAND[b.id] }))}
                            style={{ flex: 1, padding: '7px 6px', borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                              border: `1px solid ${active ? C.primary : C.border}`, background: active ? '#c8a96e22' : 'transparent', color: active ? C.text : C.muted }}>
                            <div style={{ fontSize: 12, fontWeight: 700 }}>{b.label}</div>
                            <div style={{ fontSize: 10, color: C.dim }}>{b.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                    <label style={labelStyle}>Construction</label>
                    <select value={materials.frameStyle || 'eclipse_frameless'} onChange={e => setMaterials(m => ({ ...m, frameStyle: e.target.value }))} style={inputStyle}>
                      {(CONSTRUCTIONS_BY_BRAND[materials.brand || 'eclipse'] || ['eclipse_frameless']).map(k => (
                        <option key={k} value={k}>{CONSTRUCTIONS[k].label}</option>
                      ))}
                    </select>
                    <div style={{ fontSize: 10, color: C.dim, marginTop: 5 }}>
                      {getConstruction(materials.frameStyle).frame
                        ? `Framed face-frame line. Doors ${getConstruction(materials.frameStyle).inset ? 'inset within the frame' : 'overlay the frame'}.`
                        : 'Frameless (full overlay) — European, no face frame, maximized openings.'}
                      {materials.brand === 'shiloh' && <span style={{ color: C.accent }}>{`  · Pricing from Shiloh catalog v3.42 (${SHILOH_SKU_COUNT} SKUs scraped) — interim, pending CSV verification.`}</span>}
                    </div>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Species {speciesPct !== 0 && <span style={{ color: speciesPct > 0 ? C.warn : C.accent }}>({speciesPct > 0 ? '+' : ''}{speciesPct}%)</span>}</label>
                    <select value={materials.species} onChange={e => { const sp = e.target.value; const cols = FINISH_COLORS[sp] || []; setMaterials(m => ({ ...m, species: sp, finishColor: cols.includes(m.finishColor) ? m.finishColor : (cols[0] || '') })); }} style={inputStyle}>
                      {speciesNames.map(s => {
                        const pct = SPECIES_PCT[s];
                        return <option key={s} value={s}>{s}{pct !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}</option>;
                      })}
                    </select>
                  </div>

                  {(FINISH_COLORS[materials.species] || []).length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Finish Color</label>
                    <select value={materials.finishColor || ''} onChange={e => setMaterials(m => ({ ...m, finishColor: e.target.value }))} style={inputStyle}>
                      {(FINISH_COLORS[materials.species] || []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: C.dim, cursor: 'pointer' }}>
                      <input type="checkbox" checked={!!materials.grainHorizontal}
                        onChange={e => setMaterials(m => ({ ...m, grainHorizontal: e.target.checked }))} />
                      Horizontal grain (default: vertical)
                    </label>
                  </div>
                  )}

                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Hardware</label>
                    <select value={materials.hardware || 'knob'} onChange={e => setMaterials(m => ({ ...m, hardware: e.target.value }))} style={inputStyle}>
                      <option value="knob">Knob</option>
                      <option value="bar">Bar Pull</option>
                    </select>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Door Style {doorInfo && <span style={{ color: C.dim }}>(Group {doorInfo.g})</span>}</label>
                    <select value={materials.door} onChange={e => setMaterials(m => ({ ...m, door: e.target.value }))} style={inputStyle}>
                      {doorOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Construction {constPct > 0 && <span style={{ color: C.warn }}>(+{constPct}%)</span>}</label>
                    <select value={materials.construction} onChange={e => setMaterials(m => ({ ...m, construction: e.target.value }))} style={inputStyle}>
                      {constructionOptions.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Island Species Override</span>
                      <span style={{ fontSize: 10, color: C.dim }}>(two-tone)</span>
                    </label>
                    <select value={materials.islandSpecies} onChange={e => setMaterials(m => ({ ...m, islandSpecies: e.target.value }))} style={inputStyle}>
                      <option value="">Same as perimeter</option>
                      {speciesNames.map(s => {
                        const pct = SPECIES_PCT[s];
                        return <option key={s} value={s}>{s}{pct !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}</option>;
                      })}
                    </select>
                    {materials.islandSpecies && materials.islandSpecies !== materials.species && (
                      <div style={{ marginTop: 6, padding: '6px 10px', background: C.bg, borderRadius: 4, fontSize: 11, color: C.muted }}>
                        Perimeter: <strong>{materials.species}</strong> &rarr; Island: <strong>{materials.islandSpecies}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preferences */}
                <div style={panelStyle}>
                  <div style={sectionTitle}>Preferences</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Sophistication</label>
                      <select value={prefs.sophistication} onChange={e => setPrefs(p => ({ ...p, sophistication: e.target.value }))} style={inputStyle}>
                        {SOPH_LEVELS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Ceiling Height (in)</label>
                      <input type="number" value={prefs.ceilingHeight} onChange={e => setPrefs(p => ({ ...p, ceilingHeight: Number(e.target.value) }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Corner Treatment</label>
                      <select value={prefs.cornerTreatment} onChange={e => setPrefs(p => ({ ...p, cornerTreatment: e.target.value }))} style={inputStyle}>
                        {CORNER_TREATMENTS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>
                      <label style={{ fontSize: 12, color: C.dim, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={prefs.preferDrawerBases} onChange={e => setPrefs(p => ({ ...p, preferDrawerBases: e.target.checked }))} />
                        Prefer Drawer Bases
                      </label>
                      <label style={{ fontSize: 12, color: prefs.golaChannel ? '#c4b5fd' : C.dim, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: prefs.golaChannel ? 600 : 400 }}>
                        <input type="checkbox" checked={prefs.golaChannel} onChange={e => setPrefs(p => ({ ...p, golaChannel: e.target.checked }))} />
                        Gola / Handleless Channel
                      </label>
                      <label style={{ fontSize: 12, color: prefs.featureHood ? C.gold : C.dim, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: prefs.featureHood ? 600 : 400 }} title="Removes the wall cabinets flanking the range so the hood stands on open wall as a feature. Lowers the cabinet count and the quote.">
                        <input type="checkbox" checked={prefs.featureHood} onChange={e => setPrefs(p => ({ ...p, featureHood: e.target.checked }))} />
                        Feature the hood (no flanking wall cabinets)
                      </label>
                    </div>
                  </div>
                  {prefs.golaChannel && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#7a6f9b22', borderRadius: 6, border: `1px solid ${C.purple}`, fontSize: 11, color: '#c4b5fd' }}>
                      Gola mode: FC- prefix cabinets, no wall cabinets, B2TD drawer bases dominant, dishwasher door panel (DP) auto-included.
                    </div>
                  )}
                  {prefs.featureHood && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#c8a96e22', borderRadius: 6, border: `1px solid ${C.gold}`, fontSize: 11, color: C.text }}>
                      Feature wall: the wall cabinets flanking the range are removed so the hood (esp. a sculptural plaster hood) stands on open wall. This lowers the cabinet count and the quote. Pair with a full-height slab backsplash for the current look.
                    </div>
                  )}
                </div>

                {/* ── W.W. Wood cover-sheet spec: the global style rules the order form requires ── */}
                <div style={panelStyle}>
                  <div style={sectionTitle}>Order Spec — Cover Sheet Fields</div>
                  <p style={{ fontSize: 11, color: C.dim, margin: '0 0 10px' }}>
                    These complete the W.W. Wood standard order cover sheet ({materials.brand === 'shiloh' ? 'SHI-SO-CS' : 'ECL-SO-CS'}). Defaults match the most common spec.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <div><label style={labelStyle}>Glaze</label>
                      <select value={orderSpec.glaze} onChange={e => setOrderSpec(o => ({ ...o, glaze: e.target.value }))} style={inputStyle}>
                        {GLAZES.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
                      </select></div>
                    <div><label style={labelStyle}>Highlight</label>
                      <select value={orderSpec.highlight} onChange={e => setOrderSpec(o => ({ ...o, highlight: e.target.value }))} style={inputStyle}>
                        {HIGHLIGHTS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
                      </select></div>
                    <div><label style={labelStyle}>Character Technique</label>
                      <select value={orderSpec.charTechniques} onChange={e => setOrderSpec(o => ({ ...o, charTechniques: e.target.value }))} style={inputStyle}>
                        {CHAR_TECHNIQUES.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
                      </select></div>
                    <div><label style={labelStyle}>Interior Finish</label>
                      <select value={orderSpec.interiorFinish} onChange={e => setOrderSpec(o => ({ ...o, interiorFinish: e.target.value }))} style={inputStyle}>
                        {INTERIORS.map(g => <option key={g.v} value={g.v}>{g.l}</option>)}
                      </select></div>
                    <div><label style={labelStyle}>Upper Door (if different)</label>
                      <select value={orderSpec.upperDoor} onChange={e => setOrderSpec(o => ({ ...o, upperDoor: e.target.value }))} style={inputStyle}>
                        <option value="">Same as lower ({materials.door})</option>
                        {doorOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select></div>
                    <div><label style={labelStyle}>Edge Profile / Banding</label>
                      <input value={orderSpec.edgeProfile} onChange={e => setOrderSpec(o => ({ ...o, edgeProfile: e.target.value }))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Drawer Box</label>
                      <input value={orderSpec.drawerBox} onChange={e => setOrderSpec(o => ({ ...o, drawerBox: e.target.value }))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Drawer Guide</label>
                      <input value={orderSpec.drawerGuide} onChange={e => setOrderSpec(o => ({ ...o, drawerGuide: e.target.value }))} style={inputStyle} /></div>
                    <div style={{ display: 'flex', alignItems: 'end', paddingBottom: 8 }}>
                      <label style={{ fontSize: 12, color: C.text, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
                        <input type="checkbox" checked={!!orderSpec.tipOn} onChange={e => setOrderSpec(o => ({ ...o, tipOn: e.target.checked }))} />
                        Tip-On (all doors &amp; drawers)
                      </label>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                    <div><label style={labelStyle}>Dealership (Business Name)</label>
                      <input value={orderSpec.businessName} placeholder="Your dealership" onChange={e => setOrderSpec(o => ({ ...o, businessName: e.target.value }))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>W.W. Wood Customer #</label>
                      <input value={orderSpec.customerNumber} placeholder="e.g. 5028" onChange={e => setOrderSpec(o => ({ ...o, customerNumber: e.target.value }))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Contact Phone</label>
                      <input value={orderSpec.contactPhone} onChange={e => setOrderSpec(o => ({ ...o, contactPhone: e.target.value }))} style={inputStyle} /></div>
                    <div><label style={labelStyle}>Contact Email</label>
                      <input value={orderSpec.contactEmail} onChange={e => setOrderSpec(o => ({ ...o, contactEmail: e.target.value }))} style={inputStyle} /></div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => setStep(0)} style={btnOutline}>&larr; Layout</button>
                  <button onClick={() => setStep(2)} style={btnPrimary}>Next: Appliances &rarr;</button>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: APPLIANCES ═══ */}
            {step === 2 && (() => {
              // Layout-driven recommendation, computed live from the current room
              // (no solve needed) so the user can adopt a whole package per tier.
              const rec = recommendAppliances({ layoutType, walls, island });
              const usePackage = (tier) => {
                const items = rec?.packageByTier?.[tier]?.items || [];
                const picked = items
                  .map(it => APPLIANCES.find(a => a.brand === it.brandId && a.model === it.model))
                  .filter(Boolean)
                  .map(app => ({ ...app, finish: app.panelReady ? 'panel' : 'ss' }));
                if (picked.length) {
                  setSelectedBrandAppliances(picked);
                  setApplianceTier(tier);
                }
              };
              return (
                <div style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
                  <div>
                    <ApplianceBrandPicker selectedAppliances={selectedBrandAppliances} onChange={(v) => { setSelectedBrandAppliances(v); setApplianceTier(null); }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                      <button onClick={() => setStep(1)} style={btnOutline}>&larr; Materials</button>
                      <button onClick={() => setStep(3)} style={btnPrimary}>Next: Countertops &rarr;</button>
                    </div>
                  </div>
                  <ApplianceRecommendationPanel recommendation={rec} onUsePackage={usePackage} selectedTier={applianceTier} />
                </div>
              );
            })()}

            {/* ═══ STEP 3: COUNTERTOPS ═══ */}
            {step === 3 && (
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <CountertopPicker selection={countertopSelection} onChange={setCountertopSelection} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => setStep(2)} style={btnOutline}>&larr; Appliances</button>
                  <button onClick={() => setStep(4)} style={btnPrimary}>Next: Trim & Molding &rarr;</button>
                </div>
              </div>
            )}

            {/* ═══ STEP 4: TRIM & MOLDING ═══ */}
            {step === 4 && (
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <TrimPicker selections={trimSelections} onChange={setTrimSelections} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => setStep(3)} style={btnOutline}>&larr; Countertops</button>
                  <button onClick={() => setStep(5)} style={btnPrimary}>Next: Review &rarr;</button>
                </div>
              </div>
            )}

            {/* ═══ STEP 5: REVIEW + SOLVE ═══ */}
            {step === 5 && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div style={panelStyle}>
                    <div style={sectionTitle}>Layout</div>
                    <div style={{ fontSize: 13, marginBottom: 4 }}><strong>{selectedTemplate ? TEMPLATES.find(t => t.id === selectedTemplate)?.name : 'Custom'}</strong></div>
                    <div style={{ fontSize: 12, color: C.dim }}>
                      {layoutType} / {roomType} — {walls.length} wall{walls.length > 1 ? 's' : ''} ({walls.map(w => `${w.id}:${w.length}"`).join(', ')})
                    </div>
                    {island && <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>Island: {island.length}" x {island.depth}"</div>}
                    {peninsula && <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>Peninsula: {peninsula.length}" x {peninsula.depth}"</div>}
                    <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>Appliances: {appliances.length} ({appliances.map(a => a.type).join(', ')})</div>
                  </div>

                  <div style={panelStyle}>
                    <div style={sectionTitle}>Materials</div>
                    <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.8 }}>
                      <div>Species: <strong style={{ color: C.text }}>{materials.species}</strong> {speciesPct !== 0 && <span style={{ color: speciesPct > 0 ? C.warn : C.accent }}>({speciesPct > 0 ? '+' : ''}{speciesPct}%)</span>}</div>
                      <div>Door: <strong style={{ color: C.text }}>{materials.door}</strong> {doorInfo && <span>(Group {doorInfo.g})</span>}</div>
                      <div>Construction: <strong style={{ color: C.text }}>{materials.construction}</strong> {constPct > 0 && <span style={{ color: C.warn }}>(+{constPct}%)</span>}</div>
                      <div>Style: <strong style={{ color: prefs.golaChannel ? '#c4b5fd' : C.text }}>{prefs.golaChannel ? 'Gola / Handleless' : 'Regular'}</strong></div>
                    </div>
                  </div>

                  <div style={panelStyle}>
                    <div style={sectionTitle}>Appliances</div>
                    {selectedBrandAppliances.length === 0 ? (
                      <div style={{ fontSize: 12, color: C.dim }}>No brand appliances selected (solver defaults apply)</div>
                    ) : (
                      <div>
                        {selectedBrandAppliances.map(a => (
                          <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
                            <span>{a.model} ({a.finish === 'panel' ? 'Panel' : 'SS'})</span>
                            <span style={{ color: C.accent }}>{formatCurrency(a.msrp)}</span>
                          </div>
                        ))}
                        <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}`, color: C.accent }}>
                          Total: {formatCurrency(applianceTotal)}
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={panelStyle}>
                    <div style={sectionTitle}>Countertops</div>
                    {!countertopSelection.colorId ? (
                      <div style={{ fontSize: 12, color: C.dim }}>No countertop selected</div>
                    ) : (() => {
                      const color = getColorById(countertopSelection.colorId);
                      return (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <div style={{ width: 24, height: 24, borderRadius: 4, background: color.hex, border: `1px solid ${C.border}` }} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{color.name}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.dim }}>
                            {COUNTERTOP_BRANDS[color.brand]} / {color.collection} / {countertopSelection.sqft} sqft
                          </div>
                          {countertopEstimate && (
                            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: C.accent }}>
                              {formatCurrency(countertopEstimate.totalLow)} – {formatCurrency(countertopEstimate.totalHigh)}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ ...panelStyle, gridColumn: '1 / -1' }}>
                    <div style={sectionTitle}>Trim & Molding</div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: C.dim }}>
                      {trimSelections.toeKick && <span style={{ padding: '3px 8px', background: '#c8a96e22', borderRadius: 4, border: `1px solid ${C.primary}` }}>Toe Kick (TK-N/C)</span>}
                      {trimSelections.crown && <span style={{ padding: '3px 8px', background: '#c8a96e22', borderRadius: 4, border: `1px solid ${C.primary}` }}>
                        {trimSelections.crownProfile === 'furniture' ? 'Furniture Crown (3FCR)' : 'Crown Mould (3 1/2CRN)'}
                      </span>}
                      {trimSelections.lightRail && <span style={{ padding: '3px 8px', background: '#c8a96e22', borderRadius: 4, border: `1px solid ${C.primary}` }}>Light Rail (1 3/4 UCA)</span>}
                      {trimSelections.traditionalTrim && <span style={{ padding: '3px 8px', background: '#c8a96e22', borderRadius: 4, border: `1px solid ${C.primary}` }}>Traditional Trim (7/8TD)</span>}
                      {trimSelections.countertopEdge && <span style={{ padding: '3px 8px', background: '#c8a96e22', borderRadius: 4, border: `1px solid ${C.primary}` }}>Countertop Edge</span>}
                      {!trimSelections.toeKick && !trimSelections.crown && !trimSelections.lightRail && !trimSelections.traditionalTrim && (
                        <span style={{ color: C.dim }}>No trim selected</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div style={{ background: '#451a1a', border: `1px solid ${C.danger}`, borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#fca5a5' }}>
                    {error}
                  </div>
                )}

                {/* Solve button */}
                <button onClick={handleSolve} disabled={solving}
                  style={{ width: '100%', padding: 16, background: solving ? C.surface2 : C.primary, border: 'none', color: '#fff', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: solving ? 'wait' : 'pointer', marginBottom: 8 }}>
                  {solving ? 'Solving...' : 'Solve Layout + Generate Full Quote'}
                </button>

                <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 8 }}>
                  <button onClick={() => setStep(4)} style={btnOutline}>&larr; Trim & Molding</button>
                </div>

                {/* Quick info */}
                <div style={{ ...panelStyle, fontSize: 11, color: C.dim, padding: 12, marginTop: 12 }}>
                  <div>Direct solver mode — no backend or auth required.</div>
                  <div style={{ marginTop: 4 }}>Engine: 7-phase solver / 4,262+ SKUs / 53 training profiles / {TEMPLATES.length} templates</div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
