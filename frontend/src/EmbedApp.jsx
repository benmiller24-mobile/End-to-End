/**
 * Consumer render embed — iframed by the FAKS / Showroom Atlas /design page.
 * =========================================================================
 * Reads a URL-encoded design spec (?design=), reconstructs the SAME solverResult
 * the dealer app builds (solve + realize + post-process), and renders the real
 * floor plan, elevations, 3D, and AI rendering — no wizard, no pricing, no SKUs.
 * Served from the dealer Netlify deploy so the AI render calls /api/leonardo
 * same-origin (no CORS).
 */
import React, { useMemo, useState, Suspense, lazy } from 'react';
import { solve } from '../../eclipse-engine/src/solver.js';
import { realizeInTenant } from '../../eclipse-engine/src/tenantRealize.js';
import { getTenant, setTenantPriceGroup } from '../../eclipse-pricing/src/tenants/index.js';
import { setPricingBrand } from './skuResolver.js';
import { loadLocalTenantPackages } from './tenantLocal.js';
import { getConstruction } from './constructionProfiles.js';
import FloorPlanView from './FloorPlanView.jsx';
import ElevationView from './ElevationView.jsx';
// 3D (Three.js) is heavy — load its chunk only when the user opens that tab,
// so the floor plan paints instantly. Kitchen3DView also carries the photoreal
// AI render (img2img over the real 3D geometry — matches the actual layout).
const Kitchen3DView = lazy(() => import('./Kitchen3DView.jsx'));

loadLocalTenantPackages();   // register data-package tenants (pronorm etc.) before solving

const C = { sage: '#7a8b6f', espresso: '#3d2b1f', gold: '#d4a843', taupe: '#a89279', paper: '#f7f4ee', line: '#e0d8ca' };

const FRAME_BY_BRAND = { eclipse: 'eclipse_frameless', pronorm: 'pronorm_frameless', shiloh: 'shiloh_overlay_125' };
function defaultMaterials(brand, override = {}) {
  return {
    brand,
    frameStyle: override.frameStyle || FRAME_BY_BRAND[brand] || 'eclipse_frameless',
    species: override.species || 'Maple',
    door: override.door || 'METRO',
    construction: override.construction || 'Standard',
    finishColor: override.finishColor || 'Natural',
    grainHorizontal: !!override.grainHorizontal,
    hardware: override.hardware || (brand === 'pronorm' ? 'bar' : 'knob'),
    hardwareFinish: override.hardwareFinish || 'Brushed Nickel',
  };
}

function decodeSpec() {
  try {
    const p = new URLSearchParams(window.location.search).get('design');
    if (!p) return null;
    let json;
    try { json = decodeURIComponent(escape(atob(p))); } catch { json = decodeURIComponent(p); }
    return JSON.parse(json);
  } catch { return null; }
}

// Reconstruct the solverResult exactly as App.handleSolve does.
function buildSolverResult(spec) {
  const ceilH = Number(spec.prefs?.ceilingHeight) || 96;
  const wallsC = (spec.walls || []).map(w => ({ ...w, ceilingHeight: w.ceilingHeight || ceilH }));
  const input = {
    layoutType: spec.layoutType, roomType: spec.roomType || 'kitchen',
    walls: wallsC, appliances: spec.appliances || [], prefs: spec.prefs || {},
    applyApplianceRec: true,
    ...(spec.island ? { island: spec.island } : {}),
    ...(spec.peninsula ? { peninsula: spec.peninsula } : {}),
  };
  setPricingBrand(spec.materials?.brand || spec.brand || 'eclipse');
  const result = solve(input);
  const t = getTenant(spec.materials?.brand || spec.brand || 'eclipse');
  if (t?.realize) {
    const group = spec.priceGroup ?? t.pricing?.defaultGroup ?? '0';
    setTenantPriceGroup(t.id, group);
    realizeInTenant(result, t, group);
  }
  result._inputWalls = (result._inputWalls || wallsC).map(w => ({
    ...w, id: w.id, length: w.length, ceilingHeight: w._realCeilingHeight || w.ceilingHeight || ceilH,
  }));
  if (result.walls && result.walls[0] && !result.walls[0].id) {
    result.walls.forEach(w => { w.id = w.wallId; w.length = w.wallLength; });
  }
  return result;
}

const TABS = [
  { id: 'plan', label: 'Floor plan' },
  { id: 'elev', label: 'Elevations' },
  { id: '3d', label: '3D & photo render' },
];

export default function EmbedApp() {
  const spec = useMemo(decodeSpec, []);
  // Default to the floor plan — paints instantly. The 3D tab pulls a large
  // Three.js chunk, so load it only when the user opens it.
  const [tab, setTab] = useState('plan');

  const built = useMemo(() => {
    if (!spec || !spec.walls?.length) return { error: 'No design provided.' };
    try { return { result: buildSolverResult(spec) }; }
    catch (e) { return { error: e?.message || 'Could not build the design.' }; }
  }, [spec]);

  if (built.error) {
    return <div style={{ padding: 40, textAlign: 'center', color: C.taupe, fontFamily: 'Inter, sans-serif' }}>{built.error}</div>;
  }

  const result = built.result;
  const brand = spec.materials?.brand || spec.brand || 'eclipse';
  const materials = defaultMaterials(brand, spec.materials || {});
  const construction = getConstruction(materials.frameStyle);
  const trim = spec.trimSelections || {};
  const titleBlock = { project: 'Your Kitchen', client: '', designer: getTenant(brand).branding?.lineLabel || '', date: '', scale: 'NTS' };

  const tabBtn = (t) => ({
    flex: 1, padding: '10px 8px', cursor: 'pointer', fontSize: 13, fontWeight: 700,
    border: 'none', borderBottom: `3px solid ${tab === t.id ? C.gold : 'transparent'}`,
    background: 'transparent', color: tab === t.id ? C.espresso : C.taupe,
  });

  return (
    <div style={{ minHeight: '100vh', background: C.paper, fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.line}`, background: '#fff', position: 'sticky', top: 0, zIndex: 5 }}>
        {TABS.map(t => <button key={t.id} style={tabBtn(t)} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      <div style={{ padding: 12 }}>
        {tab === 'plan' && <FloorPlanView solverResult={result} inputWalls={result._inputWalls} titleBlock={titleBlock} consumer />}
        {tab === 'elev' && (
          <ElevationView solverResult={result} trim={trim} doorStyle={materials.door} species={materials.species}
            finishColor={materials.finishColor} grainHorizontal={materials.grainHorizontal} hardware={materials.hardware}
            hardwareFinish={materials.hardwareFinish} countertopColor={null} appliances={[]} construction={construction}
            titleBlock={titleBlock} consumer />
        )}
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: C.taupe }}>Loading…</div>}>
          {tab === '3d' && <Kitchen3DView solverResult={result} materials={materials} construction={construction} countertopColor={null} trim={trim} prefs={spec.prefs || {}} selectedAppliances={[]} />}
        </Suspense>
      </div>
    </div>
  );
}
