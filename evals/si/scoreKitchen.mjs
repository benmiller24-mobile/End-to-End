/**
 * Self-improving QA scorer — one kitchen, five metrics.
 * =====================================================
 * Given a SOLVED (+realized, for metric tenants) result and its room/brand, this
 * scores the design the way the user asked: does it accurately DESIGN, PRICE,
 * lay out a FLOOR PLAN, meet NKBA STANDARDS, and read as a professional, balanced
 * AESTHETIC. Each metric returns { score 0-100, pass, issues[] }; the kitchen
 * passes only when all five pass. Pure + headless — no brand conditionals; the
 * pricing metric resolves through the ACTIVE tenant catalogue.
 */
import { scoreAesthetics } from '../../eclipse-engine/src/index.js';
import { setActiveTenant, setTenantPriceGroup } from '../../eclipse-pricing/src/tenants/index.js';
import { findSkuNormalized } from '../../frontend/src/skuResolver.js';

const NAN_RE = /NaN/;
// A real, placed CABINET (priced carcase) — base / wall / tall / vanity. Excludes
// appliances, fillers, end panels, toe kicks, scribes, mouldings, decorative
// panels, range hoods, and loose accessories (which legitimately lack a wall
// position and are priced/scored separately).
const CABINET_TYPES = new Set(['base', 'wall', 'tall', 'vanity']);
const isCabinet = (p) => p && p.sku && CABINET_TYPES.has(p.type);
// Items that occupy a linear wall position (cabinets + appliances) — these must
// have valid numeric coordinates; accessories need not.
const isPositioned = (p) => p && (CABINET_TYPES.has(p.type) || p.type === 'appliance');
// Base-zone footprint = bases + base-mounted appliances (NOT uppers, which sit
// above bases on the same span). Used for the wall-fill ratio.
const isBaseZone = (p) => p && (p.type === 'base' || (p.type === 'appliance' && (p._elev?.zone === 'BASE' || p._elev?.zone === 'TALL')));

// ── 1. DESIGN — cabinets present, walls filled, no degenerate carcases ──
function scoreDesign(result, room) {
  const issues = [];
  const placements = result.placements || [];
  const cabs = placements.filter(isCabinet);
  if (!cabs.length) issues.push('no cabinets placed');

  // NaN sku/width on a real CABINET is a hard solver bug.
  const nan = cabs.filter(p => NAN_RE.test(String(p.sku)) || Number.isNaN(Number(p.width)));
  if (nan.length) issues.push(`${nan.length} cabinet(s) with NaN sku/width (e.g. ${nan[0].sku})`);

  // Wall-fill ratio, computed in the BASE zone only (uppers share the base span).
  const wallLen = (room.walls || []).reduce((a, w) => a + (w.length || 0), 0);
  const baseLen = placements.filter(isBaseZone).reduce((a, p) => a + (Number(p.width) || 0), 0);
  const fill = wallLen > 0 ? baseLen / wallLen : 0;
  if (wallLen > 0 && fill < 0.75) issues.push(`base-run fill only ${(fill * 100).toFixed(0)}% (gaps/short run)`);
  if (fill > 1.05) issues.push(`base run overfills walls ${(fill * 100).toFixed(0)}%`);

  const score = Math.max(0, 100 - issues.length * 25 - (nan.length ? 25 : 0));
  return { score, pass: issues.length === 0, issues, cabinetCount: cabs.length, fill: +fill.toFixed(3) };
}

// ── 2. PRICE — every real cabinet resolves to a catalog SKU at a real price ──
function scorePrice(result, brand, priceGroup) {
  const issues = [];
  setActiveTenant(brand);
  if (priceGroup != null) setTenantPriceGroup(brand, priceGroup);
  const cabs = (result.placements || []).filter(isCabinet);
  let exact = 0, normalized = 0, substituted = 0, missing = 0, total = 0;
  for (const p of cabs) {
    const r = findSkuNormalized(p.sku);
    if (!r) { missing++; continue; }
    if (r._resolution === 'substituted') substituted++;
    else if (r._resolution === 'normalized') normalized++;
    else exact++;
    if (typeof r.p === 'number') total += r.p;
  }
  if (missing) issues.push(`${missing} cabinet SKU(s) not found in ${brand} catalog`);
  if (substituted) issues.push(`${substituted} cabinet SKU(s) silently substituted (not order-grade)`);
  if (cabs.length && total <= 0) issues.push('priced total is zero');
  const denom = cabs.length || 1;
  const score = Math.round(((exact + normalized) / denom) * 100);
  return { score, pass: missing === 0 && substituted === 0 && total > 0, issues,
    exact, normalized, substituted, missing, total: Math.round(total), cabinets: cabs.length };
}

