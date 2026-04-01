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
import {
  findSku, searchSkus, calculateLayoutPrice, formatCurrency,
  SPECIES_PCT, CONSTRUCTION_PCT, DOORS, DRAWER_FRONTS, DRAWER_BOXES,
  guessDoors, guessDrawerCount, guessBuiltInROT,
} from '../../eclipse-pricing/src/index.js';

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
import FloorPlanView from './FloorPlanView.jsx';
import ElevationView from './ElevationView.jsx';
import LeonardoRenderer from './LeonardoRenderer.jsx';
import { exportPDF } from './pdfExport.js';

// ── SKU normalization ──
function findSkuNormalized(sku) {
  let r = findSku(sku); if (r) return r;
  let s = sku.replace(/(\d+)\.5/g, '$1 1/2'); r = findSku(s); if (r) return r;
  s = s.replace(/-PH([LR])$/, '-PH'); r = findSku(s); if (r) return r;
  // B-RT27 → B27-RT (solver puts width after suffix, catalog puts it before)
  if (/^B-RT\d/.test(sku)) { const m = sku.match(/^B-RT(\d+)/); if (m) { r = findSku(`B${m[1]}-RT`); if (r) return r; r = findSku(`B${m[1]}-1DR-RT`); if (r) return r; } }
  // BEP3/4L-FTK → BEP3/4-FTK-L/R
  if (/^BEP3\/4[LR]-FTK/.test(sku)) { r = findSku('BEP3/4-FTK-L/R'); if (r) return r; }
  if (/^BEP3\/4[LR]$/.test(sku)) { r = findSku('BEP3/4-L/R'); if (r) return r; }
  // FWEP3/4L or FWEP3/4R → FWEP3/4-L/R-27" (try common heights)
  if (/^FWEP3\/4[LR]$/.test(sku)) { for (const h of [27,30,33,36,39,42]) { r = findSku(`FWEP3/4-L/R-${h}"`); if (r) return r; } }
  // SCRIBE-8' → search for scribe
  if (/^SCRIBE/i.test(sku)) { const results = searchSkus('SCRIBE'); if (results.length) return results[0]; r = findSku('3SRM3F-10\''); if (r) return r; }
  // DWP-24 → search for DWP
  if (/^DWP/.test(sku)) { const results = searchSkus('DWP'); if (results.length) return results[0]; }
  if (/^S?WSC\d+/.test(sku)) { const b = sku.match(/^(S?WSC\d{2})/)?.[1]; if (b) { r = findSku(b + '-PH'); if (r) return r; } }
  if (/^W\d/.test(sku)) { const m = sku.match(/^W(\d+(?:\.\d+)?)(\d{2,3})$/); if (m) { const w = m[1].replace('.5', ''); r = findSku('W' + w + m[2]); if (r) return r; r = findSku('W' + w + '36'); if (r) return r; } }
  if (/^(OVF3|F3)\d{2}/.test(sku)) { const results = searchSkus(sku.startsWith('OVF3') ? 'OVF3' : 'F3'); if (results.length) return results[0]; }
  if (/^REP/.test(sku)) { const m = sku.match(/^REP([\d./]+)\s*(\d{2,3})FTK-(\d+)/); if (m) { let t = m[1].replace('.5', ' 1/2'); r = findSku(`REP${t}-${m[3]}-L/R-${m[2]}"`); if (r) return r; const results = searchSkus('REP' + t.substring(0, 3)); const hm = results.find(x => x.s.includes(m[2] + '"')); if (hm) return hm; if (results.length) return results[0]; } }
  if (/^F[BWS]?EP/.test(sku)) { const base = sku.replace(/\s+/g, '').replace(/-(L|R)$/, '-L/R'); r = findSku(base); if (r) return r; const results = searchSkus(sku.split(/[\s-]/)[0]); if (results.length) return results[0]; }
  if (/^FC-[ST][BU]EP/.test(sku)) { const results = searchSkus(sku.match(/^FC-[A-Z]+/)?.[0] || sku.substring(0, 8)); if (results.length) return results[0]; }
  if (/^RW\d+/.test(sku)) { const m = sku.match(/^(RW\d{2})(\d{2})?-?(\d{2})?/); if (m) { const d = m[3] || m[2] || ''; r = findSku(m[1] + d); if (r) return r; const results = searchSkus(m[1]); if (results.length) return results[0]; } }
  if (/^P?RH\d/.test(sku)) { r = findSku(sku.split(/\s/)[0]); if (r) return r; }
  if (/^FC-OM\d/.test(sku)) { const m = sku.match(/^(FC-OM\d{2})/); if (m) { r = findSku(m[1]); if (r) return r; const results = searchSkus(m[1]); if (results.length) return results[0]; } }
  if (/^3SRM/.test(sku)) { r = findSku(sku.split('-')[0]); if (r) return r; }
  if (/^TU?K/.test(sku)) { const results = searchSkus(sku.substring(0, 3)); if (results.length) return results[0]; }
  if (/^(FC-)?B3?D?9$/.test(sku)) { r = findSku('B9'); if (r) return r; }
  const wm = sku.match(/^((?:FC-)?[A-Z]+\d*[A-Z]*)(\d{2})$/);
  if (wm) { const sw = [9,12,15,18,21,24,27,30,33,36,39,42]; const w = parseInt(wm[2]); if (!sw.includes(w)) { const n = sw.reduce((a,b) => Math.abs(b-w) < Math.abs(a-w) ? b : a); r = findSku(wm[1] + n); if (r) return r; } }
  if (/^BBC\d/.test(sku)) { const m = sku.match(/^(BBC\d{2})/); if (m) { r = findSku(m[1]); if (r) return r; } }
  if (/^WND\d/.test(sku)) { const m = sku.match(/^(WND\d{2})/); if (m) { r = findSku(m[1]); if (r) return r; } }
  if (/-FHD/.test(sku)) { r = findSku(sku); if (r) return r; const fm = sku.match(/^((?:FC-)?[A-Z]+)(\d{2})(-FHD)$/); if (fm) { const sw = [18,21,24,27,30,33,36,39,42]; const w = parseInt(fm[2]); if (!sw.includes(w)) { const n = sw.reduce((a,b) => Math.abs(b-w) < Math.abs(a-w) ? b : a); r = findSku(fm[1] + n + fm[3]); if (r) return r; } } }
  if (/\|/.test(sku)) { const results = searchSkus(sku.split('|')[0]); if (results.length) return results[0]; }
  if (/^(LBRK|CRN|LB)-/.test(sku)) { const results = searchSkus(sku.split('-')[0]); if (results.length) return results[0]; }
  if (/^LR/.test(sku)) { const results = searchSkus('LR'); if (results.length) return results[0]; }
  if (/^FC-/.test(sku)) { const stripped = sku.replace(/^FC-/, ''); r = findSku(stripped); if (r) return r; const sf = stripped.replace(/(\d+)\.5/g, '$1 1/2'); r = findSku(sf); if (r) return r; const results = searchSkus(stripped.substring(0, Math.min(stripped.length, 8))); if (results.length) return results[0]; }
  const fuzzy = searchSkus(sku.substring(0, Math.min(sku.length, 8))); if (fuzzy.length) return fuzzy[0];
  return null;
}

function buildPricingPlacements(placements) {
  // Include all items with SKUs. Appliances WITHOUT a sku (range, fridge, DW) are excluded.
  // Appliances WITH a sku (sink base = SB36-FHD) ARE real cabinets that must be priced.
  //
  // Exclude fabrication/labor items that don't have catalog entries:
  // TK (toe kick), CRN (crown), LR (light rail), SCRIBE, DWP (DW panel),
  // FDP/FZP (fridge panels), GRILLE, TUK (touch-up), STK-BOX, FTP, PLN,
  // FBM (furniture legs), PTKL, CEIL, VLN, LB (light bridge), DW-TK
  const FABRICATION_PREFIXES = [
    'TK-', 'CRN-', 'LR-', 'SCRIBE', 'DWP-', 'DW-TK', 'FDP-', 'FZP-',
    'GRILLE-', 'TUK-', 'STK-BOX', 'FTP-', 'PLN-', 'FBM-', 'PTKL',
    'CEIL-', 'VLN-', 'LB-', 'RH', '3SRM', 'SFLS',
  ];
  return placements.filter(p => {
    if (!p.sku) return false;
    // Skip fabrication/labor SKUs that aren't in the catalog
    if (FABRICATION_PREFIXES.some(pfx => p.sku.startsWith(pfx))) return false;
    return true;
  }).map(p => {
    const ce = findSku(p.sku);
    const tc = ce?.t || (p.sku.match(/^W/) ? 'W' : p.sku.match(/^[UOT]/) ? 'T' : 'B');
    return { sku: p.sku, qty: p.qty || 1, wall: p.wall || 'other',
      doorCount: guessDoors(p.sku, tc), drawerCount: guessDrawerCount(p.sku, tc), builtInROT: guessBuiltInROT(p.sku) };
  });
}