// ── 3. FLOOR PLAN — geometry is valid (no overlaps, no NaN coords, has outline) ──
function scoreFloorplan(result) {
  const issues = [];
  const sv = result.spatialValidation;
  // True GEOMETRY defects only — overlaps, gaps, boundary, corner-anchor, trim
  // placement. The work_triangle_* rules are NKBA design guidelines (scored under
  // the NKBA metric), not floor-plan geometry, so they don't fail the plan here.
  const hardErrors = (sv?.errors || []).filter(e => e.severity === 'error' && !/^work_triangle/.test(e.rule));
  if (hardErrors.length) {
    issues.push(`${hardErrors.length} geometry error(s) (e.g. ${hardErrors[0].rule}: ${hardErrors[0].message?.slice(0, 70)})`);
  }
  // Only wall-positioned items (cabinets + appliances) must have valid coords;
  // loose accessories (crown, scribe, panels) legitimately carry no position.
  const badCoord = (result.placements || []).filter(isPositioned)
    .some(p => Number.isNaN(Number(p.position)));
  if (badCoord) issues.push('positioned cabinet/appliance with NaN position');
  const cpoly = result.countertopPolyline;
  const hasCounter = Array.isArray(cpoly) ? cpoly.length > 0 : (cpoly?.segments?.length > 0);
  if (!hasCounter) issues.push('no countertop polyline');
  const score = Math.max(0, 100 - hardErrors.length * 15 - (badCoord ? 40 : 0) - (hasCounter ? 0 : 10));
  return { score, pass: issues.length === 0, issues, geometryErrors: hardErrors.length };
}

// ── 4. NKBA — kitchen-design-standards score + count of hard violations ──
function scoreNkba(result) {
  const issues = [];
  const rep = result.nkbaReport || {};
  const score = typeof rep.score === 'number' ? rep.score : 0;
  const errors = (result.validation || []).filter(v => v.severity === 'error' && /NKBA/i.test(v.rule));
  if (errors.length) issues.push(`${errors.length} NKBA hard violation(s) (e.g. ${errors[0].rule})`);
  if (score < 70) issues.push(`NKBA score ${score} < 70`);
  return { score, pass: score >= 70 && errors.length === 0, issues, hardViolations: errors.length };
}

// ── 5. AESTHETIC — balance / consistency / proportion (Shea McGee balance model) ──
function scoreAesthetic(result, prefs) {
  const issues = [];
  let a;
  try { a = scoreAesthetics(result.walls || [], result.uppers || [], result.corners || [], prefs || {}); }
  catch (e) { return { score: 0, pass: false, issues: [`aesthetic scorer threw: ${e.message}`] }; }
  // Engine composite (symmetry 40% · proportionality 35% · consistency 25%).
  const score = a.overall ?? 0;
  if (score < 60) issues.push(`aesthetic ${score} < 60 (balance/proportion weak)`);
  return { score, pass: score >= 60, issues, breakdown: a };
}

export function scoreKitchen(result, { brand, room, prefs, priceGroup } = {}) {
  const metrics = {
    design: scoreDesign(result, room || {}),
    price: scorePrice(result, brand, priceGroup),
    floorplan: scoreFloorplan(result),
    nkba: scoreNkba(result),
    aesthetic: scoreAesthetic(result, prefs),
  };
  const pass = Object.values(metrics).every(m => m.pass);
  const overall = Math.round(Object.values(metrics).reduce((a, m) => a + m.score, 0) / 5);
  const failed = Object.entries(metrics).filter(([, m]) => !m.pass).map(([k]) => k);
  return { pass, overall, failed, metrics };
}