// ==================== THEME ====================
const C = {
  bg: '#0f172a', surface: '#1e293b', surface2: '#334155', border: '#334155',
  primary: '#3b82f6', primaryHover: '#2563eb', accent: '#10b981', danger: '#ef4444', warn: '#f59e0b',
  text: '#f1f5f9', muted: '#94a3b8', dim: '#64748b', purple: '#8b5cf6',
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
  { name: 'TFL Budget', species: 'TFL', construction: 'Standard', door: 'HNVR-FP' },
  { name: 'Maple Stock', species: 'Maple', construction: 'Standard', door: 'MET-V' },
  { name: 'Walnut Premium', species: 'Walnut', construction: 'Plywood', door: 'MET-V' },
  { name: 'White Oak Ultra', species: 'White Oak', construction: 'Plywood', door: 'ESX-M' },
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
                    background: selected === t.id ? '#1e3a5f' : C.bg,
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
function WallEditor({ walls, onChange }) {
  const add = () => onChange([...walls, { id: String.fromCharCode(65 + walls.length), length: 120, role: 'general' }]);
  const update = (i, field, val) => { const w = [...walls]; w[i] = { ...w[i], [field]: field === 'length' ? Number(val) : val }; onChange(w); };
  const remove = (i) => onChange(walls.filter((_, j) => j !== i));

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={sectionTitle}>Walls</div>
        <button onClick={add} style={{ background: C.primary, color: '#fff', border: 'none', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>+ Add</button>
      </div>
      {walls.map((w, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 80px 100px 24px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <input value={w.id} readOnly style={{ ...inputStyle, textAlign: 'center', color: C.dim }} />
          <input type="number" value={w.length} onChange={e => update(i, 'length', e.target.value)} style={inputStyle} />
          <select value={w.role || 'general'} onChange={e => update(i, 'role', e.target.value)} style={inputStyle}>
            {['general', 'range', 'sink', 'fridge', 'tall', 'pantry', 'vanity'].map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>
      ))}
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
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 50px 24px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
          <select value={a.type} onChange={e => update(i, 'type', e.target.value)} style={inputStyle}>
            {APPLIANCE_TYPES_LIST.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" value={a.width} onChange={e => update(i, 'width', e.target.value)} style={inputStyle} />
          <select value={a.wall} onChange={e => update(i, 'wall', e.target.value)} style={inputStyle}>
            {walls.map(w => <option key={w.id} value={w.id}>{w.id}</option>)}
          </select>
          <button onClick={() => remove(i)} style={{ background: 'transparent', border: 'none', color: C.danger, cursor: 'pointer', fontSize: 16 }}>x</button>
        </div>
      ))}
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
              background: isSelected ? '#1e3a5f' : C.bg, border: `1px solid ${isSelected ? C.primary : C.border}`,
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
                      background: isSelected ? '#1e3a5f' : C.bg, border: `2px solid ${isSelected ? C.primary : C.border}`,
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
          background: selections[item.key] ? '#1e3a5f20' : C.bg,
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

      {/* Crown profile sub-option */}
      {selections.crown && (
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
                  background: selections.crownProfile === opt.value ? '#1e3a5f30' : C.bg,
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
          background: score.confidence >= 80 ? '#065f4620' : score.confidence >= 60 ? '#78350f20' : '#7f1d1d20',
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
        <div style={{ marginTop: 12, padding: '8px 10px', background: gc.isGola ? '#4c1d9520' : C.bg, borderRadius: 6, border: `1px solid ${gc.isGola ? C.purple : C.border}` }}>
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
function ComparisonPricingPanel({ placements }) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const runComparison = () => {
    setLoading(true);
    const pricingItems = buildPricingPlacements(placements);
    const comparisons = COMPARE_COMBOS.map(combo => {
      const q = calculateLayoutPrice(pricingItems, {
        species: combo.species, construction: combo.construction,
        door: combo.door, drawerFront: 'DF-' + combo.door, drawerBox: '5/8-STD',
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

// ==================== RESULTS VIEW ====================
function ResultsView({ solverResult, quote, trainingScore, applianceTotal, countertopEstimate, onBack,
  materials, selectedAppliances, countertopColor, prefs, trimSelections }) {
  const [tab, setTab] = useState('floorplan');
  const [debugOverlay, setDebugOverlay] = useState(false);
  const [exporting, setExporting] = useState(false);
  if (!solverResult) return null;

  const placements = solverResult.placements || [];
  const wallGroups = {};
  placements.forEach(p => { const wall = p.wall || p.zone || 'other'; (wallGroups[wall] = wallGroups[wall] || []).push(p); });

  const cabinetTotal = quote?.subtotal || 0;
  const grandTotal = cabinetTotal + (applianceTotal || 0) + (countertopEstimate?.totalLow ? (countertopEstimate.totalLow + countertopEstimate.totalHigh) / 2 : 0);
  const isGola = placements.some(p => p.sku?.startsWith('FC-'));

  return (
    <div>
      <button onClick={onBack} style={{ ...btnOutline, marginBottom: 16 }}>Back to Designer</button>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Cabinets', value: solverResult.metadata?.totalCabinets || placements.filter(x => x.type !== 'appliance').length },
          { label: 'Layout', value: solverResult.layoutType || '-' },
          { label: 'Style', value: isGola ? 'Gola' : 'Standard' },
          { label: 'Training Match', value: trainingScore ? `${trainingScore.confidence}%` : 'N/A' },
          { label: 'Cabinetry', value: formatCurrency(cabinetTotal), accent: true },
          { label: 'Appliances', value: applianceTotal > 0 ? formatCurrency(applianceTotal) : 'N/A' },
          { label: 'Countertops', value: countertopEstimate ? `${formatCurrency(countertopEstimate.totalLow)}-${formatCurrency(countertopEstimate.totalHigh)}` : 'N/A' },
          { label: 'Est. Grand Total', value: formatCurrency(grandTotal), accent: true },
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
          { id: 'layout', label: 'Cabinet List' },
          { id: 'quote', label: 'Quote' },
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
            await exportPDF({
              title: 'Eclipse Kitchen Designer',
              layoutType: solverResult.layoutType,
              roomType: solverResult.roomType,
              materials,
              cabinetTotal,
              applianceTotal: applianceTotal || 0,
              countertopEstimate,
              formatCurrency,
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
        <div data-pdf="floorplan">
          <FloorPlanView solverResult={solverResult} inputWalls={solverResult._inputWalls} debug={debugOverlay} />
        </div>
      )}

      {/* Elevations tab */}
      {tab === 'elevations' && (
        <div>
          <ElevationView solverResult={solverResult} trim={trimSelections} debug={debugOverlay} />
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
        />
      )}

      {/* Layout tab */}
      {tab === 'layout' && Object.entries(wallGroups).map(([wall, items]) => {
        const wallTotal = quote?.byWall?.[wall] || 0;
        return (
          <div key={wall} style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14, color: C.primary }}>Wall {wall} ({items.length} items)</h4>
              {wallTotal > 0 && <span style={{ color: C.accent, fontWeight: 600, fontSize: 13 }}>{formatCurrency(wallTotal)}</span>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {items.map((p, j) => {
                const isApp = p.type === 'appliance';
                const isG = p.sku?.startsWith('FC-');
                const pricedItem = quote?.items?.find(qi => qi.sku === p.sku);
                return (
                  <div key={j} style={{
                    display: 'inline-flex', flexDirection: 'column', alignItems: 'center', padding: '6px 8px',
                    background: C.bg, border: `1px solid ${isApp ? C.accent : isG ? C.purple : C.border}`, borderRadius: 4, fontSize: 11, minWidth: 50,
                  }}>
                    <div style={{ fontWeight: 600, color: isApp ? C.accent : isG ? '#c4b5fd' : C.text, whiteSpace: 'nowrap' }}>{(p.sku || p.applianceType || p.type).replace(/^FC-/, '').substring(0, 10)}</div>
                    <div style={{ color: C.dim, fontSize: 10 }}>{p.width || ''}"</div>
                    {pricedItem?.unitPrice > 0 && <div style={{ color: C.accent, fontSize: 10, fontWeight: 500 }}>{formatCurrency(pricedItem.unitPrice)}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

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
                      {['SKU', 'Qty', 'Doors', 'Dwrs', 'Stock', 'Door Chg', 'Unit Price'].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: h === 'SKU' ? 'left' : 'right', color: C.dim, fontSize: 10, textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '5px 8px', fontFamily: 'monospace', fontSize: 11, color: item.error ? C.warn : C.text }}>{item.sku}</td>
                        {item.error ? (
                          <td colSpan={6} style={{ padding: '5px 8px', color: C.warn, fontStyle: 'italic', fontSize: 11 }}>{item.error}</td>
                        ) : (<>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.qty || 1}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.doorCount || 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right' }}>{item.drawerCount || 0}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.stockBase || 0)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{item.doorChg > 0 ? formatCurrency(item.doorChg) : '—'}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.unitPrice || 0)}</td>
                        </>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
          <div style={{ ...panelStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `2px solid ${C.primary}` }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>ESTIMATED TOTAL ({(quote.items || []).length} items)</span>
            <span style={{ color: C.accent, fontSize: 22, fontWeight: 700 }}>{formatCurrency(quote.subtotal || 0)}</span>
          </div>
        </div>
      )}

      {tab === 'training' && <TrainingScorePanel score={trainingScore} />}
      {tab === 'compare' && <ComparisonPricingPanel placements={placements} />}
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
            background: current === i ? C.primary : i < current ? '#065f4620' : C.bg,
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
    preferDrawerBases: true, golaChannel: false,
  });

  // Materials
  const [materials, setMaterials] = useState({
    species: 'Maple', door: 'MET-V', construction: 'Standard', islandSpecies: '',
  });

  // Appliance selections
  const [selectedBrandAppliances, setSelectedBrandAppliances] = useState([]);

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
  });

  // Results
  const [solverResult, setSolverResult] = useState(null);
  const [quote, setQuote] = useState(null);
  const [trainingScore, setTrainingScore] = useState(null);
  const [solving, setSolving] = useState(false);
  const [error, setError] = useState(null);

  const speciesPct = SPECIES_PCT[materials.species] || 0;
  const doorInfo = DOORS.find(d => d.v === materials.door);
  const constPct = CONSTRUCTION_PCT[materials.construction] || 0;
  const applianceTotal = selectedBrandAppliances.reduce((s, a) => s + (a.msrp || 0), 0);
  const countertopEstimate = countertopSelection.colorId
    ? estimateCountertopCost(countertopSelection.colorId, countertopSelection.sqft || 40, countertopSelection.edge || 'straight', countertopSelection.cutouts || 1)
    : null;

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

  const handleSolve = useCallback(() => {
    setSolving(true);
    setError(null);

    try {
      const input = { layoutType, roomType, walls, appliances, prefs };
      if (island) input.island = island;
      if (peninsula) input.peninsula = peninsula;

      const result = solve(input);

      // Bridge: ensure _inputWalls exists for FloorPlanView/ElevationView
      // The solver may not include _inputWalls, so build it from the input walls
      // or from result.walls (which uses wallId/wallLength instead of id/length)
      if (!result._inputWalls) {
        result._inputWalls = walls.map(w => ({ id: w.id, length: w.length }));
      }
      // Also ensure result.walls items have .id and .length aliases for views
      if (result.walls && result.walls[0] && !result.walls[0].id) {
        result.walls.forEach(w => {
          w.id = w.wallId;
          w.length = w.wallLength;
        });
      }

      setSolverResult(result);

      const score = scoreAgainstTraining(result);
      setTrainingScore(score);

      const pricingItems = buildPricingPlacements(result.placements || []);
      const quoteResult = calculateLayoutPrice(pricingItems, {
        species: materials.species, construction: materials.construction,
        door: materials.door, drawerFront: 'DF-' + materials.door, drawerBox: '5/8-STD',
      }, findSkuNormalized);
      setQuote(quoteResult);

      setView('results');
    } catch (err) {
      setError(err.message);
      console.error('Solver error:', err);
    }
    setSolving(false);
  }, [layoutType, roomType, walls, appliances, prefs, materials, island, peninsula]);

  const STEPS = ['Layout', 'Materials', 'Appliances', 'Countertops', 'Trim & Molding', 'Review'];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", color: C.text, background: C.bg, minHeight: '100vh' }}>
      {/* Header */}
      <header style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Eclipse Kitchen Designer</h1>
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#1e3a5f20', color: C.primary, border: `1px solid ${C.primary}` }}>v3 Full Configurator</span>
          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: '#065f4620', color: C.accent, border: `1px solid ${C.accent}` }}>Dev Mode</span>
        </div>
        <span style={{ fontSize: 12, color: C.dim }}>22 templates / 5 appliance brands / 5 countertop brands</span>
      </header>

      {/* Main */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
        {view === 'results' ? (
          <ResultsView solverResult={solverResult} quote={quote} trainingScore={trainingScore}
            applianceTotal={applianceTotal} countertopEstimate={countertopEstimate}
            materials={materials} selectedAppliances={selectedBrandAppliances}
            countertopColor={countertopSelection.colorId ? getColorById(countertopSelection.colorId) : null}
            prefs={prefs} trimSelections={trimSelections}
            onBack={() => { setView('designer'); setStep(5); }} />
        ) : (
          <>
            <StepIndicator steps={STEPS} current={step} onStep={setStep} />

            {/* ═══ STEP 0: LAYOUT ═══ */}
            {step === 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>
                <div>
                  <TemplatePicker onSelect={handleTemplateSelect} selected={selectedTemplate} />
                  {selectedTemplate && (
                    <DimensionAdjuster walls={walls} onChange={setWalls}
                      island={island} onIslandChange={setIsland}
                      peninsula={peninsula} onPeninsulaChange={setPeninsula} />
                  )}
                </div>
                <div>
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

                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Species {speciesPct !== 0 && <span style={{ color: speciesPct > 0 ? C.warn : C.accent }}>({speciesPct > 0 ? '+' : ''}{speciesPct}%)</span>}</label>
                    <select value={materials.species} onChange={e => setMaterials(m => ({ ...m, species: e.target.value }))} style={inputStyle}>
                      {speciesNames.map(s => {
                        const pct = SPECIES_PCT[s];
                        return <option key={s} value={s}>{s}{pct !== 0 ? ` (${pct > 0 ? '+' : ''}${pct}%)` : ''}</option>;
                      })}
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
                    </div>
                  </div>
                  {prefs.golaChannel && (
                    <div style={{ marginTop: 10, padding: '8px 10px', background: '#4c1d9520', borderRadius: 6, border: `1px solid ${C.purple}`, fontSize: 11, color: '#c4b5fd' }}>
                      Gola mode: FC- prefix cabinets, no wall cabinets, B2TD drawer bases dominant, dishwasher door panel (DP) auto-included.
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => setStep(0)} style={btnOutline}>&larr; Layout</button>
                  <button onClick={() => setStep(2)} style={btnPrimary}>Next: Appliances &rarr;</button>
                </div>
              </div>
            )}

            {/* ═══ STEP 2: APPLIANCES ═══ */}
            {step === 2 && (
              <div style={{ maxWidth: 800, margin: '0 auto' }}>
                <ApplianceBrandPicker selectedAppliances={selectedBrandAppliances} onChange={setSelectedBrandAppliances} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <button onClick={() => setStep(1)} style={btnOutline}>&larr; Materials</button>
                  <button onClick={() => setStep(3)} style={btnPrimary}>Next: Countertops &rarr;</button>
                </div>
              </div>
            )}

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
                      {trimSelections.toeKick && <span style={{ padding: '3px 8px', background: '#1e3a5f20', borderRadius: 4, border: `1px solid ${C.primary}` }}>Toe Kick (TK-N/C)</span>}
                      {trimSelections.crown && <span style={{ padding: '3px 8px', background: '#1e3a5f20', borderRadius: 4, border: `1px solid ${C.primary}` }}>
                        {trimSelections.crownProfile === 'furniture' ? 'Furniture Crown (3FCR)' : 'Crown Mould (3 1/2CRN)'}
                      </span>}
                      {trimSelections.lightRail && <span style={{ padding: '3px 8px', background: '#1e3a5f20', borderRadius: 4, border: `1px solid ${C.primary}` }}>Light Rail (1 3/4 UCA)</span>}
                      {trimSelections.traditionalTrim && <span style={{ padding: '3px 8px', background: '#1e3a5f20', borderRadius: 4, border: `1px solid ${C.primary}` }}>Traditional Trim (7/8TD)</span>}
                      {trimSelections.countertopEdge && <span style={{ padding: '3px 8px', background: '#1e3a5f20', borderRadius: 4, border: `1px solid ${C.primary}` }}>Countertop Edge</span>}
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
